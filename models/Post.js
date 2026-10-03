const mongoose = require('mongoose');
const { ALLOWED_REACTIONS } = require('../utils/constants');

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
      enum: ALLOWED_REACTIONS,
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

// Compound indexes tailored for feed queries and sorting
postSchema.index({ isDeleted: 1, isHidden: 1, createdAt: -1 });
postSchema.index({ isDeleted: 1, isHidden: 1, department: 1, createdAt: -1 });
postSchema.index({ user: 1, isDeleted: 1, isHidden: 1, createdAt: -1 });
postSchema.index({ 'reactions.user': 1, isDeleted: 1, isHidden: 1, createdAt: -1 });
postSchema.index({ isOfficial: 1, isDeleted: 1, isHidden: 1, createdAt: -1 });

/**
 * Public-safe representation (hides internal viewedBy list; respects anonymous posting; computes reaction counts).
 * Works with both plain JavaScript objects (from .lean()) and Mongoose document instances.
 */
function formatPublicPost(post, currentUserId, isAdminOverride = false) {
  if (!post) return null;
  const rawPost = typeof post.toObject === 'function' ? post.toObject() : post;

  let displayUser = rawPost.user;
  const isAdmin = Boolean(
    rawPost.isOfficial ||
    (rawPost.user && typeof rawPost.user === 'object' && rawPost.user.role === 'admin')
  );

  const rawAuthorId = rawPost.user
    ? (rawPost.user._id ? rawPost.user._id.toString() : rawPost.user.toString())
    : null;
  const isOwner = Boolean(
    currentUserId &&
    rawAuthorId &&
    currentUserId.toString() === rawAuthorId
  );

  if (rawPost.isAnonymous && !isAdmin && !isAdminOverride) {
    displayUser = {
      _id: null,
      name: (rawPost.user && typeof rawPost.user === 'object' && rawPost.user.anonymousUsername) || 'Anonymous',
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

  const counts = {};
  for (const emoji of ALLOWED_REACTIONS) {
    counts[emoji] = 0;
  }
  let userReaction = null;
  const reactionsList = Array.isArray(rawPost.reactions) ? rawPost.reactions : [];

  for (const r of reactionsList) {
    if (r && counts[r.emoji] !== undefined) {
      counts[r.emoji] += 1;
    }
    if (
      currentUserId &&
      r &&
      r.user &&
      (r.user._id ? r.user._id.toString() : r.user.toString()) === currentUserId.toString() &&
      counts[r.emoji] !== undefined
    ) {
      userReaction = r.emoji;
    }
  }

  return {
    id: rawPost._id || rawPost.id,
    user: displayUser,
    text: rawPost.text,
    image: rawPost.image || '',
    department: rawPost.department || '',
    semester: rawPost.semester || '',
    isAnonymous: Boolean(rawPost.isAnonymous && !isAdmin),
    isAdminPost: isAdmin,
    isOfficial: isAdmin,
    isOwner,
    isHidden: Boolean(rawPost.isHidden),
    isDeleted: Boolean(rawPost.isDeleted),
    status: rawPost.isDeleted ? 'deleted' : rawPost.isHidden ? 'hidden' : 'active',
    views: rawPost.views || 0,
    commentsCount: rawPost.commentsCount || 0,
    reactions: {
      counts,
      total: reactionsList.length,
      userReaction,
    },
    createdAt: rawPost.createdAt,
    updatedAt: rawPost.updatedAt,
  };
}

postSchema.methods.toPublicJSON = function toPublicJSON(currentUserId) {
  return formatPublicPost(this, currentUserId);
};

postSchema.statics.formatPublicPost = formatPublicPost;

module.exports = mongoose.model('Post', postSchema);
