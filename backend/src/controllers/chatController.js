const path = require("path");
const fs = require("fs");
const { Readable } = require("stream");
const ChatRoom = require("../models/ChatRoom");
const User = require("../models/User");         // Make sure to import the User model
const Message = require("../models/Message");
const { getIo } = require("../utils/socket");

const getChatRooms = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // Ensure default general workspace exists if no rooms exist
    const totalRooms = await ChatRoom.countDocuments({ isActive: true });
    if (totalRooms === 0) {
      const allUsers = await User.find({ active: true }).select("_id");
      const userIds = allUsers.map((u) => u._id);
      await ChatRoom.create({
        name: "General Workspace",
        description: "Official company-wide discussion and announcements.",
        type: "global",
        members: userIds,
        admins: [userId],
        createdBy: userId,
        approvalStatus: "Approved",
        approvedBy: userId,
        approvedAt: new Date(),
      });
    }

    let filter = { isActive: true };

    if (userRole === "admin") {
      // Admin can see EVERY chat (direct chats, communities, and global)
      filter = { isActive: true };
    } else if (userRole === "manager") {
      // Manager sees: global, direct with them, approved groups with them, OR groups they created (even if pending)
      filter = {
        isActive: true,
        $or: [
          { type: "global" },
          { type: "direct", members: userId },
          { type: "group", members: userId, approvalStatus: "Approved" },
          { type: "group", createdBy: userId },
        ],
      };
    } else {
      // Regular members see: global, direct with them, and approved groups with them
      filter = {
        isActive: true,
        $or: [
          { type: "global" },
          { type: "direct", members: userId },
          { type: "group", members: userId, approvalStatus: "Approved" },
        ],
      };
    }

    const rooms = await ChatRoom.find(filter)
      .populate("members", "name email profilePhoto role designationRole department")
      .populate("admins", "name email profilePhoto role")
      .populate("createdBy", "name email profilePhoto role")
      .populate("approvedBy", "name email")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name profilePhoto role" },
      })
      .sort({ updatedAt: -1 });

    const roomIds = rooms.map((r) => r._id);
    const unreadMap = new Map();

    if (roomIds.length > 0) {
      const unreadCounts = await Message.aggregate([
        {
          $match: {
            chatRoom: { $in: roomIds },
            deleted: false,
            sender: { $ne: userId },
            "readBy.user": { $ne: userId },
          },
        },
        {
          $group: {
            _id: "$chatRoom",
            count: { $sum: 1 },
          },
        },
      ]);

      unreadCounts.forEach((u) => {
        unreadMap.set(u._id.toString(), u.count);
      });
    }

    const roomsWithUnread = rooms.map((r) => {
      const obj = r.toObject ? r.toObject() : { ...r };
      obj.unreadCount = unreadMap.get(r._id.toString()) || 0;
      return obj;
    });

    res.status(200).json({
      success: true,
      data: roomsWithUnread,
    });
  } catch (error) {
    console.error("Get Chat Rooms Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chat rooms.",
    });
  }
};

// Create or get 1-on-1 direct chat room between any two users
const createOrGetDirectRoom = async (req, res) => {
  try {
    const userId = req.user._id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "targetUserId is required.",
      });
    }

    if (userId.toString() === targetUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: "You cannot start a direct chat with yourself.",
      });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "Target user not found.",
      });
    }

    // Check if direct room already exists
    let room = await ChatRoom.findOne({
      type: "direct",
      isActive: true,
      members: { $all: [userId, targetUserId], $size: 2 },
    })
      .populate("members", "name email profilePhoto role designationRole department")
      .populate("admins", "name email profilePhoto role")
      .populate("createdBy", "name email profilePhoto role")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "name profilePhoto role" },
      });

    if (!room) {
      room = await ChatRoom.create({
        name: `${req.user.name} & ${targetUser.name}`,
        type: "direct",
        members: [userId, targetUserId],
        admins: [userId, targetUserId],
        createdBy: userId,
        approvalStatus: "Approved",
      });

      room = await ChatRoom.findById(room._id)
        .populate("members", "name email profilePhoto role designationRole department")
        .populate("admins", "name email profilePhoto role")
        .populate("createdBy", "name email profilePhoto role")
        .populate({
          path: "lastMessage",
          populate: { path: "sender", select: "name profilePhoto role" },
        });

      const io = getIo();
      if (io) {
        io.to(targetUserId.toString()).emit("chat_room_created", room);
        io.to("admins").emit("chat_room_created", room);
      }
    }

    res.status(200).json({
      success: true,
      data: room,
    });
  } catch (error) {
    console.error("Direct Room Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to initialize direct chat.",
    });
  }
};

// Create new community / group room
const createRoom = async (req, res) => {
  try {
    const { name, description, image, members = [], type, group } = req.body;
    const userRole = req.user.role;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Community name is required.",
      });
    }

    // Role check: Only admin and manager can create communities
    if (userRole === "member") {
      return res.status(403).json({
        success: false,
        message: "Members are not authorized to create communities. Only Admins and Managers can create communities.",
      });
    }

    const isAdmin = userRole === "admin";
    const approvalStatus = isAdmin ? "Approved" : "Pending";
    const approvedBy = isAdmin ? req.user._id : null;
    const approvedAt = isAdmin ? new Date() : null;

    // Ensure creator is in members
    const memberSet = new Set((Array.isArray(members) ? members : []).map((id) => id.toString()));
    memberSet.add(req.user._id.toString());
    const finalMembers = Array.from(memberSet);

    const room = await ChatRoom.create({
      name: name.trim(),
      description: (description || "").trim(),
      image: (image || "").trim(),
      type: type || "group",
      group: group || null,
      members: finalMembers,
      admins: [req.user._id],
      createdBy: req.user._id,
      approvalStatus,
      approvedBy,
      approvedAt,
    });

    const populatedRoom = await ChatRoom.findById(room._id)
      .populate("members", "name email profilePhoto role designationRole department")
      .populate("admins", "name email profilePhoto role")
      .populate("createdBy", "name email profilePhoto role")
      .populate("approvedBy", "name email");

    const io = getIo();
    if (io) {
      if (isAdmin) {
        finalMembers.forEach((memberId) => {
          io.to(memberId.toString()).emit("chat_room_created", populatedRoom);
        });
        io.to("admins").emit("chat_room_created", populatedRoom);
      } else {
        io.to(req.user._id.toString()).emit("chat_room_created", populatedRoom);
        io.to("admins").emit("community_pending_approval", populatedRoom);
        io.to("admins").emit("chat_room_created", populatedRoom);
      }
    }

    res.status(201).json({
      success: true,
      message: isAdmin
        ? "Community created and active successfully."
        : "Community created successfully. It will become active once approved by an Admin.",
      data: populatedRoom,
    });
  } catch (error) {
    console.error("Create Room Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create community.",
    });
  }
};

// Update Community (Title, Description, Image/Avatar)
const updateRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { name, description, image } = req.body;
    const userRole = req.user.role;
    const userId = req.user._id;

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Community not found.",
      });
    }

    if (room.type === "direct") {
      return res.status(400).json({
        success: false,
        message: "Direct chats cannot be edited.",
      });
    }

    // Permission check: System admin, creator, or room admin/manager
    const isSystemAdmin = userRole === "admin";
    const isCreator = room.createdBy && room.createdBy.equals(userId);
    const isRoomAdmin = Array.isArray(room.admins) && room.admins.some((a) => a.equals(userId));
    const isManagerInRoom = userRole === "manager" && room.members.some((m) => m.equals(userId));

    if (!isSystemAdmin && !isCreator && !isRoomAdmin && !isManagerInRoom) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to edit this community.",
      });
    }

    // Update Title (Name)
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Community name cannot be empty.",
        });
      }
      room.name = name.trim();
    }

    // Update Description
    if (description !== undefined) {
      room.description = description.trim();
    }

    // Update Image
    if (req.file) {
      room.image = req.file.path || req.file.secure_url || `/uploads/chat/${req.file.filename}`;
    } else if (image !== undefined) {
      room.image = image.trim();
    }

    await room.save();

    const populatedRoom = await ChatRoom.findById(room._id)
      .populate("members", "name email profilePhoto role designationRole department")
      .populate("admins", "name email profilePhoto role")
      .populate("createdBy", "name email profilePhoto role")
      .populate("approvedBy", "name email");

    const io = getIo();
    if (io) {
      io.to(room._id.toString()).emit("chat_room_updated", populatedRoom);
      (populatedRoom.members || []).forEach((m) => {
        io.to(m._id.toString()).emit("chat_room_updated", populatedRoom);
      });
      io.to("admins").emit("chat_room_updated", populatedRoom);
    }

    res.status(200).json({
      success: true,
      message: "Community updated successfully.",
      data: populatedRoom,
    });
  } catch (error) {
    console.error("Update Room Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update community.",
    });
  }
};

// Approve Community (Admin only)
const approveRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Community not found.",
      });
    }

    room.approvalStatus = "Approved";
    room.approvedBy = req.user._id;
    room.approvedAt = new Date();
    await room.save();

    if (room.group) {
      const Group = require("../models/Group");
      await Group.findByIdAndUpdate(room.group, {
        approvalStatus: "Approved",
        approvedBy: req.user._id,
        approvedAt: new Date(),
      });
    }

    const populatedRoom = await ChatRoom.findById(room._id)
      .populate("members", "name email profilePhoto role designationRole department")
      .populate("admins", "name email profilePhoto role")
      .populate("createdBy", "name email profilePhoto role")
      .populate("approvedBy", "name email");

    const io = getIo();
    if (io) {
      populatedRoom.members.forEach((m) => {
        io.to(m._id.toString()).emit("room_approved", populatedRoom);
        io.to(m._id.toString()).emit("chat_room_created", populatedRoom);
      });
      io.to("admins").emit("room_approved", populatedRoom);
    }

    try {
      const Notification = require("../models/Notification");
      const notification = await Notification.create({
        userId: room.createdBy,
        message: `Your community "${room.name}" has been approved by ${req.user.name} and is now active!`,
        type: "chat",
      });
      const { sendInAppNotification } = require("../utils/socket");
      await sendInAppNotification(room.createdBy, notification);
    } catch (notifErr) {
      console.error("Notification send error:", notifErr.message);
    }

    res.status(200).json({
      success: true,
      message: "Community approved successfully.",
      data: populatedRoom,
    });
  } catch (error) {
    console.error("Approve Room Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve community.",
    });
  }
};

// Reject Community (Admin only)
const rejectRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Community not found.",
      });
    }

    room.approvalStatus = "Rejected";
    room.approvedBy = req.user._id;
    room.approvedAt = new Date();
    await room.save();

    if (room.group) {
      const Group = require("../models/Group");
      await Group.findByIdAndUpdate(room.group, {
        approvalStatus: "Rejected",
        approvedBy: req.user._id,
        approvedAt: new Date(),
      });
    }

    const populatedRoom = await ChatRoom.findById(room._id)
      .populate("members", "name email profilePhoto role designationRole department")
      .populate("createdBy", "name email profilePhoto role");

    const io = getIo();
    if (io) {
      io.to(room.createdBy.toString()).emit("room_rejected", populatedRoom);
      io.to("admins").emit("room_rejected", populatedRoom);
    }

    try {
      const Notification = require("../models/Notification");
      const notification = await Notification.create({
        userId: room.createdBy,
        message: `Your community "${room.name}" was rejected by ${req.user.name}.`,
        type: "chat",
      });
      const { sendInAppNotification } = require("../utils/socket");
      await sendInAppNotification(room.createdBy, notification);
    } catch (notifErr) {
      console.error("Notification send error:", notifErr.message);
    }

    res.status(200).json({
      success: true,
      message: "Community rejected.",
      data: populatedRoom,
    });
  } catch (error) {
    console.error("Reject Room Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject community.",
    });
  }
};

// Get messages
const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Chat room not found.",
      });
    }

    const isMember = room.members.some((m) => m.toString() === userId.toString());
    const isCreator = room.createdBy && room.createdBy.toString() === userId.toString();

    // Admin can see messages of ANY chat. Other users must be in members or creator
    if (userRole !== "admin" && !isMember && !isCreator) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this chat room.",
      });
    }

    // If community is pending, non-admin non-creator cannot view
    if (room.type === "group" && room.approvalStatus === "Pending" && userRole !== "admin" && !isCreator) {
      return res.status(403).json({
        success: false,
        message: "This community is awaiting Admin approval.",
      });
    }

    // Mark unread messages in this room as read for current user
    await Message.updateMany(
      {
        chatRoom: roomId,
        deleted: false,
        sender: { $ne: userId },
        "readBy.user": { $ne: userId },
      },
      {
        $push: {
          readBy: {
            user: userId,
            readAt: new Date(),
          },
        },
      }
    );

    // Mark unread chat notifications for this room as read
    try {
      const Notification = require("../models/Notification");
      await Notification.updateMany(
        {
          userId,
          type: "chat",
          chatRoomId: roomId,
          read: false,
        },
        {
          $set: { read: true },
        }
      );
    } catch (notifErr) {}

    const messages = await Message.find({
      chatRoom: roomId,
      deleted: false,
    })
      .populate("sender", "name profilePhoto role designationRole department")
      .populate("mentions", "name")
      .populate("replyTo")
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error("Get Messages Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch messages.",
    });
  }
};

// Mark entire room as read
const markRoomRead = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id;

    await Message.updateMany(
      {
        chatRoom: roomId,
        deleted: false,
        sender: { $ne: userId },
        "readBy.user": { $ne: userId },
      },
      {
        $push: {
          readBy: {
            user: userId,
            readAt: new Date(),
          },
        },
      }
    );

    try {
      const Notification = require("../models/Notification");
      await Notification.updateMany(
        {
          userId,
          type: "chat",
          chatRoomId: roomId,
          read: false,
        },
        {
          $set: { read: true },
        }
      );
    } catch (notifErr) {}

    const io = getIo();
    if (io) {
      io.to(roomId.toString()).emit("room_read", { roomId, userId });
    }

    res.status(200).json({
      success: true,
      message: "Room marked as read.",
    });
  } catch (error) {
    console.error("Mark Room Read Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark room as read.",
    });
  }
};

// Send message (REST API)
const sendMessage = async (req, res) => {
  try {
    const {
      chatRoom,
      text,
      attachments,
      mentions,
      replyTo,
    } = req.body;

    const room = await ChatRoom.findById(chatRoom);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Chat room not found.",
      });
    }

    if (room.type === "group" && room.approvalStatus === "Pending") {
      return res.status(403).json({
        success: false,
        message: "Cannot send messages. This community is awaiting Admin approval.",
      });
    }

    const message = await Message.create({
      chatRoom,
      sender: req.user._id,
      text,
      attachments: attachments || [],
      mentions: mentions || [],
      replyTo: replyTo || null,
    });

    await ChatRoom.findByIdAndUpdate(chatRoom, {
      lastMessage: message._id,
    });

    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name profilePhoto role")
      .populate("mentions", "name")
      .populate("replyTo");

    res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: populatedMessage,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to send message.",
    });
  }
};



// Add member
const addMember = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { email } = req.body; // Expecting 'email' now instead of 'userId'

    // 1. Find the user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User with this email not found.",
      });
    }

    // 2. Add the user's ID to the chat room
    // $addToSet ensures the user isn't added twice if they are already a member
    const room = await ChatRoom.findByIdAndUpdate(
      roomId,
      {
        $addToSet: {
          members: user._id,
        },
      },
      {
        new: true,
      }
    ).populate("members", "name email profilePhoto");

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Chat room not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Member added successfully.",
      data: room,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to add member.",
    });
  }
};

// Remove member
const removeMember = async (req, res) => {
  try {
    const { roomId, userId } = req.params;

    const room = await ChatRoom.findByIdAndUpdate(
      roomId,
      {
        $pull: {
          members: userId,
          admins: userId,
        },
      },
      {
        new: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "Member removed successfully.",
      data: room,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to remove member.",
    });
  }
};

// Read receipt
const markMessageRead = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }

    const alreadyRead = message.readBy.some(
      (item) => item.user.toString() === req.user._id
    );

    if (!alreadyRead) {
      message.readBy.push({
        user: req.user._id,
        readAt: new Date(),
      });

      await message.save();
    }

    res.status(200).json({
      success: true,
      message: "Message marked as read.",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to mark message as read.",
    });
  }
};

// Edit Message
const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;

    // Validate text
    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message text is required.",
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }

    // Prevent editing deleted messages
    if (message.deleted) {
      return res.status(400).json({
        success: false,
        message: "Deleted messages cannot be edited.",
      });
    }

    // Check ownership
    if (!message.sender.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to edit this message.",
      });
    }

    // Enforce 5-minute edit window
    const EDIT_WINDOW_MS = 5 * 60 * 1000;
    const messageAge = Date.now() - new Date(message.createdAt).getTime();
    if (messageAge > EDIT_WINDOW_MS) {
      return res.status(400).json({
        success: false,
        message: "Messages can only be edited within 5 minutes of sending.",
      });
    }

    message.text = text.trim();
    message.edited = true;
    message.editedAt = new Date();

    await message.save();

    return res.status(200).json({
      success: true,
      message: "Message updated successfully.",
      data: message,
    });
  } catch (error) {
    console.error("Edit Message Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to edit message.",
    });
  }
};

// Delete Message (Disabled as per policy)
const deleteMessage = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: "Deleting messages is not permitted.",
  });
};

// Pin message
const pinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findByIdAndUpdate(
      messageId,
      {
        pinned: true,
      },
      {
        new: true,
      }
    )
      .populate("sender", "name profilePhoto role")
      .populate("mentions", "name email");

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }

    try {
      const io = getIo();
      if (io && message.chatRoom) {
        io.to(message.chatRoom.toString()).emit("message_pinned", message);
      }
    } catch (socketErr) {
      console.warn("Could not emit message_pinned via socket:", socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: "Message pinned successfully.",
      data: message,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to pin message.",
    });
  }
};

// Unpin message
const unpinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findByIdAndUpdate(
      messageId,
      {
        pinned: false,
      },
      {
        new: true,
      }
    )
      .populate("sender", "name profilePhoto role")
      .populate("mentions", "name email");

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }

    try {
      const io = getIo();
      if (io && message.chatRoom) {
        io.to(message.chatRoom.toString()).emit("message_unpinned", message);
      }
    } catch (socketErr) {
      console.warn("Could not emit message_unpinned via socket:", socketErr.message);
    }

    res.status(200).json({
      success: true,
      message: "Message unpinned successfully.",
      data: message,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to unpin message.",
    });
  }
};
// Get all mentions for the logged-in user across all rooms
const getUserMentions = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const query = {
      mentions: userId,
      deleted: false,
    };

    const totalMentions = await Message.countDocuments(query);

    const mentions = await Message.find(query)
      .populate("sender", "name profilePhoto role")
      .populate("mentions", "name email profilePhoto role")
      .populate("chatRoom", "name type")
      .populate({
        path: "replyTo",
        populate: { path: "sender", select: "name profilePhoto" },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      pagination: {
        total: totalMentions,
        page,
        limit,
        pages: Math.ceil(totalMentions / limit),
      },
      data: mentions,
    });
  } catch (error) {
    console.error("Get User Mentions Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch user mentions.",
    });
  }
};

// Get all mentioned messages within a specific room
const getRoomMentions = async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    // Verify room exists & user is a member
    const room = await ChatRoom.findOne({
      _id: roomId,
      members: req.user._id,
      isActive: true,
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Chat room not found or access denied.",
      });
    }

    const query = {
      chatRoom: roomId,
      deleted: false,
      "mentions.0": { $exists: true }, // Find messages where mentions array is not empty
    };

    const totalMentions = await Message.countDocuments(query);

    const mentions = await Message.find(query)
      .populate("sender", "name profilePhoto role")
      .populate("mentions", "name email profilePhoto role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      pagination: {
        total: totalMentions,
        page,
        limit,
        pages: Math.ceil(totalMentions / limit),
      },
      data: mentions,
    });
  } catch (error) {
    console.error("Get Room Mentions Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch room mentions.",
    });
  }
};

// Search members in a room or globally for @mention suggestions
const searchMentionUsers = async (req, res) => {
  try {
    const roomId = req.body.roomId || req.query.roomId;
    const query = req.body.query || req.query.query || "";

    let searchQuery = { active: true };

    if (roomId && roomId !== "all") {
      const room = await ChatRoom.findById(roomId).select("members");
      if (room && room.members?.length > 0) {
        searchQuery._id = { $in: room.members };
      }
    }

    if (query && query.trim()) {
      searchQuery.$or = [
        { name: { $regex: query.trim(), $options: "i" } },
        { email: { $regex: query.trim(), $options: "i" } },
      ];
    }

    const users = await User.find(searchQuery)
      .select("_id name email profilePhoto role designationRole")
      .limit(10);

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Search Mention Users Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to search users for mentions.",
    });
  }
};

// Send message with mentions
const sendMessageWithMentions = async (req, res) => {
  try {
    const { chatRoom, text, attachments, mentions, replyTo } = req.body;

    if (!chatRoom) {
      return res.status(400).json({
        success: false,
        message: "chatRoom ID is required.",
      });
    }

    const room = await ChatRoom.findById(chatRoom);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Chat room not found.",
      });
    }

    if (room.type === "group" && room.approvalStatus === "Pending") {
      return res.status(403).json({
        success: false,
        message: "Cannot send messages. This community is awaiting Admin approval.",
      });
    }

    // Sanitize and deduplicate mentions array
    const rawMentions = Array.isArray(mentions) ? mentions : [];
    const uniqueMentions = Array.from(
      new Set(rawMentions.map((id) => id.toString()))
    );

    // 1. Create message in database
    const message = await Message.create({
      chatRoom,
      sender: req.user._id,
      text: text || "",
      attachments: attachments || [],
      mentions: uniqueMentions,
      replyTo: replyTo || null,
    });

    // 2. Update room's last message
    await ChatRoom.findByIdAndUpdate(chatRoom, {
      lastMessage: message._id,
    });

    // 3. Fully populate response
    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "name profilePhoto role designationRole department")
      .populate("mentions", "name email profilePhoto role")
      .populate({
        path: "replyTo",
        populate: { path: "sender", select: "name profilePhoto" },
      });

    // 4. Emit Socket events if `io` instance is bound to express app
    const io = getIo();

    if (io) {
      const roomStr = chatRoom.toString();
      io.to(roomStr).emit("receive_message", populatedMessage);

      // Also emit directly to every member of the room so their sidebar updates immediately
      if (Array.isArray(room.members)) {
        room.members.forEach((memberId) => {
          io.to(memberId.toString()).emit("receive_message", populatedMessage);
        });
      }

      uniqueMentions.forEach((mentionedUserId) => {
        if (mentionedUserId !== req.user._id.toString()) {
          io.to(mentionedUserId).emit("mentioned", {
            message: populatedMessage,
            senderName: req.user.name,
          });
        }
      });

      // Send chat notifications to all members except sender
      const senderName = req.user.name || "Someone";
      const previewText = text
        ? text.length > 50
          ? text.substring(0, 50) + "..."
          : text
        : attachments?.length
        ? "Sent an attachment"
        : "Sent a message";
      const roomTitle = room.type === "direct" ? "Direct Message" : room.name || "Community";

      const Notification = require("../models/Notification");
      const { sendInAppNotification } = require("../utils/socket");

      if (Array.isArray(room.members)) {
        for (const memberId of room.members) {
          const mIdStr = (memberId._id || memberId).toString();
          if (mIdStr !== req.user._id.toString()) {
            Notification.create({
              userId: memberId,
              message: `${senderName}${room.type !== "direct" ? ` in ${roomTitle}` : ""}: "${previewText}"`,
              type: "chat",
              chatRoomId: room._id,
            })
              .then((notif) => sendInAppNotification(memberId, notif))
              .catch((err) => console.error("Chat notif save error:", err.message));
          }
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Message sent successfully.",
      data: populatedMessage,
    });
  } catch (error) {
    console.error("Send Message Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to send message.",
    });
  }
};

// Upload Chat Attachment (images, docs, pdfs, max 5MB)
const uploadChatAttachment = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please choose a file to upload.",
      });
    }

    const fileUrl = req.file.path || req.file.secure_url || `/uploads/chat/${req.file.filename}`;

    res.status(200).json({
      success: true,
      file: {
        fileName: req.file.originalname,
        fileUrl,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
      },
    });
  } catch (error) {
    console.error("Upload Chat Attachment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload chat attachment.",
    });
  }
};

// Download chat attachment ensuring exact original filename and format
const downloadAttachment = async (req, res) => {
  try {
    const { url, name } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, message: "Attachment URL is required." });
    }

    const fileName = (name || "attachment").trim();

    // Check if it is a local upload
    if (url.startsWith("/uploads/") || url.includes("/uploads/chat/")) {
      const relativePath = url.startsWith("http")
        ? new URL(url).pathname
        : url;
      const cleanPath = relativePath.replace(/^\//, "");
      const fullPath = path.join(__dirname, "../../", cleanPath);
      if (fs.existsSync(fullPath)) {
        return res.download(fullPath, fileName);
      }
    }

    // Force exact Content-Disposition filename
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);

    // Remote file (Cloudinary, etc.)
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: "Could not fetch attachment." });
    }

    if (response.headers.get("content-type")) {
      res.setHeader("Content-Type", response.headers.get("content-type"));
    }
    Readable.fromWeb(response.body).pipe(res);
  } catch (error) {
    console.error("Download Attachment Error:", error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Failed to download attachment." });
    }
  }
};

module.exports = {
  getRoomMentions,
  getUserMentions,
  getChatRooms,
  createRoom,
  updateRoom,
  createOrGetDirectRoom,
  approveRoom,
  rejectRoom,
  getMessages,
  markRoomRead,
  sendMessage,
  addMember,
  removeMember,
  markMessageRead,
  editMessage,
  deleteMessage,
  pinMessage,
  unpinMessage,
  sendMessageWithMentions,
  searchMentionUsers,
  uploadChatAttachment,
  downloadAttachment,
};