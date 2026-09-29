const asyncHandler = require('../../middleware/asyncHandler');
const feedbackService = require('./feedback.service');

// @desc    Submit feedback, bug report, or feature suggestion
// @route   POST /api/feedback
// @access  Public (optionalAuth)
const submitFeedback = asyncHandler(async (req, res) => {
  const { type, subject, description, deviceInfo, contactEmail } = req.body;

  if (!subject || !subject.trim()) {
    res.status(400);
    throw new Error('Subject is required');
  }

  if (!description || !description.trim()) {
    res.status(400);
    throw new Error('Message or description is required');
  }

  const result = await feedbackService.submitFeedback({
    userId: req.user?._id || null,
    type,
    subject,
    description,
    deviceInfo,
    contactEmail: contactEmail || req.user?.email || '',
    file: req.file,
  });

  res.status(201).json({
    success: true,
    message: 'Thank you! Your feedback has been sent to the team.',
    data: result,
  });
});

// @desc    Get current user's submitted feedback
// @route   GET /api/feedback/my
// @access  Private
const getMyFeedback = asyncHandler(async (req, res) => {
  const list = await feedbackService.getMyFeedback(req.user._id);
  res.json({
    success: true,
    data: list,
  });
});

// @desc    Admin: Get all feedback submissions
// @route   GET /api/admin/feedback
// @access  Private (Admin)
const getAdminFeedbacks = asyncHandler(async (req, res) => {
  const result = await feedbackService.getAdminFeedbacks({
    page: req.query.page,
    limit: req.query.limit,
    type: req.query.type,
    status: req.query.status,
    search: req.query.search,
  });

  res.json({
    success: true,
    data: result.feedbacks,
    pagination: result.pagination,
  });
});

// @desc    Admin: Update feedback status and notes
// @route   PUT /api/admin/feedback/:id
// @access  Private (Admin)
const updateFeedbackStatus = asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body;
  const result = await feedbackService.updateFeedbackStatus(
    req.params.id,
    req.user._id,
    { status, adminNotes }
  );

  res.json({
    success: true,
    message: 'Feedback updated successfully',
    data: result,
  });
});

module.exports = {
  submitFeedback,
  getMyFeedback,
  getAdminFeedbacks,
  updateFeedbackStatus,
};
