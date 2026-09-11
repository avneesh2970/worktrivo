const express = require("express");
const router = express.Router();

const {
  getChatRooms,
  getMessages,
  createRoom,
  createOrGetDirectRoom,
  approveRoom,
  rejectRoom,
  markRoomRead,
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
  sendMessageWithMentions,
  uploadChatAttachment,
} = require("../controllers/chatController");

const { authenticate, requireRole } = require("../middleware/auth");
const { uploadChatAttachmentMulter } = require("../config/chatFileUpload");

// Upload chat attachment (max 5 MB)
router.post(
  "/upload",
  authenticate,
  (req, res, next) => {
    uploadChatAttachmentMulter.single("file")(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: "File size exceeds the 5 MB limit. Please select a file smaller than 5 MB.",
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || "Failed to upload file.",
        });
      }
      next();
    });
  },
  uploadChatAttachment
);

// Chat Rooms
router.get("/rooms", authenticate, getChatRooms);
router.post("/rooms", authenticate, createRoom);
router.post("/direct", authenticate, createOrGetDirectRoom);
router.patch("/rooms/:roomId/approve", authenticate, requireRole(["admin"]), approveRoom);
router.patch("/rooms/:roomId/reject", authenticate, requireRole(["admin"]), rejectRoom);
router.patch("/rooms/:roomId/read", authenticate, markRoomRead);

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