const asyncHandler = require('../../middleware/asyncHandler');
const adminService = require('./admin.service');

// ==========================================
// 24. ADMIN AUTHENTICATION
// ==========================================

// @desc    Admin login
// @route   POST /api/admin/login or POST /api/admin/auth/login
// @access  Public (validates role === 'admin')
const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await adminService.adminLogin({ email, password });

  res.json({
    success: true,
    message: 'Admin authentication successful',
    data: result.user,
    token: result.token,
  });
});

// @desc    Get current admin profile
// @route   GET /api/admin/me
// @access  Private (Admin)
const getAdminMe = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: req.user.toPublicJSON({ isSelf: true }),
  });
});

// ==========================================
// 25. ADMIN RANT MANAGEMENT
// ==========================================

// @desc    View all rants with status filter (all, active, hidden, deleted)
// @route   GET /api/admin/posts
// @access  Private (Admin)
const getAdminPosts = asyncHandler(async (req, res) => {
  const result = await adminService.getAdminPosts(
    {
      page: req.query.page,
      limit: req.query.limit,
      status: req.query.status,
      department: req.query.department,
      search: req.query.search,
    },
    req.user?._id
  );

  res.json({
    success: true,
    data: result.posts,
    pagination: result.pagination,
  });
});

// @desc    Get rant by ID with moderation details
// @route   GET /api/admin/posts/:id
// @access  Private (Admin)
const getAdminPostById = asyncHandler(async (req, res) => {
  const post = await adminService.getAdminPostById(req.params.id, req.user?._id);
  res.json({
    success: true,
    data: post,
  });
});

// @desc    Hide a rant
// @route   PUT /api/admin/posts/:id/hide
// @access  Private (Admin)
const hidePost = asyncHandler(async (req, res) => {
  const post = await adminService.hidePost(
    req.params.id,
    req.user._id,
    req.body.reason
  );
  res.json({
    success: true,
    message: 'Post has been hidden from public views',
    data: post,
  });
});

// @desc    Unhide a rant
// @route   PUT /api/admin/posts/:id/unhide
// @access  Private (Admin)
const unhidePost = asyncHandler(async (req, res) => {
  const post = await adminService.unhidePost(req.params.id, req.user._id);
  res.json({
    success: true,
    message: 'Post is now visible to the public',
    data: post,
  });
});

// @desc    Delete a rant (admin soft delete)
// @route   DELETE /api/admin/posts/:id
// @access  Private (Admin)
const deletePost = asyncHandler(async (req, res) => {
  const post = await adminService.deletePostAdmin(
    req.params.id,
    req.user._id,
    req.body.reason
  );
  res.json({
    success: true,
    message: 'Post has been soft-deleted by administrator',
    data: post,
  });
});

// @desc    Restore a hidden or deleted rant
// @route   PUT /api/admin/posts/:id/restore
// @access  Private (Admin)
const restorePost = asyncHandler(async (req, res) => {
  const post = await adminService.restorePostAdmin(req.params.id, req.user._id);
  res.json({
    success: true,
    message: 'Post has been successfully restored',
    data: post,
  });
});

// ==========================================
// 26. REPORT MANAGEMENT
// ==========================================

// @desc    View reports
// @route   GET /api/admin/reports
// @access  Private (Admin)
const getReports = asyncHandler(async (req, res) => {
  const result = await adminService.getReports({
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    targetType: req.query.targetType,
  });

  res.json({
    success: true,
    data: result.reports,
    pagination: result.pagination,
  });
});

// @desc    Get single report by ID
// @route   GET /api/admin/reports/:id
// @access  Private (Admin)
const getReportById = asyncHandler(async (req, res) => {
  const report = await adminService.getReportById(req.params.id);
  res.json({
    success: true,
    data: report,
  });
});

// @desc    Assign status to report
// @route   PUT /api/admin/reports/:id/status
// @access  Private (Admin)
const updateReportStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;
  const report = await adminService.updateReportStatus(
    req.params.id,
    req.user._id,
    status,
    notes
  );

  res.json({
    success: true,
    message: `Report status updated to ${status}`,
    data: report,
  });
});

// @desc    Resolve report
// @route   PUT /api/admin/reports/:id/resolve
// @access  Private (Admin)
const resolveReport = asyncHandler(async (req, res) => {
  const { actionTaken, notes } = req.body;
  const report = await adminService.resolveReport(
    req.params.id,
    req.user._id,
    { actionTaken, notes }
  );

  res.json({
    success: true,
    message: 'Report resolved successfully',
    data: report,
  });
});

// @desc    Reject report
// @route   PUT /api/admin/reports/:id/reject
// @access  Private (Admin)
const rejectReport = asyncHandler(async (req, res) => {
  const { notes } = req.body;
  const report = await adminService.rejectReport(
    req.params.id,
    req.user._id,
    notes
  );

  res.json({
    success: true,
    message: 'Report rejected',
    data: report,
  });
});

// @desc    Take moderation action on report
// @route   POST /api/admin/reports/:id/action
// @access  Private (Admin)
const takeReportAction = asyncHandler(async (req, res) => {
  const { action, reason, durationDays, notes } = req.body;
  const result = await adminService.takeReportAction(
    req.params.id,
    req.user._id,
    { action, reason, durationDays, notes }
  );

  res.json({
    success: true,
    message: `Moderation action '${action}' executed successfully`,
    data: result.report,
    actionResult: result.actionResult,
  });
});

// ==========================================
// 27. USER MANAGEMENT
// ==========================================

// @desc    View users
// @route   GET /api/admin/users
// @access  Private (Admin)
const getUsers = asyncHandler(async (req, res) => {
  const result = await adminService.getUsers({
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    role: req.query.role,
    search: req.query.search,
  });

  res.json({
    success: true,
    data: result.users,
    pagination: result.pagination,
  });
});

// @desc    Get user by ID with activity stats
// @route   GET /api/admin/users/:id
// @access  Private (Admin)
const getUserById = asyncHandler(async (req, res) => {
  const result = await adminService.getUserById(req.params.id);
  res.json({
    success: true,
    data: result.user,
    stats: result.stats,
  });
});

// @desc    Suspend user
// @route   PUT /api/admin/users/:id/suspend
// @access  Private (Admin)
const suspendUser = asyncHandler(async (req, res) => {
  const { reason, durationDays } = req.body;
  const user = await adminService.suspendUser(
    req.params.id,
    req.user._id,
    { reason, durationDays }
  );

  res.json({
    success: true,
    message: `User ${user.name} suspended until ${user.suspendedUntil.toISOString()}`,
    data: user.toPublicJSON({ isAdmin: true }),
  });
});

// @desc    Ban user
// @route   PUT /api/admin/users/:id/ban
// @access  Private (Admin)
const banUser = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const user = await adminService.banUser(
    req.params.id,
    req.user._id,
    { reason }
  );

  res.json({
    success: true,
    message: `User ${user.name} has been permanently banned`,
    data: user.toPublicJSON({ isAdmin: true }),
  });
});

// @desc    Restore user
// @route   PUT /api/admin/users/:id/restore
// @access  Private (Admin)
const restoreUser = asyncHandler(async (req, res) => {
  const user = await adminService.restoreUser(req.params.id, req.user._id);

  res.json({
    success: true,
    message: `User ${user.name} account restored to active`,
    data: user.toPublicJSON({ isAdmin: true }),
  });
});

// ==========================================
// 28. DASHBOARD STATISTICS
// ==========================================

// @desc    Dashboard statistics
// @route   GET /api/admin/dashboard or GET /api/admin/stats
// @access  Private (Admin)
const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await adminService.getDashboardStats();
  res.json({
    success: true,
    data: stats,
  });
});

module.exports = {
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
};
