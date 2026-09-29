const { z } = require('zod');
const mongoose = require('mongoose');
const validate = require('../../middleware/validate');

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

const createReportSchema = z.object({
  targetType: z.enum(['post', 'comment', 'user'], {
    errorMap: () => ({ message: 'targetType must be post, comment, or user' }),
  }),
  targetId: objectIdSchema,
  reason: z
    .string({ required_error: 'Reason is required' })
    .trim()
    .min(2, 'Reason must be at least 2 characters')
    .max(500, 'Reason cannot exceed 500 characters'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description cannot exceed 2000 characters')
    .optional()
    .default(''),
});

const validateCreateReport = validate(createReportSchema);

module.exports = {
  createReportSchema,
  validateCreateReport,
};
