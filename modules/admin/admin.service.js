const User = require('../../models/User');
const Post = require('../../models/Post');
const Comment = require('../../models/Comment');
const Report = require('../../models/Report');
const generateToken = require('../../utils/generateToken');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 24. Admin Authentication
 */
const adminLogin = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.matchPassword(password))) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  // Separate admin authorization from normal users
  if (user.role !== 'admin') {
    const error = new Error('Access denied: Administrator authorization required');
    error.status = 403;
    throw error;
  }

  if (user.status === 'banned') {
    const error = new Error('This administrator account has been banned');
    error.status = 403;
    throw error;
  }

  if (user.status === 'suspended') {
    const error = new Error('This administrator account has been suspended');
    error.status = 403;
    throw error;
  }

  user.lastActiveAt = new Date();
  await user.save();

  const token = generateToken(user._id);

  return {
    user: user.toPublicJSON(),
    token,
  };
};

/**
 * 25. Admin Rant Management — View rants (active, hidden, deleted, all)
 */
const getAdminPosts = async (
  {
    page = 1,
    limit = 20,
    status = 'all',
    department,
    search,
  } = {},
  currentUserId
) => {
  const validPage = Math.max(parseInt(page, 10) || 1, 1);
  const validLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (validPage - 1) * validLimit;

  const query = {};

  if (status === 'active') {
    query.isHidden = { $ne: true };
    query.isDeleted = { $ne: true };
  } else if (status === 'hidden') {
    query.isHidden = true;
    query.isDeleted = { $ne: true };
  } else if (status === 'deleted') {
    query.isDeleted = true;
  } else if (status === 'official') {
    query.isOfficial = true;
  }

  if (department && typeof department === 'string' && department.trim()) {
    query.department = new RegExp(escapeRegex(department.trim()), 'i');
  }

  if (search && typeof search === 'string' && search.trim()) {
    query.text = new RegExp(escapeRegex(search.trim()), 'i');
  }

  const [posts, total] = await Promise.all([
    Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(validLimit)
      .populate('user', 'name email anonymousUsername department semester role status')
      .populate('moderatedBy', 'name email'),
    Post.countDocuments(query),
  ]);

  const formattedPosts = posts.map((post) => {
    const raw = typeof post.toObject === 'function' ? post.toObject() : post;
    const counts = { '❤️': 0, '💩': 0, '💀': 0 };
    let userReaction = null;
    const reactionsList = Array.isArray(raw.reactions) ? raw.reactions : [];
    for (const r of reactionsList) {
      if (counts[r.emoji] !== undefined) counts[r.emoji] += 1;
      if (
        currentUserId &&
        r.user &&
        (r.user._id ? r.user._id.toString() : r.user.toString()) === currentUserId.toString() &&
        counts[r.emoji] !== undefined
      ) {
        userReaction = r.emoji;
      }
    }
    return {
      ...raw,
      reactions: {
        counts,
        total: reactionsList.length,
        userReaction,
      },
    };
  });

  return {
    posts: formattedPosts,
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      pages: Math.ceil(total / validLimit),
    },
  };
};

const getAdminPostById = async (postId, currentUserId) => {
  const post = await Post.findById(postId)
    .populate('user', 'name email anonymousUsername department semester role status')
    .populate('moderatedBy', 'name email');

  if (!post) {
    const error = new Error('Post not found');
    error.status = 404;
    throw error;
  }

  const raw = typeof post.toObject === 'function' ? post.toObject() : post;
  const counts = { '❤️': 0, '💩': 0, '💀': 0 };
  let userReaction = null;
  const reactionsList = Array.isArray(raw.reactions) ? raw.reactions : [];
  for (const r of reactionsList) {
    if (counts[r.emoji] !== undefined) counts[r.emoji] += 1;
    if (
      currentUserId &&
      r.user &&
      (r.user._id ? r.user._id.toString() : r.user.toString()) === currentUserId.toString() &&
      counts[r.emoji] !== undefined
    ) {
      userReaction = r.emoji;
    }
  }

  return {
    ...raw,
    reactions: {
      counts,
      total: reactionsList.length,
      userReaction,
    },
  };
};

/**
 * Hide a rant
 */
const hidePost = async (postId, adminId, reason = '') => {
  const post = await Post.findById(postId);
  if (!post) {
    const error = new Error('Post not found');
    error.status = 404;
    throw error;
  }

  post.isHidden = true;
  post.hiddenAt = new Date();
  post.moderatedBy = adminId;
  post.moderationReason = reason || 'Hidden by administrator';
  await post.save();

  return post;
};

/**
 * Unhide a rant
 */
const unhidePost = async (postId, adminId) => {
  const post = await Post.findById(postId);
  if (!post) {
    const error = new Error('Post not found');
    error.status = 404;
    throw error;
  }

  post.isHidden = false;
  post.hiddenAt = null;
  post.moderatedBy = adminId;
  await post.save();

  return post;
};

/**
 * Delete a rant (soft delete with moderation record)
 */
const deletePostAdmin = async (postId, adminId, reason = '') => {
  const post = await Post.findById(postId);
  if (!post) {
    const error = new Error('Post not found');
    error.status = 404;
    throw error;
  }

  post.isDeleted = true;
  post.deletedAt = new Date();
  post.moderatedBy = adminId;
  post.moderationReason = reason || 'Deleted by administrator';
  await post.save();

  return post;
};

/**
 * Restore a hidden or deleted rant
 */
const restorePostAdmin = async (postId, adminId) => {
  const post = await Post.findById(postId);
  if (!post) {
    const error = new Error('Post not found');
    error.status = 404;
    throw error;
  }

  post.isDeleted = false;
  post.isHidden = false;
  post.deletedAt = null;
  post.hiddenAt = null;
  post.moderatedBy = adminId;
  post.moderationReason = '';
  await post.save();

  return post;
};

/**
 * 26. Report Management — View reports, assign status, resolve, reject, take action
 */
const getReports = async ({
  page = 1,
  limit = 20,
  status,
  targetType,
} = {}) => {
  const validPage = Math.max(parseInt(page, 10) || 1, 1);
  const validLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (validPage - 1) * validLimit;

  const query = {};
  if (status && ['pending', 'investigating', 'resolved', 'rejected'].includes(status)) {
    query.status = status;
  }
  if (targetType && ['post', 'comment', 'user'].includes(targetType)) {
    query.targetType = targetType;
  }

  const [reports, total] = await Promise.all([
    Report.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(validLimit)
      .populate('reporter', 'name email anonymousUsername')
      .populate('reviewedBy', 'name email')
      .populate('post', 'text department isAnonymous isHidden isDeleted')
      .populate('comment', 'text')
      .populate('reportedUser', 'name email status role'),
    Report.countDocuments(query),
  ]);

  return {
    reports,
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      pages: Math.ceil(total / validLimit),
    },
  };
};

const getReportById = async (reportId) => {
  const report = await Report.findById(reportId)
    .populate('reporter', 'name email anonymousUsername')
    .populate('reviewedBy', 'name email')
    .populate('post')
    .populate('comment')
    .populate('reportedUser', 'name email status role');

  if (!report) {
    const error = new Error('Report not found');
    error.status = 404;
    throw error;
  }

  return report;
};

/**
 * Assign status to report (pending, investigating, resolved, rejected)
 */
const updateReportStatus = async (reportId, adminId, status, notes = '') => {
  const report = await Report.findById(reportId);
  if (!report) {
    const error = new Error('Report not found');
    error.status = 404;
    throw error;
  }

  report.status = status;
  report.reviewedBy = adminId;
  report.reviewedAt = new Date();
  if (notes) report.actionNotes = notes;
  await report.save();

  return report;
};

/**
 * Resolve report
 */
const resolveReport = async (reportId, adminId, { actionTaken = 'dismissed', notes = '' } = {}) => {
  const report = await Report.findById(reportId);
  if (!report) {
    const error = new Error('Report not found');
    error.status = 404;
    throw error;
  }

  report.status = 'resolved';
  report.actionTaken = actionTaken;
  report.actionNotes = notes;
  report.reviewedBy = adminId;
  report.reviewedAt = new Date();
  await report.save();

  return report;
};

/**
 * Reject report
 */
const rejectReport = async (reportId, adminId, notes = '') => {
  const report = await Report.findById(reportId);
  if (!report) {
    const error = new Error('Report not found');
    error.status = 404;
    throw error;
  }

  report.status = 'rejected';
  report.actionTaken = 'dismissed';
  report.actionNotes = notes || 'Report rejected by moderator';
  report.reviewedBy = adminId;
  report.reviewedAt = new Date();
  await report.save();

  return report;
};

/**
 * Take moderation action directly from a report
 */
const takeReportAction = async (reportId, adminId, { action, reason = '', durationDays = 7, notes = '' }) => {
  const report = await Report.findById(reportId);
  if (!report) {
    const error = new Error('Report not found');
    error.status = 404;
    throw error;
  }

  let actionResult = null;

  if (action === 'hide_post') {
    const targetPostId = report.post || (report.targetType === 'post' ? report.targetId : null);
    if (!targetPostId) {
      const error = new Error('Report does not reference a valid post to hide');
      error.status = 400;
      throw error;
    }
    actionResult = await hidePost(targetPostId, adminId, reason || report.reason);
  } else if (action === 'delete_post') {
    const targetPostId = report.post || (report.targetType === 'post' ? report.targetId : null);
    if (!targetPostId) {
      const error = new Error('Report does not reference a valid post to delete');
      error.status = 400;
      throw error;
    }
    actionResult = await deletePostAdmin(targetPostId, adminId, reason || report.reason);
  } else if (action === 'suspend_user') {
    let targetUserId = report.reportedUser || (report.targetType === 'user' ? report.targetId : null);
    if (!targetUserId) {
      // Find author from post or comment
      if (report.post) {
        const post = await Post.findById(report.post);
        if (post) targetUserId = post.user;
      } else if (report.comment) {
        const comment = await Comment.findById(report.comment);
        if (comment) targetUserId = comment.user;
      }
    }
    if (!targetUserId) {
      const error = new Error('Cannot determine user to suspend from this report');
      error.status = 400;
      throw error;
    }
    actionResult = await suspendUser(targetUserId, adminId, { reason: reason || report.reason, durationDays });
  } else if (action === 'ban_user') {
    let targetUserId = report.reportedUser || (report.targetType === 'user' ? report.targetId : null);
    if (!targetUserId) {
      if (report.post) {
        const post = await Post.findById(report.post);
        if (post) targetUserId = post.user;
      } else if (report.comment) {
        const comment = await Comment.findById(report.comment);
        if (comment) targetUserId = comment.user;
      }
    }
    if (!targetUserId) {
      const error = new Error('Cannot determine user to ban from this report');
      error.status = 400;
      throw error;
    }
    actionResult = await banUser(targetUserId, adminId, { reason: reason || report.reason });
  }

  // Update report
  report.status = 'resolved';
  report.actionTaken = action === 'dismiss' ? 'dismissed' : (action.includes('hide') ? 'hidden' : (action.includes('delete') ? 'deleted' : (action.includes('suspend') ? 'user_suspended' : 'user_banned')));
  report.actionNotes = notes || reason || `Action executed: ${action}`;
  report.reviewedBy = adminId;
  report.reviewedAt = new Date();
  await report.save();

  return {
    report,
    actionResult,
  };
};

/**
 * 27. User Management — View users, suspend user, ban user, restore user
 */
const getUsers = async ({
  page = 1,
  limit = 20,
  status,
  role,
  search,
} = {}) => {
  const validPage = Math.max(parseInt(page, 10) || 1, 1);
  const validLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (validPage - 1) * validLimit;

  const query = {};
  if (status && ['active', 'suspended', 'banned'].includes(status)) {
    query.status = status;
  }
  if (role && ['user', 'admin'].includes(role)) {
    query.role = role;
  }

  if (search && typeof search === 'string' && search.trim()) {
    const sRegex = new RegExp(escapeRegex(search.trim()), 'i');
    query.$or = [
      { name: sRegex },
      { email: sRegex },
      { anonymousUsername: sRegex },
      { department: sRegex },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(validLimit)
      .select('-password'),
    User.countDocuments(query),
  ]);

  return {
    users,
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      pages: Math.ceil(total / validLimit),
    },
  };
};

const getUserById = async (userId) => {
  const user = await User.findById(userId).select('-password');
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  const [postsCount, commentsCount, reportsAgainstUser] = await Promise.all([
    Post.countDocuments({ user: userId }),
    Comment.countDocuments({ user: userId }),
    Report.countDocuments({ reportedUser: userId }),
  ]);

  return {
    user,
    stats: {
      postsCount,
      commentsCount,
      reportsAgainstUser,
    },
  };
};

/**
 * Suspend user
 */
const suspendUser = async (userId, adminId, { reason, durationDays = 7 }) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  if (user.role === 'admin') {
    const error = new Error('Cannot suspend another administrator');
    error.status = 400;
    throw error;
  }

  const suspendedUntil = new Date(Date.now() + Math.max(durationDays, 1) * 24 * 60 * 60 * 1000);
  user.status = 'suspended';
  user.suspendedUntil = suspendedUntil;
  user.suspensionReason = reason;
  await user.save();

  return user;
};

/**
 * Ban user
 */
const banUser = async (userId, adminId, { reason }) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  if (user.role === 'admin') {
    const error = new Error('Cannot ban another administrator');
    error.status = 400;
    throw error;
  }

  user.status = 'banned';
  user.suspendedUntil = null;
  user.suspensionReason = reason;
  await user.save();

  return user;
};

/**
 * Restore user
 */
const restoreUser = async (userId, adminId) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  user.status = 'active';
  user.suspendedUntil = null;
  user.suspensionReason = '';
  await user.save();

  return user;
};

/**
 * 28. Dashboard Statistics
 * Total Users, Total Rants, Total Comments, Total Reactions, Today's Rants, Today's Active Users, Pending Reports
 */
const getDashboardStats = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalRants,
    totalComments,
    reactionAggregation,
    todayRants,
    postsUserIds,
    commentsUserIds,
    activeByTimeUsersCount,
    pendingReports,
  ] = await Promise.all([
    // 1. Total Users
    User.countDocuments({}),
    // 2. Total Rants (all rants)
    Post.countDocuments({}),
    // 3. Total Comments
    Comment.countDocuments({}),
    // 4. Total Reactions across all rants
    Post.aggregate([
      {
        $project: {
          reactionCount: { $size: { $ifNull: ['$reactions', []] } },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$reactionCount' },
        },
      },
    ]),
    // 5. Today's Rants
    Post.countDocuments({ createdAt: { $gte: startOfDay } }),
    // 6. Today's Active Users (distinct users posting or commenting today, or with recent activity)
    Post.distinct('user', { createdAt: { $gte: startOfDay } }),
    Comment.distinct('user', { createdAt: { $gte: startOfDay } }),
    User.countDocuments({ lastActiveAt: { $gte: startOfDay } }),
    // 7. Pending Reports
    Report.countDocuments({ status: 'pending' }),
  ]);

  const totalReactions = reactionAggregation[0]?.total || 0;

  const todayActiveUserIds = new Set([
    ...postsUserIds.map((id) => id.toString()),
    ...commentsUserIds.map((id) => id.toString()),
  ]);
  const todayActiveUsers = Math.max(todayActiveUserIds.size, activeByTimeUsersCount);

  return {
    totalUsers,
    totalRants,
    totalComments,
    totalReactions,
    todayRants,
    todayActiveUsers,
    pendingReports,
  };
};

module.exports = {
  adminLogin,
  getAdminPosts,
  getAdminPostById,
  hidePost,
  unhidePost,
  deletePostAdmin,
  restorePostAdmin,
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
};
