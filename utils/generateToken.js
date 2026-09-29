const jwt = require('jsonwebtoken');

/**
 * Generate a signed JWT for a given user id.
 * @param {string} userId - Mongo _id of the user
 * @returns {string} signed JWT
 */
const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET || 'dev_jwt_secret_fallback_do_not_use_in_prod';
  return jwt.sign({ id: userId }, secret, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

module.exports = generateToken;
