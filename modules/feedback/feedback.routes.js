const express = require('express');
const {
  submitFeedback,
  getMyFeedback,
  getAdminFeedbacks,
  updateFeedbackStatus,
} = require('./feedback.controller');
const { protect, optionalAuth, adminOnly } = require('../../middleware/authMiddleware');
const upload = require('../../middleware/uploadMiddleware');

const router = express.Router();

router.post('/', optionalAuth, upload.single('image'), submitFeedback);
router.get('/my', protect, getMyFeedback);

// Admin routes
router.get('/admin', protect, adminOnly, getAdminFeedbacks);
router.put('/admin/:id', protect, adminOnly, updateFeedbackStatus);

module.exports = router;
