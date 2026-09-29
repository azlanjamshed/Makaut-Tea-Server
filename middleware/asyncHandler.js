// Wraps an async route/controller function so any rejected promise or thrown
// error is forwarded to Express's error-handling middleware instead of
// crashing the process or requiring a try/catch in every controller.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
