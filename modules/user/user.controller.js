const asyncHandler = require('../../middleware/asyncHandler');
const userService = require('./user.service');

// @desc    Get any user's public profile by id (safe, no sensitive data like gmail)
// @route   GET /api/users/:id
// @access  Public (optionalAuth)
const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id, req.user?._id);
  res.json({ success: true, data: user });
});

// @desc    Search public users
// @route   GET /api/users/search
// @access  Public (optionalAuth)
const searchUsers = asyncHandler(async (req, res) => {
  const { q = '', limit = 20 } = req.query;
  const users = await userService.searchUsers({
    q,
    limit,
    currentUserId: req.user?._id,
  });
  res.json({ success: true, data: users });
});

// @desc    Update the logged-in user's own profile (name, bio, image, password)
// @route   PUT /api/users/me
// @access  Private (owner only)
const updateMyProfile = asyncHandler(async (req, res) => {
  const updatedUser = await userService.updateProfile(req.user._id, {
    ...req.body,
    file: req.file,
  });

  res.json({ success: true, data: updatedUser });
});

// @desc    Delete the logged-in user's own account (and cascade their posts)
// @route   DELETE /api/users/me
// @access  Private (owner only)
const deleteMyAccount = asyncHandler(async (req, res) => {
  const result = await userService.deleteAccount(req.user._id);
  res.json(result);
});

module.exports = {
  getUserById,
  searchUsers,
  updateMyProfile,
  deleteMyAccount,
};
