const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// RFC-5322-ish practical email regex (covers the vast majority of valid,
// real-world addresses without being overly permissive).
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      validate: {
        validator: (value) => EMAIL_REGEX.test(value),
        message: 'Please provide a valid email address',
      },
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId;
      },
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // never return password by default
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [300, 'Bio cannot exceed 300 characters'],
      default: '',
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, 'Department cannot exceed 100 characters'],
      default: '',
    },
    semester: {
      type: String,
      trim: true,
      maxlength: [50, 'Semester/year cannot exceed 50 characters'],
      default: '',
    },
    anonymousUsername: {
      type: String,
      trim: true,
      maxlength: [50, 'Anonymous username cannot exceed 50 characters'],
      default: () => `anon_${Math.floor(100000 + Math.random() * 900000)}`,
    },
    image: {
      // path or URL to the uploaded profile image (ImageKit or local)
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'banned'],
      default: 'active',
    },
    suspendedUntil: {
      type: Date,
      default: null,
    },
    suspensionReason: {
      type: String,
      trim: true,
      default: '',
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

userSchema.index({ name: 1 });
userSchema.index({ anonymousUsername: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });

// Hash password before saving, only if it exists and was modified
userSchema.pre('save', async function hashPassword(next) {
  if (!this.password || !this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method to compare a plaintext password with the stored hash
userSchema.methods.matchPassword = async function matchPassword(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Public-safe representation (no password; hides sensitive data like email and anonymousUsername unless isSelf)
userSchema.methods.toPublicJSON = function toPublicJSON(options = {}) {
  const isSelf = typeof options === 'boolean' ? options : Boolean(options && (options.isSelf || options.isAdmin));
  const data = {
    id: this._id,
    name: this.name,
    bio: this.bio || '',
    department: this.department || '',
    semester: this.semester || '',
    image: this.image || '',
    role: this.role || 'user',
    createdAt: this.createdAt,
  };

  if (isSelf) {
    data.email = this.email;
    data.anonymousUsername = this.anonymousUsername;
    data.status = this.status;
    data.suspendedUntil = this.suspendedUntil;
  }

  return data;
};

module.exports = mongoose.model('User', userSchema);
