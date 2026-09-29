const express = require('express');
const {
  adminLogin,
  getAdminMe,
  getAdminPosts,
  getAdminPostById,
  hidePost,
  unhidePost,
  deletePost,
  restorePost,
  getReports,
  getReportById,
  updateReportStatus,
  resolveReport,
  rejectReport,
  takeReportAction,
  getUsers,
  getUserById,
  suspendUser,
  banUser,
  restoreUser,
  getDashboardStats,
} = require('./admin.controller');
const {
  validateAdminLogin,
  validateUpdateReportStatus,
  validateResolveReport,
  validateRejectReport,
  validateTakeReportAction,
  validateSuspendUser,
  validateBanUser,
  validatePostModeration,
} = require('./admin.validate');
const { protect, adminOnly } = require('../../middleware/authMiddleware');

const router = express.Router();

// 24. Admin Authentication
router.post('/login', validateAdminLogin, adminLogin);
router.post('/auth/login', validateAdminLogin, adminLogin);

// All subsequent routes require valid JWT AND admin role
router.use(protect);
router.use(adminOnly);

router.get('/me', getAdminMe);

// 28. Dashboard Statistics
router.get('/dashboard', getDashboardStats);
router.get('/stats', getDashboardStats);

// 25. Admin Rant Management
router.get('/posts', getAdminPosts);
router.get('/posts/:id', getAdminPostById);
router.put('/posts/:id/hide', validatePostModeration, hidePost);
router.put('/posts/:id/unhide', unhidePost);
router.delete('/posts/:id', validatePostModeration, deletePost);
router.put('/posts/:id/restore', restorePost);

// 26. Report Management
router.get('/reports', getReports);
router.get('/reports/:id', getReportById);
router.put('/reports/:id/status', validateUpdateReportStatus, updateReportStatus);
router.put('/reports/:id/resolve', validateResolveReport, resolveReport);
router.put('/reports/:id/reject', validateRejectReport, rejectReport);
router.post('/reports/:id/action', validateTakeReportAction, takeReportAction);

// 27. User Management
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id/suspend', validateSuspendUser, suspendUser);
router.put('/users/:id/ban', validateBanUser, banUser);
router.put('/users/:id/restore', restoreUser);

const {
  getAdminRequests,
  getAdminRequestCounts,
  getAdminRequestById,
  approveRequest,
  rejectRequest,
} = require('../announcement/announcement.controller');

// 29. Announcement Proposals Management
router.get('/announcement-requests/counts', getAdminRequestCounts);
router.get('/announcement-requests', getAdminRequests);
router.get('/announcement-requests/:id', getAdminRequestById);
router.post('/announcement-requests/:id/approve', approveRequest);
router.post('/announcement-requests/:id/reject', rejectRequest);

const {
  getAdminFeedbacks,
  updateFeedbackStatus,
} = require('../feedback/feedback.controller');

// 30. Student Feedback & Feature Suggestions
router.get('/feedback', getAdminFeedbacks);
router.put('/feedback/:id', updateFeedbackStatus);

module.exports = router;
