const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    emoji: {
      type: String,
      required: [true, 'Reaction emoji is required'],
      enum: ['❤️', '💩', '💀'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const postSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: [true, 'Post text is required'],
      trim: true,
      maxlength: [2000, 'Post cannot exceed 2000 characters'],
    },
    image: {
      // optional image attached to the rant/post
      type: String,
      default: '',
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    semester: {
      type: String,
      trim: true,
      default: '',
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    views: {
      type: Number,
      default: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    // Tracks who has already been counted as a viewer so refreshing the
    // same post doesn't inflate the count. Stores a logged-in user's id,
    // or a hashed guest identifier (IP) for anonymous viewers.
    viewedBy: {
      type: [String],
      default: [],
      select: false,
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    hiddenAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    moderatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    moderationReason: {
      type: String,
      default: '',
    },
    trendingNotified: {
      type: Boolean,
      default: false,
    },
    isOfficial: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

postSchema.virtual('status').get(function () {
  if (this.isDeleted) return 'deleted';
  if (this.isHidden) return 'hidden';
  return 'active';
});

postSchema.index({ createdAt: -1 });
postSchema.index({ department: 1, createdAt: -1 });
postSchema.index({ user: 1, isAnonymous: 1, createdAt: -1 });
postSchema.index({ isHidden: 1, isDeleted: 1 });
postSchema.index({ isOfficial: 1 });

// Public-safe representation (hides internal viewedBy list; respects anonymous posting; computes reaction counts)
postSchema.methods.toPublicJSON = function toPublicJSON(currentUserId) {
  let displayUser = this.user;
  const isAdmin = Boolean(
    this.isOfficial ||
    (this.user && typeof this.user === 'object' && this.user.role === 'admin')
  );

  const rawAuthorId = this.user
    ? (this.user._id ? this.user._id.toString() : this.user.toString())
    : null;
  const isOwner = Boolean(
    currentUserId &&
    rawAuthorId &&
    currentUserId.toString() === rawAuthorId
  );

  if (this.isAnonymous && !isAdmin) {
    displayUser = {
      _id: null,
      name: (this.user && typeof this.user === 'object' && this.user.anonymousUsername) || 'Anonymous',
      image: '',
      role: 'user',
    };
  } else if (displayUser && typeof displayUser === 'object') {
    const rawUser = typeof displayUser.toObject === 'function' ? displayUser.toObject() : displayUser;
    displayUser = {
      _id: rawUser._id || rawUser.id,
      name: isAdmin ? 'Head of MAKAU-TEA Affairs 📢' : (rawUser.name || 'Student'),
      image: rawUser.image || '',
      department: rawUser.department || '',
      semester: rawUser.semester || '',
      role: rawUser.role || 'user',
    };
  }

  const counts = { '❤️': 0, '💩': 0, '💀': 0 };
  let userReaction = null;
  const reactionsList = Array.isArray(this.reactions) ? this.reactions : [];

  for (const r of reactionsList) {
    if (counts[r.emoji] !== undefined) {
      counts[r.emoji] += 1;
    }
    if (
      currentUserId &&
      r.user &&
      (r.user._id ? r.user._id.toString() : r.user.toString()) === currentUserId.toString() &&
      counts[r.emoji] !== undefined
    ) {
      userReaction = r.emoji;
    }
  }

  return {
    id: this._id,
    user: displayUser,
    text: this.text,
    image: this.image,
    department: this.department,
    semester: this.semester,
    isAnonymous: Boolean(this.isAnonymous && !isAdmin),
    isAdminPost: isAdmin,
    isOfficial: isAdmin,
    isOwner,
    isHidden: Boolean(this.isHidden),
    isDeleted: Boolean(this.isDeleted),
    status: this.isDeleted ? 'deleted' : this.isHidden ? 'hidden' : 'active',
    views: this.views,
    commentsCount: this.commentsCount || 0,
    reactions: {
      counts,
      total: reactionsList.length,
      userReaction,
    },
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Post', postSchema);
