const crypto = require('crypto');
const asyncHandler = require('../../middleware/asyncHandler');
const postService = require('./post.service');

// Builds a stable, anonymous identifier for a guest viewer so the same
// browser/IP doesn't inflate the view count on every refresh. Logged-in
// users are tracked by their real user id instead.
const getViewerId = (req) => {
  if (req.user) return `u:${req.user._id.toString()}`;
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = forwarded
    ? (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0])
    : (req.ip || req.socket?.remoteAddress || 'unknown');
  return `g:${crypto.createHash('sha256').update(String(rawIp)).digest('hex')}`;
};

// @desc    Create a new post (rant)
// @route   POST /api/posts
// @access  Private
const createPost = asyncHandler(async (req, res) => {
  const { text, isAnonymous } = req.body;
  const isOfficial = req.user.role === 'admin';
  // Department and semester can be explicitly specified (e.g. by admin or user), or fallback to user profile
  const department = req.body.department !== undefined ? req.body.department : (req.user.department || '');
  const semester = req.body.semester !== undefined ? req.body.semester : (req.user.semester || '');

  const post = await postService.createPost({
    userId: req.user._id,
    text,
    department,
    semester,
    isAnonymous: isOfficial ? false : isAnonymous,
    isOfficial,
    file: req.file,
  });
  res.status(201).json({ success: true, data: post });
});

// @desc    Get all posts (newest first), paginated, optionally filtered by department, username, or search query
// @route   GET /api/posts?page=1&limit=20&department=...&username=...
// @access  Public (optional auth)
const getPosts = asyncHandler(async (req, res) => {
  const result = await postService.getPosts({
    page: req.query.page,
    limit: req.query.limit,
    department: req.query.department,
    username: req.query.username,
    q: req.query.q,
    currentUserId: req.user?._id,
  });

  res.json({
    success: true,
    data: result.posts,
    pagination: result.pagination,
  });
});

// @desc    Search posts by department, username, or text query
// @route   GET /api/posts/search?department=...&username=...&q=...
// @access  Public (optional auth)
const searchPosts = asyncHandler(async (req, res) => {
  const result = await postService.searchPosts({
    page: req.query.page,
    limit: req.query.limit,
    department: req.query.department,
    username: req.query.username,
    q: req.query.q,
    currentUserId: req.user?._id,
  });

  res.json({
    success: true,
    data: result.posts,
    pagination: result.pagination,
  });
});

// @desc    Get posts by department (newest first), paginated
// @route   GET /api/posts/department/:department?page=1&limit=20
// @access  Public (optional auth)
const getPostsByDepartment = asyncHandler(async (req, res) => {
  const result = await postService.getPostsByDepartment(req.params.department, {
    page: req.query.page,
    limit: req.query.limit,
    currentUserId: req.user?._id,
  });

  res.json({
    success: true,
    data: result.posts,
    pagination: result.pagination,
  });
});

// @desc    Get a single post by id, incrementing its view count once per viewer
// @route   GET /api/posts/:id
// @access  Public (optional auth)
const getPostById = asyncHandler(async (req, res) => {
  const viewerId = getViewerId(req);
  const post = await postService.getPostById(req.params.id, viewerId, req.user?._id);
  res.json({ success: true, data: post });
});

// @desc    Update a post's text/image/isAnonymous
// @route   PUT /api/posts/:id
// @access  Private (owner only)
const updatePost = asyncHandler(async (req, res) => {
  const { text, isAnonymous } = req.body;
  const updatedPost = await postService.updatePost(req.params.id, req.user._id, {
    text,
    isAnonymous,
    file: req.file,
  });
  res.json({ success: true, data: updatedPost });
});

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private (owner only)
const deletePost = asyncHandler(async (req, res) => {
  const result = await postService.deletePost(req.params.id, req.user._id);
  res.json(result);
});

// @desc    Get all posts by a specific user
// @route   GET /api/posts/user/:userId
// @access  Public (optional auth)
const getPostsByUser = asyncHandler(async (req, res) => {
  const posts = await postService.getPostsByUser(req.params.userId, req.user?._id);
  res.json({ success: true, data: posts });
});

// @desc    Add, change, or toggle reaction on a post
// @route   POST /api/posts/:id/reactions
// @access  Private
const reactToPost = asyncHandler(async (req, res) => {
  const { emoji } = req.body;
  const result = await postService.reactToPost(req.params.id, req.user._id, emoji);
  res.json({
    success: true,
    message: `Reaction ${result.action}`,
    data: result.post,
  });
});

// @desc    Explicitly remove reaction from a post
// @route   DELETE /api/posts/:id/reactions
// @access  Private
const removeReaction = asyncHandler(async (req, res) => {
  const updatedPost = await postService.removeReaction(req.params.id, req.user._id);
  res.json({
    success: true,
    message: 'Reaction removed',
    data: updatedPost,
  });
});

// @desc    Get detailed list of users who reacted to a post (post owner only)
// @route   GET /api/posts/:id/reactions
// @access  Private (owner only)
const getPostReactions = asyncHandler(async (req, res) => {
  const result = await postService.getPostReactions(req.params.id, req.user._id);
  res.json({
    success: true,
    data: result,
  });
});

// @desc    Get all posts the current user has reacted to
// @route   GET /api/posts/my-reactions
// @access  Private
const getMyReactedPosts = asyncHandler(async (req, res) => {
  const result = await postService.getMyReactedPosts(req.user._id, {
    page: req.query.page,
    limit: req.query.limit,
  });

  res.json({
    success: true,
    data: result.posts,
    pagination: result.pagination,
  });
});

// @desc    Get trending rants today (reactions + comments + recency)
// @route   GET /api/posts/trending/today
// @access  Public (optional auth)
const getTrendingToday = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Math.min(parseInt(req.query.limit, 10) || 10, 10) : 10;
  const result = await postService.getTrendingPosts({
    timeframe: 'today',
    page: req.query.page,
    limit,
    sortBy: req.query.sortBy,
    currentUserId: req.user?._id,
  });

  res.json({
    success: true,
    data: result.posts,
    pagination: result.pagination,
  });
});

// @desc    Get recent official/admin announcements within past 24 hours
// @route   GET /api/posts/official/recent
// @access  Public (optional auth)
const getRecentOfficial = asyncHandler(async (req, res) => {
  const hours = req.query.hours ? parseFloat(req.query.hours) : 24;
  const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5;
  const posts = await postService.getRecentOfficialPosts({
    hours,
    limit,
    currentUserId: req.user?._id,
  });

  res.json({
    success: true,
    data: posts,
  });
});

// @desc    Get trending rants this week (reactions + comments + recency)
// @route   GET /api/posts/trending/week
// @access  Public (optional auth)
const getTrendingWeek = asyncHandler(async (req, res) => {
  const result = await postService.getTrendingPosts({
    timeframe: 'week',
    page: req.query.page,
    limit: req.query.limit,
    currentUserId: req.user?._id,
  });

  res.json({
    success: true,
    data: result.posts,
    pagination: result.pagination,
  });
});

// @desc    Get popular rants (highest reactions + comments)
// @route   GET /api/posts/popular
// @access  Public (optional auth)
const getPopular = asyncHandler(async (req, res) => {
  const result = await postService.getTrendingPosts({
    timeframe: 'popular',
    page: req.query.page,
    limit: req.query.limit,
    currentUserId: req.user?._id,
  });

  res.json({
    success: true,
    data: result.posts,
    pagination: result.pagination,
  });
});

// @desc    Get trending rants with optional timeframe query
// @route   GET /api/posts/trending?timeframe=today|week|popular
// @access  Public (optional auth)
const getTrending = asyncHandler(async (req, res) => {
  const timeframe = req.query.timeframe || 'today';
  const result = await postService.getTrendingPosts({
    timeframe,
    page: req.query.page,
    limit: req.query.limit,
    currentUserId: req.user?._id,
  });

  res.json({
    success: true,
    data: result.posts,
    pagination: result.pagination,
  });
});

module.exports = {
  createPost,
  getPosts,
  searchPosts,
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
};
