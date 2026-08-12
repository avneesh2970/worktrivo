const express = require("express");
const router = express.Router();

const Group = require("../models/Group");
const Task = require("../models/Task");
const User = require("../models/User");
const Notification = require("../models/Notification");
const sendEmail = require("../utils/sendEmail");
const {
    sendInAppNotification,
    getIo
} = require("../utils/socket");

const {
  authenticate,
  requireRole
} = require("../middleware/auth");

/* ==========================================================
   CREATE GROUP
========================================================== */
router.post(
    "/",
    authenticate,
    requireRole(["admin"]),
    async (req, res) => {
        try {
            const { name, description, members = [] } = req.body;

            const group = await Group.create({
                name,
                description,
                members,
                createdBy: req.user._id,
                approvalStatus: 'Pending' // Initial state
            });

            const users = await User.find({ _id: { $in: members } });

            for (const user of users) {
                const notification = await Notification.create({
                    userId: user._id,
                    message: `You have been assigned to project "${group.name}"`,
                    type: "project"
                });

                await sendInAppNotification(user._id, notification);

                await sendEmail(
                    user.email,
                    "New Project Assigned",
                    `<h2>Hello ${user.name}</h2>
                    <p>You have been assigned to a new project.</p>
                    <h3>${group.name}</h3>
                    <p>${description}</p><br>
                    <p>Please login to TaskSphere.</p>`
                );
            }
            
            const io = getIo();
            for (const member of members) {
                io.to(member.toString()).emit("projectUpdated");
            }
            io.to("admins").emit("projectUpdated");

            res.status(201).json(group);
        } catch(err){
            console.error(err);
            res.status(500).json({ error:err.message });
        }
    }
);

/* ==========================================================
   GET ALL GROUPS
========================================================== */
router.get(
  "/",
  authenticate,
  async (req, res) => {
   try {
     const filter = req.user.role === "member"
       ? { members: req.user._id }
       : {};

     // Add optional filter for approval status
     if (req.query.approvalStatus) {
         filter.approvalStatus = req.query.approvalStatus;
     }

     const groups = await Group.find(filter)
        .populate("members", "name email role profilePhoto")
        .populate("createdBy", "name email");

    const groupsWithStats = await Promise.all(
      groups.map(async (group) => {
        const tasks = await Task.find({ group: group._id });
        const completed = tasks.filter((t) => t.status === "Completed").length;
        const pending = tasks.filter((t) => t.status === "Pending").length;
        const overdue = tasks.filter(
          (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "Completed"
        ).length;

        const progress = tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100);

        return {
          ...group.toObject(),
          stats: { totalTasks: tasks.length, completed, pending, overdue, progress },
        };
      })
    );

    res.json(groupsWithStats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ==========================================================
   GET SINGLE GROUP
========================================================== */
router.get(
  "/:id",
  authenticate,
  async (req, res) => {
    try {
     const group = await Group.findById(req.params.id)
      .populate("members", "name email role profilePhoto department designationRole")
      .populate("createdBy", "name email profilePhoto")
      .populate("approvedBy", "name email");

      if (!group) return res.status(404).json({ error: "Group not found" });

      if (req.user.role === "member") {
        const isMember = group.members.some((m) => m._id.toString() === req.user._id.toString());
        if (!isMember) {
          return res.status(403).json({ error: "Forbidden. You are not a member of this project." });
        }
      }

      res.json(group);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ==========================================================
   UPDATE GROUP
========================================================== */
router.put(
  "/:id",
  authenticate,
  requireRole(["admin", "manager"]),
  async (req, res) => {
    try {
      const group = await Group.findByIdAndUpdate(req.params.id, req.body, { new: true });
      const io = getIo();
      
      group.members.forEach(member => {
        io.to(member.toString()).emit("projectUpdated");
      });
      io.to("admins").emit("projectUpdated");

      res.json(group);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ==========================================================
   DELETE GROUP
========================================================== */
router.delete(
  "/:id",
  authenticate,
  requireRole(["admin"]),
  async (req, res) => {
    try {
       const group = await Group.findById(req.params.id);
       const io = getIo();

       if (group) {
           group.members.forEach(member => io.to(member.toString()).emit("projectUpdated"));
       }
       io.to("admins").emit("projectUpdated");

      await Group.findByIdAndDelete(req.params.id);
      res.json({ message: "Group deleted successfully." });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ==========================================================
   ADD MEMBER
========================================================== */
router.post(
  "/:id/member",
  authenticate,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const group = await Group.findById(req.params.id);
      if (!group) return res.status(404).json({ error: "Group not found" });

      if (!group.members.includes(req.body.userId)) {
        group.members.push(req.body.userId);
      }

      await group.save();
      const io = getIo();
      io.to(req.body.userId).emit("projectUpdated");
      io.to("admins").emit("projectUpdated");

      const updatedGroup = await Group.findById(group._id)
        .populate("members", "name email role profilePhoto department designationRole")
        .populate("createdBy", "name email profilePhoto");

      res.json(updatedGroup);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ==========================================================
   REMOVE MEMBER
========================================================== */
router.delete(
  "/:id/member/:userId",
  authenticate,
  requireRole(["admin"]),
  async (req, res) => {
    try {
      const group = await Group.findById(req.params.id);
      if (!group) return res.status(404).json({ error: "Group not found" });

      group.members = group.members.filter(m => m.toString() !== req.params.userId);
      await group.save();
      
      const io = getIo();
      io.to(req.params.userId).emit("projectUpdated");
      io.to("admins").emit("projectUpdated");

      const updatedGroup = await Group.findById(group._id)
        .populate("members", "name email role profilePhoto designationRole department")
        .populate("createdBy", "name email profilePhoto");

      res.json(updatedGroup);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ==========================================================
   GROUP TASKS
========================================================== */
router.get(
  "/:id/tasks",
  authenticate,
  async (req, res) => {
    try {
      const tasks = await Task.find({ group: req.params.id })
        .populate("assignedTo", "name")
        .populate("createdBy", "name");
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ==========================================================
   APPROVE GROUP (ADMIN ONLY)
========================================================== */
router.patch(
    "/:id/approve",
    authenticate,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const group = await Group.findByIdAndUpdate(
            req.params.id, 
            { 
                approvalStatus: 'Approved',
                approvedBy: req.user._id,
                approvedAt: new Date()
            }, 
            { new: true }
        );
  
        if (!group) return res.status(404).json({ error: "Group not found" });
  
        const io = getIo();
        group.members.forEach(member => io.to(member.toString()).emit("projectUpdated"));
        io.to("admins").emit("projectUpdated");
  
        res.json({ message: "Project approved successfully", group });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
);

/* ==========================================================
   REJECT GROUP (ADMIN ONLY)
========================================================== */
router.patch(
    "/:id/reject",
    authenticate,
    requireRole(["admin"]),
    async (req, res) => {
      try {
        const group = await Group.findByIdAndUpdate(
            req.params.id, 
            { 
                approvalStatus: 'Rejected',
                approvedBy: req.user._id,
                approvedAt: new Date()
            }, 
            { new: true }
        );
  
        if (!group) return res.status(404).json({ error: "Group not found" });
  
        const io = getIo();
        group.members.forEach(member => io.to(member.toString()).emit("projectUpdated"));
        io.to("admins").emit("projectUpdated");
  
        res.json({ message: "Project rejected successfully", group });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
);

module.exports = router;