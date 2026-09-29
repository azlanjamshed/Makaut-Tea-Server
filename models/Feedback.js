const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ['bug', 'suggestion', 'general'],
      required: true,
      default: 'suggestion',
      index: true,
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Message / Description is required'],
      trim: true,
      maxlength: [4000, 'Description cannot exceed 4000 characters'],
    },
    deviceInfo: {
      type: String,
      trim: true,
      default: '',
    },
    contactEmail: {
      type: String,
      trim: true,
      default: '',
    },
    image: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['new', 'in_review', 'resolved', 'dismissed'],
      default: 'new',
      index: true,
    },
    adminNotes: {
      type: String,
      trim: true,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

feedbackSchema.index({ type: 1, status: 1, createdAt: -1 });

feedbackSchema.methods.toPublicJSON = function toPublicJSON() {
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
        image: rawUser.image || '',
      }
    : null;

  return {
    id: this._id,
    _id: this._id,
    user: formattedUser,
    type: this.type,
    subject: this.subject,
    description: this.description,
    deviceInfo: this.deviceInfo,
    contactEmail: this.contactEmail,
    image: this.image,
    status: this.status,
    adminNotes: this.adminNotes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Feedback', feedbackSchema);
