const jwt = require('jsonwebtoken');
const asyncHandler = require('./asyncHandler');
const User = require('../models/User');

/**
 * Reads a Bearer token from the Authorization header, if present.
 */
const extractToken = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.split(' ')[1];
  }
  return null;
};

const getJwtSecret = () => process.env.JWT_SECRET || 'dev_jwt_secret_fallback_do_not_use_in_prod';

/**
 * protect: requires a valid JWT. Attaches the authenticated user to req.user.
 * Use this on any route that only logged-in users should reach.
 */
const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token provided');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, getJwtSecret());
  } catch (error) {
    res.status(401);
    throw new Error('Not authorized, token invalid or expired');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    res.status(401);
    throw new Error('Not authorized, user no longer exists');
  }

  // Account status check (ban & suspension)
  if (user.status === 'banned') {
    res.status(403);
    const reasonMsg = user.suspensionReason ? `: ${user.suspensionReason}` : '';
    throw new Error(`Your account has been banned${reasonMsg}`);
  }

  if (user.status === 'suspended') {
    if (user.suspendedUntil && new Date() > new Date(user.suspendedUntil)) {
      // Auto-lift expired suspension
      user.status = 'active';
      user.suspendedUntil = null;
      user.suspensionReason = '';
      await user.save();
    } else {
      res.status(403);
      const reasonMsg = user.suspensionReason ? `: ${user.suspensionReason}` : '';
      throw new Error(`Your account has been suspended${reasonMsg}`);
    }
  }

  // Touch lastActiveAt
  User.updateOne({ _id: user._id }, { $set: { lastActiveAt: new Date() } }).exec().catch(() => {});

  req.user = user;
  next();
});

/**
 * optionalAuth: attaches req.user if a valid token is present, but never
 * blocks the request if it's missing/invalid. Useful for routes that are
 * public but behave slightly differently for logged-in users (e.g. view
 * counting, "did I already like this" checks).
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);

  if (token) {
    try {
      const decoded = jwt.verify(token, getJwtSecret());
      const user = await User.findById(decoded.id);
      if (user) req.user = user;
    } catch (error) {
      // silently ignore invalid/expired tokens for optional auth
    }
  }

  next();
});

/**
 * adminOnly: requires req.user to be authenticated with role === 'admin'
 */
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Access denied: Administrator authorization required');
  }
  next();
};

module.exports = { protect, optionalAuth, adminOnly };
