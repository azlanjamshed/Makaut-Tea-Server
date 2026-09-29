const asyncHandler = require('../../middleware/asyncHandler');
const authService = require('./auth.service');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
  const result = await authService.registerUser({
    ...req.body,
    file: req.file,
  });

  res.status(201).json({
    success: true,
    data: result.user,
    token: result.token,
  });
});

// @desc    Log in an existing user
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.loginUser({ email, password });

  res.json({
    success: true,
    data: result.user,
    token: result.token,
  });
});

// @desc    Get the currently logged-in user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user);
  res.json({ success: true, data: user });
});

// @desc    Log out current user
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = asyncHandler(async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// @desc    Change authenticated user password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await authService.changePassword(req.user._id, {
    currentPassword,
    newPassword,
  });
  res.json(result);
});

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  getMe,
  changePassword,
};
