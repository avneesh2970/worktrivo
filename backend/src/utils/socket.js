const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const Message = require("../models/Message");
const ChatRoom = require("../models/ChatRoom");

let io;

// userId -> socket.id
const onlineUsers = new Map();

const init = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "companysecretkey123"
      );

      socket.userId = decoded.userId;
      socket.role = decoded.role;

      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;
    const role = socket.role;

    console.log(`Socket Connected : ${userId}`);

    // Save online user mapping
    onlineUsers.set(userId.toString(), socket.id);

    // Personal socket room for direct notifications (e.g., mentions)
    socket.join(userId.toString());

    // Admin & Manager management room
    if (role === "admin" || role === "manager") {
      socket.join("admins");
      socket.join("managers");
    }

    // Broadcast online status
    io.emit("user_online", { userId });

    // Join chat room
    socket.on("join_room", async (roomId) => {
      console.log("Join room:", roomId);
      try {
        const room = await ChatRoom.findById(roomId);
        if (!room) return;

        // Admin can join any room; otherwise user must be a member or creator
        const allowed =
          role === "admin" ||
          room.members.some(
            (member) => member.toString() === userId.toString()
          ) ||
          (room.createdBy && room.createdBy.toString() === userId.toString());

        if (!allowed) return;

        socket.join(roomId);
        socket.emit("joined_room", roomId);
      } catch (err) {
        console.error("Error joining room:", err);
      }
    });

    // Leave room
    socket.on("leave_room", (roomId) => {
      socket.leave(roomId);
    });

    // Typing handlers
    socket.on("typing", ({ roomId, user }) => {
      socket.to(roomId).emit("typing", { user });
    });

    socket.on("stop_typing", ({ roomId, user }) => {
      socket.to(roomId).emit("stop_typing", { userId, user });
    });

    // Send Message
    socket.on("send_message", async (data) => {
      try {
        const room = await ChatRoom.findById(data.chatRoom);
        if (!room) return;

        // Block messages if community is pending approval
        if (room.type === "group" && room.approvalStatus === "Pending") {
          socket.emit("error_message", {
            message: "Cannot send message. This community is awaiting Admin approval.",
          });
          return;
        }

        // Sanitize and unique mention IDs
        const rawMentions = Array.isArray(data.mentions) ? data.mentions : [];
        const uniqueMentions = Array.from(new Set(rawMentions.map((id) => id.toString())));

        const message = await Message.create({
          chatRoom: data.chatRoom,
          sender: userId,
          text: data.text || "",
          attachments: data.attachments || [],
          mentions: uniqueMentions,
          replyTo: data.replyTo || null,
        });

        // Populate fields for real-time frontend consumption
        await message.populate("sender", "name profilePhoto role designationRole department");
        await message.populate("mentions", "name email");
        if (message.replyTo) {
          await message.populate("replyTo");
        }

        await ChatRoom.findByIdAndUpdate(data.chatRoom, {
          lastMessage: message._id,
        });

        // Broadcast to chat room
        io.to(data.chatRoom).emit("receive_message", message);

        // Send direct mention notifications (Exclude the sender if self-mentioned)
        uniqueMentions.forEach((mentionedUserId) => {
          if (mentionedUserId !== userId.toString()) {
            io.to(mentionedUserId).emit("mentioned", {
              message,
              senderName: message.sender?.name || "Someone",
            });
          }
        });
      } catch (err) {
        console.error("Error sending message:", err);
      }
    });

    // Read receipt
    socket.on("mark_read", async ({ messageId }) => {
      try {
        const message = await Message.findById(messageId);

        if (!message) return;

        const alreadyRead = message.readBy.some(
          (item) => item.user.toString() === userId.toString()
        );

        if (!alreadyRead) {
          message.readBy.push({
            user: userId,
            readAt: new Date(),
          });

          await message.save();

          io.to(message.chatRoom.toString()).emit("message_read", {
            messageId,
            userId,
          });
        }
      } catch (err) {
        console.error("Error marking message as read:", err);
      }
    });

    // Pin message
    socket.on("pin_message", async ({ messageId }) => {
      try {
        const message = await Message.findByIdAndUpdate(
          messageId,
          { pinned: true },
          { new: true }
        )
          .populate("sender", "name profilePhoto role")
          .populate("mentions", "name email");

        if (!message) return;

        io.to(message.chatRoom.toString()).emit("message_pinned", message);
      } catch (err) {
        console.error("Error pinning message:", err);
      }
    });

    // Delete message (Disabled as per policy)
    socket.on("delete_message", async () => {
      socket.emit("error", { message: "Deleting messages is not permitted." });
    });

    // Edit message (Updates text & mentions - allowed within 5 minutes only)
    socket.on("edit_message", async ({ messageId, text, mentions = [] }) => {
      try {
        const message = await Message.findById(messageId);

        if (!message) return;

        // Author check
        if (message.sender.toString() !== userId.toString()) {
          return;
        }

        // 5-minute edit window check
        const EDIT_WINDOW_MS = 5 * 60 * 1000;
        const messageAge = Date.now() - new Date(message.createdAt).getTime();
        if (messageAge > EDIT_WINDOW_MS) {
          socket.emit("error", { message: "Messages can only be edited within 5 minutes of sending." });
          return;
        }

        const uniqueMentions = Array.from(new Set(mentions.map((id) => id.toString())));

        message.text = text;
        message.mentions = uniqueMentions;
        message.edited = true;
        message.editedAt = new Date();

        await message.save();
        await message.populate("sender", "name profilePhoto role");
        await message.populate("mentions", "name email");

        io.to(message.chatRoom.toString()).emit("message_updated", message);

        // Notify newly mentioned users on edit
        uniqueMentions.forEach((mentionedUserId) => {
          if (mentionedUserId !== userId.toString()) {
            io.to(mentionedUserId).emit("mentioned", {
              message,
              senderName: message.sender?.name || "Someone",
            });
          }
        });
      } catch (err) {
        console.error("Error editing message:", err);
      }
    });

    // Disconnect
    socket.on("disconnect", async () => {
      console.log(`Socket Disconnected : ${userId}`);

      onlineUsers.delete(userId.toString());

      await User.findByIdAndUpdate(userId, {
        lastSeen: new Date(),
      });

      io.emit("user_offline", {
        userId,
        lastSeen: new Date(),
      });
    });
  });

  return io;
};

// Helper notification emitters
const sendInAppNotification = async (userId, notification) => {
  if (!io) return;

  const user = await User.findById(userId).select("notificationMuted");

if (!user) return;

// Agar notifications OFF hain
if (user.notificationMuted) {
    console.log(`🔕 Notification muted for user ${userId}`);
    return;
}

io.to(userId.toString()).emit("notification", notification);
};

const sendAdminNotification = (notification) => {
  if (!io) return;
  io.to("admins").emit("notification", notification);
};

// Notifies a specific user (and all connected admins) that one of their
// tasks changed, so any open Task/Kanban/Calendar view can refresh live.
const sendTaskUpdate = (userId, taskId) => {
  if (!io) return;
  if (userId) {
    io.to(userId.toString()).emit("taskUpdated", { taskId });
  }
  io.to("admins").emit("taskUpdated", { taskId });
  io.emit("taskUpdated", { taskId });
};

const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};

const isUserOnline = (userId) => {
  return onlineUsers.has(userId.toString());
};

module.exports = {
  init,
  getIo: () => io,
  sendInAppNotification,
  sendAdminNotification,
  sendTaskUpdate,
  getOnlineUsers,
  isUserOnline,
};
