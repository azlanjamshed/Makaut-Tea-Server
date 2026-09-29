const Notification = require('../../models/Notification');
const Post = require('../../models/Post');
const User = require('../../models/User');

/**
 * Helper to safely create a notification without interrupting the calling workflow
 */
const createNotification = async ({
  recipient,
  sender = null,
  type,
  post = null,
  comment = null,
  reactionEmoji = '',
  message,
  isAnonymous = false,
}) => {
  if (!recipient) return null;

  // Never notify user of their own actions
  if (sender && sender.toString() === recipient.toString()) {
    return null;
  }

  // Prevent duplicate reaction notifications for same post & sender
  if (type === 'reaction') {
    const existing = await Notification.findOne({
      recipient,
      sender,
      type: 'reaction',
      post,
    });
    if (existing) {
      existing.reactionEmoji = reactionEmoji;
      existing.message = message;
      existing.isRead = false;
      existing.readAt = null;
      await existing.save();
      return existing;
    }
  }

  const notification = await Notification.create({
    recipient,
    sender,
    type,
    post,
    comment,
    reactionEmoji,
    message,
    isAnonymous: Boolean(isAnonymous),
  });

  return notification;
};

/**
 * Check if a post has reached trending engagement and notify the author
 */
const checkAndNotifyTrending = async (postOrId) => {
  const post = typeof postOrId === 'object' && postOrId._id
    ? postOrId
    : await Post.findById(postOrId);

  if (!post || post.trendingNotified || post.isHidden || post.isDeleted) {
    return null;
  }

  const totalReactions = Array.isArray(post.reactions) ? post.reactions.length : 0;
  const totalComments = post.commentsCount || 0;
  const totalEngagement = totalReactions + totalComments;

  // Engagement threshold to qualify as trending (e.g., at least 2 reactions/comments)
  if (totalEngagement >= 2) {
    post.trendingNotified = true;
    await Post.updateOne({ _id: post._id }, { $set: { trendingNotified: true } });

    const snippet = post.text.length > 40 ? `${post.text.substring(0, 37)}...` : post.text;
    const notification = await createNotification({
      recipient: post.user,
      sender: null,
      type: 'trending',
      post: post._id,
      message: `🔥 Your rant "${snippet}" is now trending!`,
    });

    return notification;
  }

  return null;
};

/**
 * Get paginated list of notifications for a user
 */
const getNotifications = async (userId, { page = 1, limit = 20, unreadOnly = false } = {}) => {
  const validPage = Math.max(parseInt(page, 10) || 1, 1);
  const validLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (validPage - 1) * validLimit;

  const query = { recipient: userId };
  if (unreadOnly) {
    query.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(validLimit)
      .populate('sender', 'name image anonymousUsername')
      .populate('post', 'text department isAnonymous')
      .populate('comment', 'text'),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: userId, isRead: false }),
  ]);

  return {
    notifications: notifications.map((n) => n.toPublicJSON()),
    unreadCount,
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      pages: Math.ceil(total / validLimit) || 1,
    },
  };
};

/**
 * Get quick count of unread notifications
 */
const getUnreadCount = async (userId) => {
  const count = await Notification.countDocuments({ recipient: userId, isRead: false });
  return count;
};

/**
 * Mark a single notification as read
 */
const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: userId,
  });

  if (!notification) {
    const error = new Error('Notification not found');
    error.status = 404;
    throw error;
  }

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  return notification.toPublicJSON();
};

/**
 * Mark all notifications for a user as read
 */
const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return {
    success: true,
    modifiedCount: result.modifiedCount,
  };
};

/**
 * Delete a specific notification
 */
const deleteNotification = async (notificationId, userId) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: userId,
  });

  if (!notification) {
    const error = new Error('Notification not found');
    error.status = 404;
    throw error;
  }

  await notification.deleteOne();
  return { success: true, message: 'Notification deleted' };
};

/**
 * Clear all notifications for a user
 */
const clearAllNotifications = async (userId) => {
  const result = await Notification.deleteMany({ recipient: userId });
  return {
    success: true,
    deletedCount: result.deletedCount,
  };
};

module.exports = {
  createNotification,
  checkAndNotifyTrending,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
};
