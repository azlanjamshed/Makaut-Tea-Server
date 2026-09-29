const Feedback = require('../../models/Feedback');
const { uploadImage } = require('../../utils/imagekit');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const submitFeedback = async ({
  userId,
  type = 'suggestion',
  subject,
  description,
  deviceInfo,
  contactEmail,
  file,
}) => {
  const image = file ? await uploadImage(file, '/feedback') : '';

  const feedback = await Feedback.create({
    user: userId || null,
    type,
    subject: subject.trim(),
    description: description.trim(),
    deviceInfo: deviceInfo ? deviceInfo.trim() : '',
    contactEmail: contactEmail ? contactEmail.trim().toLowerCase() : '',
    image,
    status: 'new',
  });

  if (userId) {
    await feedback.populate('user', 'name email department image');
  }

  return feedback.toPublicJSON();
};

const getMyFeedback = async (userId) => {
  const list = await Feedback.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate('user', 'name email department image');

  return list.map((f) => f.toPublicJSON());
};

const getAdminFeedbacks = async ({
  page = 1,
  limit = 20,
  type = 'all',
  status = 'all',
  search,
} = {}) => {
  const validPage = Math.max(parseInt(page, 10) || 1, 1);
  const validLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (validPage - 1) * validLimit;

  const query = {};

  if (type && type !== 'all') {
    query.type = type;
  }

  if (status && status !== 'all') {
    query.status = status;
  }

  if (search && typeof search === 'string' && search.trim()) {
    const term = new RegExp(escapeRegex(search.trim()), 'i');
    query.$or = [{ subject: term }, { description: term }, { contactEmail: term }];
  }

  const [feedbacks, total] = await Promise.all([
    Feedback.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(validLimit)
      .populate('user', 'name email department image role')
      .populate('reviewedBy', 'name email'),
    Feedback.countDocuments(query),
  ]);

  return {
    feedbacks: feedbacks.map((f) => f.toPublicJSON()),
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      pages: Math.ceil(total / validLimit) || 1,
    },
  };
};

const updateFeedbackStatus = async (feedbackId, adminId, { status, adminNotes }) => {
  const item = await Feedback.findById(feedbackId);
  if (!item) {
    const error = new Error('Feedback not found');
    error.status = 404;
    throw error;
  }

  if (status) item.status = status;
  if (adminNotes !== undefined) item.adminNotes = adminNotes;
  item.reviewedBy = adminId;
  await item.save();

  await item.populate('user', 'name email department image role');
  await item.populate('reviewedBy', 'name email');

  return item.toPublicJSON();
};

module.exports = {
  submitFeedback,
  getMyFeedback,
  getAdminFeedbacks,
  updateFeedbackStatus,
};
