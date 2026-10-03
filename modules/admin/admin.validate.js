const { z } = require('zod');
const validate = require('../../middleware/validate');

const adminLoginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Please provide a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password cannot be empty'),
});

const updateReportStatusSchema = z.object({
  status: z.enum(['pending', 'investigating', 'resolved', 'rejected'], {
    errorMap: () => ({ message: 'Status must be pending, investigating, resolved, or rejected' }),
  }),
  notes: z.string().trim().max(1000).optional().default(''),
});

const resolveReportSchema = z.object({
  actionTaken: z
    .enum(['none', 'hidden', 'deleted', 'user_suspended', 'user_banned', 'dismissed', 'dismiss'], {
      errorMap: () => ({ message: 'Invalid actionTaken' }),
    })
    .default('dismissed')
    .transform((val) => (val === 'dismiss' ? 'dismissed' : val)),
  notes: z.string().trim().max(1000).optional().default(''),
});

const rejectReportSchema = z.object({
  notes: z.string().trim().max(1000).optional().default(''),
});

const takeReportActionSchema = z.object({
  action: z.enum(['hide_post', 'delete_post', 'suspend_user', 'ban_user', 'dismiss'], {
    errorMap: () => ({
      message: 'Action must be hide_post, delete_post, suspend_user, ban_user, or dismiss',
    }),
  }),
  reason: z.string().trim().max(500).optional().default('Moderator action'),
  durationDays: z.coerce.number().int().positive().optional().default(7),
  notes: z.string().trim().max(1000).optional().default(''),
});

const suspendUserSchema = z.object({
  reason: z
    .string({ required_error: 'Suspension reason is required' })
    .trim()
    .min(2, 'Reason must be at least 2 characters')
    .max(500, 'Reason cannot exceed 500 characters'),
  durationDays: z.coerce.number().int().positive().optional().default(7),
});

const banUserSchema = z.object({
  reason: z
    .string({ required_error: 'Ban reason is required' })
    .trim()
    .min(2, 'Reason must be at least 2 characters')
    .max(500, 'Reason cannot exceed 500 characters'),
});

const postModerationSchema = z.object({
  reason: z.string().trim().max(500).optional().default(''),
});

module.exports = {
  validateAdminLogin: validate(adminLoginSchema),
  validateUpdateReportStatus: validate(updateReportStatusSchema),
  validateResolveReport: validate(resolveReportSchema),
  validateRejectReport: validate(rejectReportSchema),
  validateTakeReportAction: validate(takeReportActionSchema),
  validateSuspendUser: validate(suspendUserSchema),
  validateBanUser: validate(banUserSchema),
  validatePostModeration: validate(postModerationSchema),
};
