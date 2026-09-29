const Report = require('../../models/Report');
const Post = require('../../models/Post');
const Comment = require('../../models/Comment');
const User = require('../../models/User');

/**
 * Submit a new report against a post, comment, or user
 */
const createReport = async ({ reporterId, targetType, targetId, reason, description }) => {
  // 1. Verify target exists
  let postRef = null;
  let commentRef = null;
  let userRef = null;

  if (targetType === 'post') {
    const post = await Post.findById(targetId);
    if (!post) {
      const error = new Error('Post not found');
      error.status = 404;
      throw error;
    }
    postRef = post._id;
  } else if (targetType === 'comment') {
    const comment = await Comment.findById(targetId);
    if (!comment) {
      const error = new Error('Comment not found');
      error.status = 404;
      throw error;
    }
    commentRef = comment._id;
  } else if (targetType === 'user') {
    const user = await User.findById(targetId);
    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      throw error;
    }
    userRef = user._id;
  }

  // 2. Prevent duplicate pending report from same reporter for same target
  const existingPending = await Report.findOne({
    reporter: reporterId,
    targetId,
    status: 'pending',
  });

  if (existingPending) {
    const error = new Error('You have already submitted a pending report for this item');
    error.status = 400;
    throw error;
  }

  // 3. Create report
  const report = await Report.create({
    reporter: reporterId,
    targetType,
    targetId,
    post: postRef,
    comment: commentRef,
    reportedUser: userRef,
    reason,
    description: description || '',
    status: 'pending',
  });

  return report;
};

/**
 * Get reports submitted by the authenticated user
 */
const getMyReports = async (reporterId, { page = 1, limit = 20 } = {}) => {
  const validPage = Math.max(parseInt(page, 10) || 1, 1);
  const validLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (validPage - 1) * validLimit;

  const [reports, total] = await Promise.all([
    Report.find({ reporter: reporterId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(validLimit)
      .populate('post', 'text department isAnonymous')
      .populate('comment', 'text')
      .populate('reportedUser', 'name anonymousUsername'),
    Report.countDocuments({ reporter: reporterId }),
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

module.exports = {
  createReport,
  getMyReports,
};
