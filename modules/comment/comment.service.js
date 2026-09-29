const Comment = require('../../models/Comment');
const Post = require('../../models/Post');
const { createNotification, checkAndNotifyTrending } = require('../notification/notification.service');

/**
 * Add a comment to a post
 */
const addComment = async ({ postId, userId, text, isAnonymous, department, semester }) => {
  const post = await Post.findById(postId);
  if (!post) {
    const error = new Error('Post not found');
    error.status = 404;
    throw error;
  }

  const comment = await Comment.create({
    post: postId,
    user: userId,
    text,
    isAnonymous: Boolean(isAnonymous),
    department: department || '',
    semester: semester || '',
  });

  await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });
  await comment.populate('user', 'name image anonymousUsername department semester role');

  // Trigger notification for post author if different user
  if (post.user && post.user.toString() !== userId.toString()) {
    const senderName = isAnonymous
      ? (comment.user?.anonymousUsername || 'Someone')
      : (comment.user?.name || 'A student');
    const snippet = text.length > 50 ? `${text.substring(0, 47)}...` : text;
    const message = isAnonymous
      ? `Someone commented on your rant: "${snippet}"`
      : `${senderName} commented on your rant: "${snippet}"`;

    createNotification({
      recipient: post.user,
      sender: userId,
      type: 'comment',
      post: post._id,
      comment: comment._id,
      isAnonymous: Boolean(isAnonymous),
      message,
    }).catch(() => {});
  }

  // Check if post becomes trending
  checkAndNotifyTrending(post).catch(() => {});

  return comment.toPublicJSON(userId);
};

/**
 * Get paginated comments for a post
 */
const getCommentsByPost = async (postId, { page = 1, limit = 20, sort = 'desc', currentUserId } = {}) => {
  const post = await Post.findById(postId);
  if (!post) {
    const error = new Error('Post not found');
    error.status = 404;
    throw error;
  }

  const validPage = Math.max(parseInt(page, 10) || 1, 1);
  const validLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (validPage - 1) * validLimit;
  const sortOrder = sort === 'asc' ? 1 : -1;

  const [comments, total] = await Promise.all([
    Comment.find({ post: postId })
      .sort({ createdAt: sortOrder })
      .skip(skip)
      .limit(validLimit)
      .populate('user', 'name image anonymousUsername department semester role')
      .populate('replies.user', 'name image anonymousUsername department semester role'),
    Comment.countDocuments({ post: postId }),
  ]);

  return {
    comments: comments.map((c) => c.toPublicJSON(currentUserId)),
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      pages: Math.ceil(total / validLimit),
    },
  };
};

/**
 * Edit own comment
 */
const updateComment = async (commentId, userId, { text, isAnonymous }) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    const error = new Error('Comment not found');
    error.status = 404;
    throw error;
  }

  if (comment.user.toString() !== userId.toString()) {
    const error = new Error('You can only edit your own comments');
    error.status = 403;
    throw error;
  }

  if (text !== undefined) comment.text = text;
  if (isAnonymous !== undefined) comment.isAnonymous = Boolean(isAnonymous);

  const updated = await comment.save();
  await updated.populate('user', 'name image anonymousUsername department semester role');
  await updated.populate('replies.user', 'name image anonymousUsername department semester role');
  return updated.toPublicJSON(userId);
};

/**
 * Delete own comment (or comment on own post)
 */
const deleteComment = async (commentId, userId, userRole) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    const error = new Error('Comment not found');
    error.status = 404;
    throw error;
  }

  const post = await Post.findById(comment.post);
  const isCommentAuthor = comment.user.toString() === userId.toString();
  const isPostAuthor = post && post.user.toString() === userId.toString();
  const isAdmin = userRole === 'admin';

  if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
    const error = new Error('You can only delete your own comments');
    error.status = 403;
    throw error;
  }

  if (post && (post.commentsCount || 0) > 0) {
    await Post.findByIdAndUpdate(comment.post, { $inc: { commentsCount: -1 } });
  }

  await comment.deleteOne();
  return { success: true, message: 'Comment deleted' };
};

/**
 * Add a reply to a comment
 */
const addReply = async ({ commentId, userId, text, isAnonymous, department, semester }) => {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    const error = new Error('Comment not found');
    error.status = 404;
    throw error;
  }

  if (!Array.isArray(comment.replies)) {
    comment.replies = [];
  }

  comment.replies.push({
    user: userId,
    text,
    isAnonymous: Boolean(isAnonymous),
    department: department || '',
    semester: semester || '',
  });

  await comment.save();
  await comment.populate('replies.user', 'name image anonymousUsername department semester role');
  const savedReply = comment.replies[comment.replies.length - 1];

  // Trigger notification for parent comment author if different user
  if (comment.user && comment.user.toString() !== userId.toString()) {
    const replierUser = savedReply.user;
    const replierName = isAnonymous
      ? (replierUser?.anonymousUsername || 'Someone')
      : (replierUser?.name || 'A student');
    const snippet = text.length > 50 ? `${text.substring(0, 47)}...` : text;
    const message = isAnonymous
      ? `Someone replied to your comment: "${snippet}"`
      : `${replierName} replied to your comment: "${snippet}"`;

    createNotification({
      recipient: comment.user,
      sender: userId,
      type: 'reply',
      post: comment.post,
      comment: comment._id,
      isAnonymous: Boolean(isAnonymous),
      message,
    }).catch(() => {});
  }

  return comment.formatReply(savedReply, userId);
};

/**
 * Get paginated replies for a comment
 */
const getRepliesByComment = async (commentId, { page = 1, limit = 20, currentUserId } = {}) => {
  const comment = await Comment.findById(commentId).populate(
    'replies.user',
    'name image anonymousUsername department semester role'
  );

  if (!comment) {
    const error = new Error('Comment not found');
    error.status = 404;
    throw error;
  }

  const validPage = Math.max(parseInt(page, 10) || 1, 1);
  const validLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (validPage - 1) * validLimit;

  const allReplies = (comment.replies || []).map((r) => comment.formatReply(r, currentUserId));
  const paginatedReplies = allReplies.slice(skip, skip + validLimit);

  return {
    replies: paginatedReplies,
    pagination: {
      page: validPage,
      limit: validLimit,
      total: allReplies.length,
      pages: Math.ceil(allReplies.length / validLimit) || 1,
    },
  };
};

/**
 * Edit own reply
 */
const updateReply = async (commentId, replyId, userId, { text, isAnonymous }) => {
  let comment;
  if (commentId) {
    comment = await Comment.findById(commentId);
  } else {
    comment = await Comment.findOne({ 'replies._id': replyId });
  }

  if (!comment) {
    const error = new Error('Comment not found');
    error.status = 404;
    throw error;
  }

  const reply = comment.replies.id(replyId);
  if (!reply) {
    const error = new Error('Reply not found');
    error.status = 404;
    throw error;
  }

  if (reply.user.toString() !== userId.toString()) {
    const error = new Error('You can only edit your own replies');
    error.status = 403;
    throw error;
  }

  if (text !== undefined) reply.text = text;
  if (isAnonymous !== undefined) reply.isAnonymous = Boolean(isAnonymous);

  await comment.save();
  await comment.populate('replies.user', 'name image anonymousUsername department semester role');
  return comment.formatReply(comment.replies.id(replyId), userId);
};

/**
 * Delete own reply
 */
const deleteReply = async (commentId, replyId, userId, userRole) => {
  let comment;
  if (commentId) {
    comment = await Comment.findById(commentId);
  } else {
    comment = await Comment.findOne({ 'replies._id': replyId });
  }

  if (!comment) {
    const error = new Error('Comment not found');
    error.status = 404;
    throw error;
  }

  const reply = comment.replies.id(replyId);
  if (!reply) {
    const error = new Error('Reply not found');
    error.status = 404;
    throw error;
  }

  const isReplyAuthor = reply.user.toString() === userId.toString();
  const isCommentAuthor = comment.user.toString() === userId.toString();
  const isAdmin = userRole === 'admin';

  if (!isReplyAuthor && !isCommentAuthor && !isAdmin) {
    const error = new Error('You can only delete your own replies');
    error.status = 403;
    throw error;
  }

  comment.replies.pull(replyId);
  await comment.save();

  return { success: true, message: 'Reply deleted' };
};

module.exports = {
  addComment,
  getCommentsByPost,
  updateComment,
  deleteComment,
  addReply,
  getRepliesByComment,
  updateReply,
  deleteReply,
};
