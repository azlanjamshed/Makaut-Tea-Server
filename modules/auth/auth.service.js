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

const { OAuth2Client } = require('google-auth-library');

/**
 * Sign in or register via Google OAuth
 */
const googleLogin = async ({ credential, clientId, devUser }) => {
  let googleId, email, name, picture;

  // 1. If devUser provided in development without Google Cloud credentials
  if (process.env.NODE_ENV !== 'production' && devUser && devUser.email) {
    email = devUser.email.toLowerCase().trim();
    name = devUser.name || email.split('@')[0];
    googleId = devUser.googleId || `dev_google_${Buffer.from(email).toString('hex').slice(0, 16)}`;
    picture = devUser.picture || '';
  } else if (credential) {
    // 2. Official Google ID Token Verification
    const activeClientId = process.env.GOOGLE_CLIENT_ID || clientId;
    let payload;
    try {
      const client = new OAuth2Client(activeClientId);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: activeClientId || undefined,
      });
      payload = ticket.getPayload();
    } catch (err) {
      // Fallback: Verify via Google tokeninfo endpoint
      const https = require('https');
      payload = await new Promise((resolve, reject) => {
        https
          .get(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              try {
                const parsed = JSON.parse(data);
                if (parsed.error_description || parsed.error) {
                  reject(new Error(parsed.error_description || parsed.error));
                } else {
                  resolve(parsed);
                }
              } catch (e) {
                reject(e);
              }
            });
          })
          .on('error', reject);
      });
    }

    if (!payload || !payload.email) {
      const error = new Error('Invalid Google credential token');
      error.status = 401;
      throw error;
    }

    googleId = payload.sub;
    email = payload.email.toLowerCase().trim();
    name = payload.name || payload.given_name || email.split('@')[0];
    picture = payload.picture || '';
  } else {
    const error = new Error('Google credential is required');
    error.status = 400;
    throw error;
  }

  // 3. Find or create user
  let user = await User.findOne({ $or: [{ googleId }, { email }] });

  if (user) {
    if (!user.googleId) {
      user.googleId = googleId;
    }
    if (!user.image && picture) {
      user.image = picture;
    }
    user.lastActiveAt = new Date();
    await user.save();
  } else {
    user = await User.create({
      name,
      email,
      googleId,
      image: picture,
      department: '',
      semester: '',
      role: 'user',
    });
  }

  const needsOnboarding = !user.department || !user.semester;

  return {
    user: user.toPublicJSON({ isSelf: true }),
    token: generateToken(user._id),
    needsOnboarding,
  };
};

/**
 * Complete onboarding (department, semester, bio) after OAuth registration
 */
const completeOnboarding = async (userId, { department, semester, bio }) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }

  if (department) user.department = department.trim();
  if (semester) user.semester = semester.trim();
  if (bio !== undefined) user.bio = bio.trim();

  await user.save();

  return user.toPublicJSON({ isSelf: true });
};

module.exports = {
  registerUser,
  loginUser,
  googleLogin,
  completeOnboarding,
  getMe,
  changePassword,
};
