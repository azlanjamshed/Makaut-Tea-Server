const express = require('express');
const {
  getUserById,
  searchUsers,
  updateMyProfile,
  deleteMyAccount,
} = require('./user.controller');
const { validateUpdateProfile } = require('./user.validate');
const { protect, optionalAuth } = require('../../middleware/authMiddleware');
const upload = require('../../middleware/uploadMiddleware');

const router = express.Router();

// NOTE: /search and /me routes are defined before /:id so they are not treated as an id
router.get('/search', optionalAuth, searchUsers);
router.put('/me', protect, upload.single('image'), validateUpdateProfile, updateMyProfile);
router.delete('/me', protect, deleteMyAccount);
router.get('/:id', optionalAuth, getUserById);

module.exports = router;
