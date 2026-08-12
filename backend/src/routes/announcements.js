const express = require("express");
const mongoose = require("mongoose");
const Announcement = require("../models/Announcement");
const { authenticate, requireRole } = require("../middleware/auth");

const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
});

const router = express.Router();

/*
=================================================
GET ALL ANNOUNCEMENTS
=================================================
*/
router.get("/", authenticate, async (req, res) => {
  try {
    let query = {
      archived: false,
    };

    // Hide acknowledged announcements only for members
    if (req.user.role === "member") {
      query.acknowledgedBy = {
        $not: {
          $elemMatch: {
            user: req.user._id,
          },
        },
      };
    }

    const announcements = await Announcement.find(query)
      .populate("postedBy", "name email profilePhoto role")
      .sort({
        pinned: -1,
        createdAt: -1,
      });

    res.json(announcements);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to fetch announcements",
    });
  }
});

/*
=================================================
CREATE ANNOUNCEMENT
=================================================
*/
router.post("/", authenticate, upload.array("attachments"), async (req, res) => {
   
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "manager"
    ) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    const {
      title,
      body,
      category,
      department,
      pinned,
      attachments,
    } = req.body;

    const announcement = await Announcement.create({
      title,
      body,
      category,
      department,
      pinned,
      attachments: attachments || [],
     postedBy: req.user._id,
    });

    const populated = await Announcement.findById(
      announcement._id
    ).populate(
      "postedBy",
      "name email profilePhoto role"
    );

    // =====================================================
    // Send Announcement Email To All Active Users
    // =====================================================

    const users = await User.find({
  active: true,
}).select("name email");

await Promise.allSettled(
  users.map(async (user) => {
    if (!user.email) return;

    try {
      

      await sendEmail(
        user.email,
        `📢 New Announcement - ${announcement.title}`,
        `
          <h2>Hello ${user.name},</h2>

          <p>A new announcement has been posted in <b>TaskSphere</b>.</p>

          <hr>

          <p><b>Title:</b> ${announcement.title}</p>

          <p><b>Category:</b> ${announcement.category}</p>

          <p>${announcement.body}</p>

          <br>

          <p>Please login to TaskSphere for more details.</p>

          <br>

          <p>Regards,</p>
          <p><b>TaskSphere Team</b></p>
        `
      );

     
    } catch (err) {
      console.error(`❌ Failed to send email to ${user.email}`);
      console.error(err.message);
    }
  })
);

    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to create announcement",
    });
  }
});

/*
=================================================
UPDATE ANNOUNCEMENT
=================================================
*/
router.put("/:id", authenticate, async (req, res) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "manager"
    ) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    const announcement =
      await Announcement.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
        }
      ).populate(
        "postedBy",
        "name email profilePhoto role"
      );

    if (!announcement) {
      return res.status(404).json({
        message: "Announcement not found",
      });
    }

    res.json(announcement);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to update announcement",
    });
  }
});

/*
=================================================
DELETE
=================================================
*/
router.delete("/:id", authenticate, async (req, res) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "manager"
    ) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    await Announcement.findByIdAndDelete(
      req.params.id
    );

    res.json({
      message: "Announcement deleted",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Delete failed",
    });
  }
});

/*
=================================================
PIN / UNPIN
=================================================
*/
router.patch("/:id/pin", authenticate, async (req, res) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "manager"
    ) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    const announcement =
      await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        message: "Announcement not found",
      });
    }

    announcement.pinned =
      !announcement.pinned;

    await announcement.save();

    res.json(announcement);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed",
    });
  }
});

/*
=================================================
ARCHIVE
=================================================
*/
router.patch("/:id/archive", authenticate, async (req, res) => {
  try {
    if (
      req.user.role !== "admin" &&
      req.user.role !== "manager"
    ) {
      return res.status(403).json({
        message: "Not authorized",
      });
    }

    const announcement =
      await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        message: "Announcement not found",
      });
    }

    announcement.archived = true;

    await announcement.save();

    res.json({
      message: "Archived",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Archive failed",
    });
  }
});

/*
=================================================
MARK AS READ
=================================================
*/
router.patch("/:id/read", authenticate, async (req, res) => {
  try {
    const announcement =
      await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        message: "Announcement not found",
      });
    }

    const alreadyRead =
      announcement.readBy.find(
        (r) =>
         r.user.toString() === req.user._id.toString()
      );

    if (!alreadyRead) {
     announcement.acknowledgedBy.push({
    user: req.user._id,
    acknowledgedAt: new Date(),
});

      await announcement.save();
    }

    res.json({
      message: "Marked as read",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Read failed",
    });
  }
});

/*
=================================================
ACKNOWLEDGE
=================================================
*/
router.patch(
  "/:id/acknowledge",
 authenticate,
  async (req, res) => {
    try {
      const announcement =
        await Announcement.findById(
          req.params.id
        );

      if (!announcement) {
        return res.status(404).json({
          message:
            "Announcement not found",
        });
      }

      const exists =
        announcement.acknowledgedBy.find(
          (r) =>
            r.user.toString() ===
            req.user.id
        );

      if (!exists) {
        announcement.acknowledgedBy.push({
          user: req.user.id,
        });

        await announcement.save();
      }

      res.json({
        message: "Acknowledged",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        message: "Failed",
      });
    }
  }
);

/*
=================================================
READ STATUS
=================================================
*/
router.get("/:id/read-status", authenticate, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate("readBy.user", "name email profilePhoto")
      .populate("acknowledgedBy.user", "name email profilePhoto");

    if (!announcement) {
      return res.status(404).json({
        message: "Announcement not found",
      });
    }

    res.json({
      totalEligible: announcement.readBy.length,
      readCount: announcement.readBy.length,
      acknowledgedCount: announcement.acknowledgedBy.length,
      readBy: announcement.readBy,
      acknowledgedBy: announcement.acknowledgedBy,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: err.message,
    });
  }
});

module.exports = router;