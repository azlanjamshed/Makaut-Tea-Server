const AnnouncementRequest = require('../../models/AnnouncementRequest');
const Post = require('../../models/Post');
const User = require('../../models/User');
const { uploadImage } = require('../../utils/imagekit');
const { createNotification } = require('../notification/notification.service');

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Student creates an announcement request to be verified & broadcasted by admin
 */
const createRequest = async ({
  userId,
  title,
  text,
  category,
  targetAudience,
  contactInfo,
  file,
}) => {
  const image = file ? await uploadImage(file, '/announcements') : '';

  const request = await AnnouncementRequest.create({
    user: userId,
    title: title.trim(),
    text: text.trim(),
    category: category || 'general',
    targetAudience: targetAudience ? targetAudience.trim() : 'All Students',
    contactInfo: contactInfo ? contactInfo.trim() : '',
    image,
    status: 'pending',
  });

  await request.populate('user', 'name email department semester image role');
  return request.toPublicJSON();
};

/**
 * Student retrieves their own submitted announcement requests
 */
const getMyRequests = async (userId) => {
  const requests = await AnnouncementRequest.find({ user: userId })
    .sort({ createdAt: -1 })
    .populate('user', 'name email department semester image role')
    .populate('reviewedBy', 'name');

  return requests.map((r) => r.toPublicJSON());
};

/**
 * Student deletes/cancels their own pending announcement request
 */
const deleteMyRequest = async (requestId, userId) => {
  const request = await AnnouncementRequest.findById(requestId);
  if (!request) {
    const error = new Error('Announcement request not found');
    error.status = 404;
    throw error;
  }

  if (request.user.toString() !== userId.toString()) {
    const error = new Error('You can only delete your own announcement requests');
    error.status = 403;
    throw error;
  }

  if (request.status === 'approved') {
    const error = new Error('Cannot delete an already approved & broadcasted announcement');
    error.status = 400;
    throw error;
  }

  await request.deleteOne();
  return { success: true, message: 'Announcement request cancelled successfully' };
};

/**
 * Admin: Get all announcement requests with filters & pagination
 */
const getAdminRequests = async ({
  page = 1,
  limit = 20,
  status = 'all',
  category,
  search,
} = {}) => {
  const validPage = Math.max(parseInt(page, 10) || 1, 1);
  const validLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (validPage - 1) * validLimit;

  const query = {};

  if (status && status !== 'all') {
    query.status = status;
  }

  if (category && category !== 'all') {
    query.category = category;
  }

  if (search && typeof search === 'string' && search.trim()) {
    const term = new RegExp(escapeRegex(search.trim()), 'i');
    query.$or = [{ title: term }, { text: term }, { targetAudience: term }, { contactInfo: term }];
  }

  const [requests, total] = await Promise.all([
    AnnouncementRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(validLimit)
      .populate('user', 'name email department semester image role')
      .populate('reviewedBy', 'name email'),
    AnnouncementRequest.countDocuments(query),
  ]);

  return {
    requests: requests.map((r) => r.toPublicJSON()),
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      pages: Math.ceil(total / validLimit) || 1,
    },
  };
};

/**
 * Admin: Get counts for dashboard badges
 */
const getAdminRequestCounts = async () => {
  const [pending, approved, rejected, total] = await Promise.all([
    AnnouncementRequest.countDocuments({ status: 'pending' }),
    AnnouncementRequest.countDocuments({ status: 'approved' }),
    AnnouncementRequest.countDocuments({ status: 'rejected' }),
    AnnouncementRequest.countDocuments({}),
  ]);

  return { pending, approved, rejected, total };
};

/**
 * Admin: Get single request details
 */
const getAdminRequestById = async (requestId) => {
  const request = await AnnouncementRequest.findById(requestId)
    .populate('user', 'name email department semester image role')
    .populate('reviewedBy', 'name email')
    .populate('publishedPost', 'text department semester image createdAt isOfficial');

  if (!request) {
    const error = new Error('Announcement request not found');
    error.status = 404;
    throw error;
  }

  return request.toPublicJSON();
};

/**
 * Admin: Approve request & broadcast immediately to the campus stream
 */
const approveRequest = async (
  requestId,
  adminId,
  { customizedText, department, semester, notes } = {}
) => {
  const request = await AnnouncementRequest.findById(requestId).populate(
    'user',
    'name email department semester image role'
  );
  if (!request) {
    const error = new Error('Announcement request not found');
    error.status = 404;
    throw error;
  }

  if (request.status === 'approved') {
    const error = new Error('This announcement request has already been approved and broadcasted');
    error.status = 400;
    throw error;
  }

  // Compose official campus announcement post
  const studentCredit = request.user ? `Initiative proposed by: ${request.user.name}` : '';
  const postBody =
    customizedText && customizedText.trim()
      ? customizedText.trim()
      : `📢 [CAMPUS BROADCAST: ${request.title.toUpperCase()}]\n\n${request.text}\n\n📌 Target Audience: ${request.targetAudience}${request.contactInfo ? `\n📞 Contact / Info: ${request.contactInfo}` : ''}${studentCredit ? `\n\n(Official verified submission • ${studentCredit})` : ''}`;

  const officialPost = await Post.create({
    user: adminId, // Admin is the author / broadcaster
    text: postBody,
    department: department || request.targetAudience || 'All Departments',
    semester: semester || '',
    isOfficial: true,
    isAnonymous: false,
    image: request.image || '',
  });

  request.status = 'approved';
  request.publishedPost = officialPost._id;
  request.reviewedBy = adminId;
  request.reviewedAt = new Date();
  request.adminFeedback = notes || 'Verified and approved for university broadcast';
  await request.save();

  await request.populate('user', 'name email department semester image role');
  await request.populate('reviewedBy', 'name email');

  // Notify the student applicant
  if (request.user) {
    createNotification({
      recipient: request.user._id,
      sender: adminId,
      type: 'announcement',
      post: officialPost._id,
      message: `🎉 Great news! Your announcement "${request.title}" was approved by the administration and broadcasted campus-wide!`,
    }).catch(() => {});
  }

  return {
    request: request.toPublicJSON(),
    publishedPost: officialPost.toPublicJSON(),
  };
};

/**
 * Admin: Reject request with feedback / reason
 */
const rejectRequest = async (requestId, adminId, { reason }) => {
  const request = await AnnouncementRequest.findById(requestId).populate(
    'user',
    'name email department semester image role'
  );
  if (!request) {
    const error = new Error('Announcement request not found');
    error.status = 404;
    throw error;
  }

  request.status = 'rejected';
  request.adminFeedback = reason && reason.trim() ? reason.trim() : 'Does not meet guidelines for official campus broadcast.';
  request.reviewedBy = adminId;
  request.reviewedAt = new Date();
  await request.save();

  await request.populate('user', 'name email department semester image role');
  await request.populate('reviewedBy', 'name email');

  // Notify student applicant
  if (request.user) {
    createNotification({
      recipient: request.user._id,
      sender: adminId,
      type: 'announcement',
      message: `Your announcement request "${request.title}" was not approved: ${request.adminFeedback}`,
    }).catch(() => {});
  }

  return request.toPublicJSON();
};

module.exports = {
  createRequest,
  getMyRequests,
  deleteMyRequest,
  getAdminRequests,
  getAdminRequestCounts,
  getAdminRequestById,
  approveRequest,
  rejectRequest,
};
