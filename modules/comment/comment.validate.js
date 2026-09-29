const { z } = require('zod');
const validate = require('../../middleware/validate');

const createCommentSchema = z.object({
  text: z
    .string({ required_error: 'Comment text is required' })
    .trim()
    .min(1, 'Comment text is required')
    .max(1000, 'Comment cannot exceed 1000 characters'),
  isAnonymous: z
    .preprocess((val) => {
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      return val;
    }, z.boolean())
    .optional()
    .default(false),
});

const updateCommentSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Comment text cannot be empty')
    .max(1000, 'Comment cannot exceed 1000 characters')
    .optional(),
  isAnonymous: z
    .preprocess((val) => {
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      return val;
    }, z.boolean())
    .optional(),
});

const createReplySchema = z.object({
  text: z
    .string({ required_error: 'Reply text is required' })
    .trim()
    .min(1, 'Reply text is required')
    .max(1000, 'Reply cannot exceed 1000 characters'),
  isAnonymous: z
    .preprocess((val) => {
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      return val;
    }, z.boolean())
    .optional()
    .default(false),
});

const updateReplySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Reply text cannot be empty')
    .max(1000, 'Reply cannot exceed 1000 characters')
    .optional(),
  isAnonymous: z
    .preprocess((val) => {
      if (typeof val === 'string') return val.toLowerCase() === 'true';
      return val;
    }, z.boolean())
    .optional(),
});

const validateCreateComment = validate(createCommentSchema);
const validateUpdateComment = validate(updateCommentSchema);
const validateCreateReply = validate(createReplySchema);
const validateUpdateReply = validate(updateReplySchema);

module.exports = {
  createCommentSchema,
  updateCommentSchema,
  createReplySchema,
  updateReplySchema,
  validateCreateComment,
  validateUpdateComment,
  validateCreateReply,
  validateUpdateReply,
};
