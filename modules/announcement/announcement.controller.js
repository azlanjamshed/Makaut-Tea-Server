const asyncHandler = require('../../middleware/asyncHandler');
const announcementService = require('./announcement.service');

// @desc    Student proposes / submits an announcement request
// @route   POST /api/announcement-requests
// @access  Private
const createRequest = asyncHandler(async (req, res) => {
  const { title, text, category, targetAudience, contactInfo } = req.body;

  if (!title || !title.trim()) {
    res.status(400);
    throw new Error('Announcement title is required');
  }

  if (!text || !text.trim()) {
    res.status(400);
    throw new Error('Announcement description/body is required');
  }

  const result = await announcementService.createRequest({
    userId: req.user._id,
    title,
    text,
    category,
    targetAudience,
    contactInfo,
    file: req.file,
  });

  res.status(201).json({
    success: true,
    message: 'Announcement proposal submitted for administrator verification',
    data: result,
  });
});

// @desc    Student views their own announcement requests
// @route   GET /api/announcement-requests/my
// @access  Private
const getMyRequests = asyncHandler(async (req, res) => {
  const requests = await announcementService.getMyRequests(req.user._id);
  res.json({
    success: true,
    data: requests,
  });
});

// @desc    Student deletes / cancels their pending request
// @route   DELETE /api/announcement-requests/:id
// @access  Private
const deleteMyRequest = asyncHandler(async (req, res) => {
  const result = await announcementService.deleteMyRequest(req.params.id, req.user._id);
  res.json(result);
});

// ==========================================
// ADMIN HANDLERS
// ==========================================

// @desc    Admin: View all announcement requests
// @route   GET /api/admin/announcement-requests
// @access  Private (Admin)
const getAdminRequests = asyncHandler(async (req, res) => {
  const result = await announcementService.getAdminRequests({
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
    category: req.query.category,
    search: req.query.search,
  });

  res.json({
    success: true,
    data: result.requests,
    pagination: result.pagination,
  });
});

// @desc    Admin: Get announcement requests counts
// @route   GET /api/admin/announcement-requests/counts
// @access  Private (Admin)
const getAdminRequestCounts = asyncHandler(async (req, res) => {
  const counts = await announcementService.getAdminRequestCounts();
  res.json({
    success: true,
    data: counts,
  });
});

// @desc    Admin: Get request by ID
// @route   GET /api/admin/announcement-requests/:id
// @access  Private (Admin)
const getAdminRequestById = asyncHandler(async (req, res) => {
  const request = await announcementService.getAdminRequestById(req.params.id);
  res.json({
    success: true,
    data: request,
  });
});

// @desc    Admin: Approve and broadcast request to campus
// @route   POST /api/admin/announcement-requests/:id/approve
// @access  Private (Admin)
const approveRequest = asyncHandler(async (req, res) => {
  const { customizedText, department, semester, notes } = req.body;
  const result = await announcementService.approveRequest(
    req.params.id,
    req.user._id,
    { customizedText, department, semester, notes }
  );

  res.json({
    success: true,
    message: 'Announcement approved and broadcasted to the campus feed!',
    data: result.request,
    publishedPost: result.publishedPost,
  });
});

// @desc    Admin: Reject announcement request
// @route   POST /api/admin/announcement-requests/:id/reject
// @access  Private (Admin)
const rejectRequest = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const request = await announcementService.rejectRequest(
    req.params.id,
    req.user._id,
    { reason }
  );

  res.json({
    success: true,
    message: 'Announcement request rejected with feedback',
    data: request,
  });
});

module.exports = {
  createRequest,
  getMyRequests,
  deleteMyRequest,
  getAdminRequests,
  getAdminRequestCounts,
  getAdminRequestById,
  approveRequest,
  rejectRequest,
};
