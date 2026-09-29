const { z } = require('zod');

/**
 * Express middleware to validate request data against a Zod schema.
 * Formats errors as: { success: false, message: string, errors: [{ field, message }] }
 *
 * @param {z.ZodSchema} schema
 */
const validate = (schema) => (req, res, next) => {
  try {
    const isFullRequestSchema =
      schema.shape &&
      ('body' in schema.shape || 'query' in schema.shape || 'params' in schema.shape);

    if (isFullRequestSchema) {
      const parsed = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) req.query = parsed.query;
      if (parsed.params !== undefined) req.params = parsed.params;
    } else {
      req.body = schema.parse(req.body);
    }
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues || error.errors || [];
      const firstIssue = issues[0];
      return res.status(400).json({
        success: false,
        message: firstIssue ? firstIssue.message : 'Validation error',
        errors: issues.map((e) => ({
          field: String(e.path[e.path.length - 1] || 'field'),
          message: e.message,
        })),
      });
    }
    next(error);
  }
};

module.exports = validate;
