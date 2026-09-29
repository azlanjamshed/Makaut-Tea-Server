const asyncHandler = require('../../middleware/asyncHandler');
const notificationService = require('./notification.service');

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.getNotifications(req.user._id, {
    page: req.query.page,
    limit: req.query.limit,
    unreadOnly: req.query.unreadOnly === 'true',
  });

  res.json({
    success: true,
    data: result.notifications,
    unreadCount: result.unreadCount,
    pagination: result.pagination,
  });
});

// @desc    Get unread notification count
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user._id);
  res.json({
    success: true,
    count,
  });
});

// @desc    Mark a notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
const markAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markAsRead(req.params.id, req.user._id);
  res.json({
    success: true,
    data: notification,
  });
});

// @desc    Mark all user notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private
const markAllAsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllAsRead(req.user._id);
  res.json({
    success: true,
    message: 'All notifications marked as read',
    data: result,
  });
});

// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res) => {
  const result = await notificationService.deleteNotification(req.params.id, req.user._id);
  res.json({
    success: true,
    message: result.message,
  });
});

// @desc    Clear all notifications
// @route   DELETE /api/notifications
// @access  Private
const clearAllNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.clearAllNotifications(req.user._id);
  res.json({
    success: true,
    message: 'All notifications cleared',
    data: result,
  });
});

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
};
