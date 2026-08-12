const ChatRoom = require("../models/ChatRoom");
const User = require("../models/User");         // Make sure to import the User model
const Message = require("../models/Message");
const { getIo } = require("../utils/socket");

const getChatRooms = async (req, res) => {
  try {
    const userId = req.user._id;

    const rooms = await ChatRoom.find({
      members: userId,
      isActive: true,
    })
      .populate("members", "name email profilePhoto role")
      .populate("admins", "name email profilePhoto")
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: rooms,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch chat rooms.",
    });
  }
};

// Create new room
const createRoom = async (req, res) => {
  try {
    const { name, description, members, type, group } = req.body;

    

    const room = await ChatRoom.create({
      name,
      description,
      type: type || "group",
      group: group || null,
      members,
      admins: [req.user._id],
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: "Chat room created successfully.",
      data: room,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to create chat room.",
    });
  }
};

// Get messages
const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;

    const messages = await Message.find({
      chatRoom: roomId,
      deleted: false,
    })
      .populate("sender", "name profilePhoto role")
      .populate("mentions", "name")
      .populate("replyTo")
      .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch messages.",
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

// Delete Message
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
    }

    // Check ownership
    if (!message.sender.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this message.",
      });
    }

    // Prevent deleting twice
    if (message.deleted) {
      return res.status(400).json({
        success: false,
        message: "Message is already deleted.",
      });
    }

    message.deleted = true;
    message.deletedAt = new Date();

    await message.save();

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Message Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete message.",
    });
  }
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
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
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
    );

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found.",
      });
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
    // 1. Read roomId and query from req.body (with fallback to req.query if needed)
    const roomId = req.body.roomId || req.query.roomId;
    const query = req.body.query || req.query.query;

    // 2. Validate roomId
    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: "roomId is required to search mention users.",
      });
    }

    // 3. Find room and fetch member IDs
    const room = await ChatRoom.findById(roomId).select("members");

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Chat room not found.",
      });
    }

    // Build Mongoose search query restricted ONLY to room members
    const searchQuery = {
      _id: { $in: room.members },
    };

    // 4. Filter by search string (name or email) if query text is provided
    if (query && query.trim()) {
      searchQuery.$or = [
        { name: { $regex: query.trim(), $options: "i" } },
        { email: { $regex: query.trim(), $options: "i" } },
      ];
    }

    // 5. Fetch up to 10 matching members
    const users = await User.find(searchQuery)
      .select("_id name email profilePhoto role")
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
      .populate("sender", "name profilePhoto role")
      .populate("mentions", "name email profilePhoto role")
      .populate({
        path: "replyTo",
        populate: { path: "sender", select: "name profilePhoto" },
      });

    // 4. Emit Socket events if `io` instance is bound to express app
    const io = getIo();

    if (io) {
      io.to(chatRoom).emit("receive_message", populatedMessage);

      uniqueMentions.forEach((mentionedUserId) => {
        if (mentionedUserId !== req.user._id.toString()) {
          io.to(mentionedUserId).emit("mentioned", {
            message: populatedMessage,
            senderName: req.user.name,
          });
        }
      });
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

module.exports = {
  getRoomMentions,
  getUserMentions,
  getChatRooms,
  createRoom,
  getMessages,
  sendMessage,
  addMember,
  removeMember,
  markMessageRead,
  editMessage,
  deleteMessage,
  pinMessage,
  unpinMessage,
  sendMessageWithMentions,
  searchMentionUsers
};