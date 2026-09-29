const mongoose = require('mongoose');

const replySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    text: {
      type: String,
      required: [true, 'Reply text is required'],
      trim: true,
      maxlength: [1000, 'Reply cannot exceed 1000 characters'],
    },
    isAnonymous: {
      type: Boolean,
      default: false,
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
  },
  { timestamps: true }
);

const commentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: [true, 'Post ID is required'],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    text: {
      type: String,
      required: [true, 'Comment text is required'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
    isAnonymous: {
      type: Boolean,
      default: false,
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
    replies: {
      type: [replySchema],
      default: [],
    },
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, createdAt: -1 });

commentSchema.methods.formatReply = function formatReply(reply, currentUserId) {
  let displayUser = reply.user;
  const isAdmin = Boolean(reply.user && typeof reply.user === 'object' && reply.user.role === 'admin');
  const rawAuthorId = reply.user
    ? (reply.user._id ? reply.user._id.toString() : reply.user.toString())
    : null;
  const isOwner = Boolean(
    currentUserId &&
    rawAuthorId &&
    currentUserId.toString() === rawAuthorId
  );

  if (reply.isAnonymous && !isAdmin) {
    displayUser = {
      _id: null,
      name: (reply.user && typeof reply.user === 'object' && reply.user.anonymousUsername) || 'Anonymous',
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
  return {
    id: reply._id,
    user: displayUser,
    isAdminComment: isAdmin,
    isOwner,
    text: reply.text,
    isAnonymous: Boolean(reply.isAnonymous && !isAdmin),
    department: reply.department,
    semester: reply.semester,
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt,
  };
};

commentSchema.methods.toPublicJSON = function toPublicJSON(currentUserId) {
  let displayUser = this.user;
  const isAdmin = Boolean(this.user && typeof this.user === 'object' && this.user.role === 'admin');
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

  const repliesList = Array.isArray(this.replies) ? this.replies : [];
  const formattedReplies = repliesList.map((r) => this.formatReply(r, currentUserId));

  return {
    id: this._id,
    post: this.post,
    user: displayUser,
    isAdminComment: isAdmin,
    isOwner,
    text: this.text,
    isAnonymous: Boolean(this.isAnonymous && !isAdmin),
    department: this.department,
    semester: this.semester,
    repliesCount: repliesList.length,
    replies: formattedReplies,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Comment', commentSchema);
