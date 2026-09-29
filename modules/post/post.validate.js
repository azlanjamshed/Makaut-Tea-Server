const { z } = require('zod');
const validate = require('../../middleware/validate');

const createPostSchema = z.object({
  text: z
    .string({ required_error: 'Post text is required' })
    .trim()
    .min(1, 'Post text is required')
    .max(2000, 'Post cannot exceed 2000 characters'),
  isAnonymous: z
    .preprocess((val) => {
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      return val;
    }, z.boolean())
    .optional()
    .default(false),
  department: z.string().trim().max(100).optional(),
  semester: z.string().trim().max(50).optional(),
});

const updatePostSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Post text cannot be empty')
    .max(2000, 'Post cannot exceed 2000 characters')
    .optional(),
  isAnonymous: z
    .preprocess((val) => {
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      return val;
    }, z.boolean())
    .optional(),
});

const ALLOWED_EMOJIS = ['❤️', '👎', '💀'];

const reactPostSchema = z.object({
  emoji: z.enum(['❤️', '👎', '💀'], {
    errorMap: () => ({ message: 'Emoji must be one of: ❤️, 👎, 💀' }),
  }),
});

const validateCreatePost = validate(createPostSchema);
const validateUpdatePost = validate(updatePostSchema);
const validateReactPost = validate(reactPostSchema);

module.exports = {
  ALLOWED_EMOJIS,
  createPostSchema,
  updatePostSchema,
  reactPostSchema,
  validateCreatePost,
  validateUpdatePost,
  validateReactPost,
};
