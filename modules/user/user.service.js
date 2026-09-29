const User = require('../../models/User');
const Post = require('../../models/Post');
const Comment = require('../../models/Comment');
const { uploadImage } = require('../../utils/imagekit');

/**
 * Fetch a user's public profile by ID
 */
const getUserById = async (id, currentUserId) => {
  const user = await User.findById(id);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }
  const isSelf = currentUserId && String(user._id) === String(currentUserId);
  return user.toPublicJSON({ isSelf });
};

/**
 * Search users by name or department (excluding banned, safe public projection)
 */
const searchUsers = async ({ q = '', limit = 20, currentUserId }) => {
  if (!q || !q.trim()) return [];
  const sRegex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const query = {
    status: { $ne: 'banned' },
    $or: [
      { name: sRegex },
      { department: sRegex },
    ],
  };

  const users = await User.find(query)
    .limit(Math.min(parseInt(limit, 10) || 20, 50))
    .sort({ name: 1 });

  return users.map((u) => {
    const isSelf = currentUserId && String(u._id) === String(currentUserId);
    return u.toPublicJSON({ isSelf });
  });
};

const updateProfile = async (
  userId,
  { name, bio, department, semester, anonymousUsername, password, file }
) => {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  if (name !== undefined) user.name = name;
  if (bio !== undefined) user.bio = bio;
  if (department !== undefined) user.department = department;
  if (semester !== undefined) user.semester = semester;
  if (anonymousUsername !== undefined) user.anonymousUsername = anonymousUsername;
  if (password) user.password = password;

  if (file) {
    user.image = await uploadImage(file, '/avatars');
  }

  const updated = await user.save();
  return updated.toPublicJSON({ isSelf: true });
};

/**
 * Delete authenticated user's own account, all of their posts, and comments
 */
const deleteAccount = async (userId) => {
  const userPosts = await Post.find({ user: userId }).select('_id');
  const userPostIds = userPosts.map((p) => p._id);

  await Comment.deleteMany({
    $or: [{ user: userId }, { post: { $in: userPostIds } }],
  });
  await Post.deleteMany({ user: userId });
  await User.findByIdAndDelete(userId);
  return { success: true, message: 'Account and all your posts were deleted' };
};

module.exports = {
  getUserById,
  searchUsers,
  updateProfile,
  deleteAccount,
};
