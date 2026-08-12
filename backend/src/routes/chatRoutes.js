const express = require("express");
const router = express.Router();

const {
  getChatRooms,
  getMessages,
  createRoom,
  sendMessage,
  addMember,
  removeMember,
  markMessageRead,
  editMessage,
  deleteMessage,
  pinMessage,
  unpinMessage,
  getRoomMentions,
  getUserMentions,
  searchMentionUsers,
  sendMessageWithMentions
} = require("../controllers/chatController");

const { authenticate } = require("../middleware/auth");

// Chat Rooms
router.get("/rooms", authenticate, getChatRooms);
router.post("/rooms", authenticate, createRoom);

// Messages
router.get("/:roomId/messages", authenticate, getMessages);
router.post("/send", authenticate, sendMessage);

// Room Members
router.post("/:roomId/add-member", authenticate, addMember);
router.delete("/:roomId/remove-member/:userId", authenticate, removeMember);

// Message Actions
router.patch("/message/:messageId/read", authenticate, markMessageRead);
router.patch("/message/:messageId/edit", authenticate, editMessage);

router.patch("/message/:messageId/pin", authenticate, pinMessage);
router.patch("/message/:messageId/unpin", authenticate, unpinMessage);

router.delete("/message/:messageId", authenticate, deleteMessage);

// Get all mentions for current user
router.get("/mentions", authenticate, getUserMentions);

// Get all mentions inside a specific room
router.get("/rooms/:roomId/mentions", authenticate, getRoomMentions);

// Switch to router.post to allow receiving JSON body
router.post("/users/search", authenticate, searchMentionUsers);

// Send message with mentions array
router.post("/messages", authenticate, sendMessageWithMentions);

module.exports = router;