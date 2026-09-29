const express = require('express');
const {
  createRequest,
  getMyRequests,
  deleteMyRequest,
  getAdminRequests,
  getAdminRequestCounts,
  getAdminRequestById,
  approveRequest,
  rejectRequest,
} = require('./announcement.controller');
const { protect, adminOnly } = require('../../middleware/authMiddleware');
const upload = require('../../middleware/uploadMiddleware');

const router = express.Router();

// ==========================================
// USER ROUTES (Base: /api/announcement-requests)
// ==========================================

router.post('/', protect, upload.single('image'), createRequest);
router.get('/my', protect, getMyRequests);
router.delete('/:id', protect, deleteMyRequest);

// ==========================================
// ADMIN ROUTES
// ==========================================

router.get('/admin/counts', protect, adminOnly, getAdminRequestCounts);
router.get('/admin/list', protect, adminOnly, getAdminRequests);
router.get('/admin/:id', protect, adminOnly, getAdminRequestById);
router.post('/admin/:id/approve', protect, adminOnly, approveRequest);
router.post('/admin/:id/reject', protect, adminOnly, rejectRequest);

module.exports = router;
