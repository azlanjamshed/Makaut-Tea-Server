const asyncHandler = require('../../middleware/asyncHandler');
const reportService = require('./report.service');

// @desc    Submit a report for post, comment, or user
// @route   POST /api/reports
// @access  Private
const createReport = asyncHandler(async (req, res) => {
  const { targetType, targetId, reason, description } = req.body;
  const report = await reportService.createReport({
    reporterId: req.user._id,
    targetType,
    targetId,
    reason,
    description,
  });

  res.status(201).json({
    success: true,
    message: 'Report submitted successfully. Our moderation team will review it.',
    data: report,
  });
});

// @desc    Get reports submitted by current logged-in user
// @route   GET /api/reports/my
// @access  Private
const getMyReports = asyncHandler(async (req, res) => {
  const result = await reportService.getMyReports(req.user._id, {
    page: req.query.page,
    limit: req.query.limit,
  });

  res.json({
    success: true,
    data: result.reports,
    pagination: result.pagination,
  });
});

module.exports = {
  createReport,
  getMyReports,
};
