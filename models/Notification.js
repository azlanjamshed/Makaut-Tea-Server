const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: {
      type: String,
      enum: ['comment', 'reply', 'reaction', 'trending', 'announcement', 'system'],
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      default: null,
    },
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    reactionEmoji: {
      type: String,
      default: '',
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

notificationSchema.methods.toPublicJSON = function toPublicJSON() {
  let displaySender = null;
  if (this.sender && typeof this.sender === 'object') {
    if (this.isAnonymous) {
      displaySender = {
        _id: this.sender._id,
        name: this.sender.anonymousUsername || 'Anonymous',
        image: '',
      };
    } else {
      displaySender = {
        _id: this.sender._id,
        name: this.sender.name,
        image: this.sender.image || '',
        anonymousUsername: this.sender.anonymousUsername,
      };
    }
  }

  return {
    id: this._id,
    recipient: this.recipient,
    sender: displaySender,
    type: this.type,
    post: this.post,
    comment: this.comment,
    reactionEmoji: this.reactionEmoji,
    message: this.message,
    isRead: this.isRead,
    readAt: this.readAt,
    isAnonymous: this.isAnonymous,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Notification', notificationSchema);
