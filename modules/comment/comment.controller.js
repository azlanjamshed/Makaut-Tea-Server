const asyncHandler = require('../../middleware/asyncHandler');
const commentService = require('./comment.service');

// @desc    Add comment to a post
// @route   POST /api/posts/:postId/comments
// @access  Private
const addComment = asyncHandler(async (req, res) => {
  const { text, isAnonymous } = req.body;
  const postId = req.params.postId;

  const comment = await commentService.addComment({
    postId,
    userId: req.user._id,
    text,
    isAnonymous,
    department: req.user.department || '',
    semester: req.user.semester || '',
  });

  res.status(201).json({ success: true, data: comment });
});

// @desc    Get paginated comments for a post
// @route   GET /api/posts/:postId/comments
// @desc    Get paginated comments for a post
// @route   GET /api/posts/:postId/comments
// @access  Public
const getComments = asyncHandler(async (req, res) => {
  const postId = req.params.postId;
  const result = await commentService.getCommentsByPost(postId, {
    page: req.query.page,
    limit: req.query.limit,
    sort: req.query.sort,
    currentUserId: req.user?._id,
  });

  res.json({
    success: true,
    data: result.comments,
    pagination: result.pagination,
  });
});

// @desc    Edit own comment
// @route   PUT /api/comments/:id
// @access  Private (author only)
const updateComment = asyncHandler(async (req, res) => {
  const commentId = req.params.id || req.params.commentId;
  const { text, isAnonymous } = req.body;

  const updatedComment = await commentService.updateComment(
    commentId,
    req.user._id,
    { text, isAnonymous }
  );

  res.json({ success: true, data: updatedComment });
});

// @desc    Delete own comment
// @route   DELETE /api/comments/:id
// @access  Private (author or post author)
const deleteComment = asyncHandler(async (req, res) => {
  const commentId = req.params.id || req.params.commentId;
  const result = await commentService.deleteComment(commentId, req.user._id, req.user.role);
  res.json(result);
});

// @desc    Reply to a comment
// @route   POST /api/comments/:commentId/replies
// @access  Private
const addReply = asyncHandler(async (req, res) => {
  const commentId = req.params.commentId || req.params.id;
  const { text, isAnonymous } = req.body;

  const reply = await commentService.addReply({
    commentId,
    userId: req.user._id,
    text,
    isAnonymous,
    department: req.user.department || '',
    semester: req.user.semester || '',
  });

  res.status(201).json({ success: true, data: reply });
});

// @desc    Get paginated replies for a comment
// @route   GET /api/comments/:commentId/replies
// @access  Public
const getReplies = asyncHandler(async (req, res) => {
  const commentId = req.params.commentId || req.params.id;
  const result = await commentService.getRepliesByComment(commentId, {
    page: req.query.page,
    limit: req.query.limit,
    currentUserId: req.user?._id,
  });

  res.json({
    success: true,
    data: result.replies,
    pagination: result.pagination,
  });
});

// @desc    Edit own reply
// @route   PUT /api/comments/:commentId/replies/:replyId
// @access  Private (reply author only)
const updateReply = asyncHandler(async (req, res) => {
  const commentId = req.params.commentId;
  const replyId = req.params.replyId || req.params.id;
  const { text, isAnonymous } = req.body;

  const updatedReply = await commentService.updateReply(
    commentId,
    replyId,
    req.user._id,
    { text, isAnonymous }
  );

  res.json({ success: true, data: updatedReply });
});

// @desc    Delete own reply
// @route   DELETE /api/comments/:commentId/replies/:replyId
// @access  Private (reply author or comment author)
const deleteReply = asyncHandler(async (req, res) => {
  const commentId = req.params.commentId;
  const replyId = req.params.replyId || req.params.id;

  const result = await commentService.deleteReply(commentId, replyId, req.user._id, req.user.role);
  res.json(result);
});

module.exports = {
  addComment,
  getComments,
  updateComment,
  deleteComment,
  addReply,
  getReplies,
  updateReply,
  deleteReply,
};
