const mongoose = require('mongoose');

const announcementRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student applicant ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Announcement title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    text: {
      type: String,
      required: [true, 'Announcement details/text is required'],
      trim: true,
      maxlength: [3000, 'Details cannot exceed 3000 characters'],
    },
    category: {
      type: String,
      enum: ['event', 'academic', 'club', 'urgent', 'lost_found', 'general'],
      default: 'general',
      index: true,
    },
    targetAudience: {
      type: String,
      trim: true,
      default: 'All Students',
      maxlength: [100, 'Target audience cannot exceed 100 characters'],
    },
    contactInfo: {
      type: String,
      trim: true,
      default: '',
      maxlength: [150, 'Contact info cannot exceed 150 characters'],
    },
    image: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminFeedback: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Feedback cannot exceed 1000 characters'],
    },
    publishedPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

announcementRequestSchema.index({ status: 1, createdAt: -1 });

announcementRequestSchema.methods.toPublicJSON = function toPublicJSON() {
  const rawUser = this.user && typeof this.user === 'object' && typeof this.user.toObject === 'function'
    ? this.user.toObject()
    : this.user;

  const formattedUser = rawUser && typeof rawUser === 'object'
    ? {
        _id: rawUser._id || rawUser.id,
        id: rawUser._id || rawUser.id,
        name: rawUser.name || 'Student',
        email: rawUser.email || '',
        department: rawUser.department || '',
        semester: rawUser.semester || '',
        image: rawUser.image || '',
        role: rawUser.role || 'user',
      }
    : rawUser;

  const rawReviewer = this.reviewedBy && typeof this.reviewedBy === 'object' && typeof this.reviewedBy.toObject === 'function'
    ? this.reviewedBy.toObject()
    : this.reviewedBy;

  const formattedReviewer = rawReviewer && typeof rawReviewer === 'object'
    ? {
        _id: rawReviewer._id || rawReviewer.id,
        id: rawReviewer._id || rawReviewer.id,
        name: rawReviewer.name || 'Administrator',
      }
    : rawReviewer;

  return {
    id: this._id,
    _id: this._id,
    user: formattedUser,
    title: this.title,
    text: this.text,
    category: this.category,
    targetAudience: this.targetAudience,
    contactInfo: this.contactInfo,
    image: this.image,
    status: this.status,
    adminFeedback: this.adminFeedback,
    publishedPost: this.publishedPost,
    reviewedBy: formattedReviewer,
    reviewedAt: this.reviewedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('AnnouncementRequest', announcementRequestSchema);
