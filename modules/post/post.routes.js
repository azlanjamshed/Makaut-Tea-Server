const express = require('express');
const {
  createPost,
  getPosts,
  getPostsByDepartment,
  getPostById,
  updatePost,
  deletePost,
  getPostsByUser,
  reactToPost,
  removeReaction,
  getPostReactions,
  getMyReactedPosts,
  getTrendingToday,
  getTrendingWeek,
  getPopular,
  getTrending,
  getRecentOfficial,
  searchPosts,
} = require('./post.controller');
const {
  validateCreatePost,
  validateUpdatePost,
  validateReactPost,
} = require('./post.validate');
const { protect, optionalAuth } = require('../../middleware/authMiddleware');
const upload = require('../../middleware/uploadMiddleware');
const commentRoutes = require('../comment/comment.routes');

const router = express.Router();

router.use('/:postId/comments', commentRoutes);
router.get('/official/recent', optionalAuth, getRecentOfficial);
router.get('/trending/today', optionalAuth, getTrendingToday);
router.get('/trending/week', optionalAuth, getTrendingWeek);
router.get('/trending', optionalAuth, getTrending);
router.get('/popular', optionalAuth, getPopular);
router.get('/my-reactions', protect, getMyReactedPosts);
router.get('/search', optionalAuth, searchPosts);
router.get('/department/:department', optionalAuth, getPostsByDepartment);
router.get('/user/:userId', optionalAuth, getPostsByUser);

router
  .route('/')
  .get(optionalAuth, getPosts)
  .post(protect, upload.single('image'), validateCreatePost, createPost);

router
  .route('/:id/reactions')
  .get(protect, getPostReactions)
  .post(protect, validateReactPost, reactToPost)
  .delete(protect, removeReaction);

router
  .route('/:id')
  .get(optionalAuth, getPostById)
  .put(protect, upload.single('image'), validateUpdatePost, updatePost)
  .delete(protect, deletePost);

module.exports = router;
