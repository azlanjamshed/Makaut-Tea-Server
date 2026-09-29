const User = require('../../models/User');
const generateToken = require('../../utils/generateToken');
const { uploadImage } = require('../../utils/imagekit');

/**
 * Register a new user account
 */
const registerUser = async ({
  name,
  email,
  password,
  bio,
  department,
  semester,
  anonymousUsername,
  file,
}) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const error = new Error('An account with that email already exists');
    error.status = 400;
    throw error;
  }

  const image = file ? await uploadImage(file, '/avatars') : '';
  const userData = {
    name,
    email,
    password,
    bio: bio || '',
    department: department || '',
    semester: semester || '',
    image,
  };
  if (anonymousUsername) {
    userData.anonymousUsername = anonymousUsername;
  }

  const user = await User.create(userData);

  return {
    user: user.toPublicJSON({ isSelf: true }),
    token: generateToken(user._id),
  };
};

/**
 * Authenticate existing user with email and password
 */
const loginUser = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.matchPassword(password))) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  return {
    user: user.toPublicJSON({ isSelf: true }),
    token: generateToken(user._id),
  };
};

/**
 * Return public profile representation of the logged-in user
 */
const getMe = async (user) => {
  return user.toPublicJSON({ isSelf: true });
};

/**
 * Change password after verifying current password
 */
const changePassword = async (userId, { currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+password');

  if (!user || !(await user.matchPassword(currentPassword))) {
    const error = new Error('Current password is incorrect');
    error.status = 401;
    throw error;
  }

  if (currentPassword === newPassword) {
    const error = new Error('New password must be different from current password');
    error.status = 400;
    throw error;
  }

  user.password = newPassword;
  await user.save();

  return { success: true, message: 'Password changed successfully' };
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
  changePassword,
};
