const { z } = require('zod');
const validate = require('../../middleware/validate');

const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be 2-50 characters')
    .max(50, 'Name must be 2-50 characters')
    .optional(),
  bio: z
    .string()
    .max(300, 'Bio cannot exceed 300 characters')
    .optional()
    .or(z.literal('')),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .optional(),
  department: z
    .string()
    .max(100, 'Department cannot exceed 100 characters')
    .optional()
    .or(z.literal('')),
  semester: z
    .string()
    .max(50, 'Semester/year cannot exceed 50 characters')
    .optional()
    .or(z.literal('')),
  anonymousUsername: z
    .string()
    .trim()
    .min(2, 'Anonymous username must be 2-50 characters')
    .max(50, 'Anonymous username cannot exceed 50 characters')
    .optional(),
});

const validateUpdateProfile = validate(updateProfileSchema);

module.exports = {
  updateProfileSchema,
  validateUpdateProfile,
};
