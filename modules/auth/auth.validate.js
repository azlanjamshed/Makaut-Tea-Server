const { z } = require('zod');
const validate = require('../../middleware/validate');

const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be 2-50 characters')
    .max(50, 'Name must be 2-50 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .email('Please provide a valid email address')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters'),
  bio: z
    .string()
    .max(300, 'Bio cannot exceed 300 characters')
    .optional()
    .or(z.literal('')),
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
    .max(50, 'Anonymous username cannot exceed 50 characters')
    .optional()
    .or(z.literal('')),
});

const loginSchema = z.object({
  email: z
    .string({ required_error: 'A valid email is required' })
    .trim()
    .email('A valid email is required')
    .toLowerCase(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z
    .string({ required_error: 'Current password is required' })
    .min(1, 'Current password is required'),
  newPassword: z
    .string({ required_error: 'New password is required' })
    .min(6, 'New password must be at least 6 characters'),
});

const validateRegister = validate(registerSchema);
const validateLogin = validate(loginSchema);
const validateChangePassword = validate(changePasswordSchema);

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  validateRegister,
  validateLogin,
  validateChangePassword,
};
