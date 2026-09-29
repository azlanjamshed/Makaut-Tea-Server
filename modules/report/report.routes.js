const express = require('express');
const { createReport, getMyReports } = require('./report.controller');
const { validateCreateReport } = require('./report.validate');
const { protect } = require('../../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.route('/')
  .post(validateCreateReport, createReport);

router.get('/my', getMyReports);

module.exports = router;
