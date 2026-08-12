const express = require('express');
const router = express.Router();
const multer = require('multer');

const userController = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/auth');
const { upload } = require('../config/cloudinary'); // Cloudinary for Profile Photos

// Local Multer setup for CSV handling (stores file in memory, not disk)
const uploadMemory = multer({ storage: multer.memoryStorage() });

// PUBLIC ROUTES
router.post('/send-reset-otp', userController.sendResetOtp);
router.post('/reset-password', userController.resetPassword);
router.post('/register', userController.registerUser);

// PROTECTED ROUTES
router.use(authenticate);

// Profile Routes
router.get('/profile', userController.getProfile);
router.put('/profile', upload.single('profilePhoto'), userController.updateProfile);

// notification mute
router.patch(
  "/notification-mute",
  userController.toggleNotificationMute
);


// User List
router.get('/', userController.getUsers);

// ADMIN ROUTES
router.use(requireRole('admin'));

// Bulk CSV Import Route
router.post('/bulk-import', uploadMemory.single('csvFile'), userController.bulkImportUsers);

// Standard Admin User Routes
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.patch('/:id/toggle-active', userController.toggleUserActive);

module.exports = router;