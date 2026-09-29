const express = require('express');
const {
  addComment,
  getComments,
  updateComment,
  deleteComment,
  addReply,
  getReplies,
  updateReply,
  deleteReply,
} = require('./comment.controller');
const {
  validateCreateComment,
  validateUpdateComment,
  validateCreateReply,
  validateUpdateReply,
} = require('./comment.validate');
const { protect, optionalAuth } = require('../../middleware/authMiddleware');

const router = express.Router({ mergeParams: true });

router
  .route('/')
  .get(optionalAuth, getComments)
  .post(protect, validateCreateComment, addComment);

router
  .route('/:commentId/replies/:replyId')
  .put(protect, validateUpdateReply, updateReply)
  .delete(protect, deleteReply);

router
  .route('/:commentId/replies')
  .get(optionalAuth, getReplies)
  .post(protect, validateCreateReply, addReply);

router
  .route('/:id')
  .put(protect, validateUpdateComment, updateComment)
  .delete(protect, deleteComment);

module.exports = router;
