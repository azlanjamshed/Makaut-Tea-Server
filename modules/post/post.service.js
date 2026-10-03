const Post = require("../../models/Post");
const User = require("../../models/User");
const Comment = require("../../models/Comment");
const { uploadImage } = require("../../utils/imagekit");
const { ALLOWED_REACTIONS } = require("../../utils/constants");
const {
  createNotification,
  checkAndNotifyTrending,
} = require("../notification/notification.service");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Create a new post / rant
 */
const createPost = async ({
  userId,
  text,
  department,
  semester,
  isAnonymous,
  isOfficial,
  file,
}) => {
  const image = file ? await uploadImage(file, "/posts") : "";
  const post = await Post.create({
    user: userId,
    text,
    department: department || "",
    semester: semester || "",
    isAnonymous: Boolean(isAnonymous),
    isOfficial: Boolean(isOfficial),
    image,
  });
  await post.populate(
    "user",
    "name image anonymousUsername department semester role",
  );
  return post.toPublicJSON(userId);
};

/**
 * Get paginated list of posts (newest first, optionally filtered/searched by department, username, or keyword)
 */
const getPosts = async ({
  page = 1,
  limit = 10,
  department,
  username,
  q,
  currentUserId,
  isAdmin = false,
} = {}) => {
  const validPage = Math.max(parseInt(page, 10) || 1, 1);
  const validLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const skip = (validPage - 1) * validLimit;

  const query = {
    isHidden: { $ne: true },
    isDeleted: { $ne: true },
  };

  // Department filter / search (case-insensitive substring match)
  if (department && typeof department === "string" && department.trim()) {
    query.department = new RegExp(escapeRegex(department.trim()), "i");
  }

  // Username search (privacy-preserving)
  // Searching real name only returns public posts (isAnonymous: false)
  // Searching anonymous handle only returns anonymous posts (isAnonymous: true)
  if (username && typeof username === "string" && username.trim()) {
    const userRegex = new RegExp(escapeRegex(username.trim()), "i");
    const matchedUsers = await User.find({
      $or: [{ name: userRegex }, { anonymousUsername: userRegex }],
    }).select("_id name anonymousUsername");

    if (matchedUsers.length === 0) {
      return {
        posts: [],
        pagination: {
          page: validPage,
          limit: validLimit,
          total: 0,
          pages: 0,
        },
      };
    }

    const userConditions = [];
    for (const u of matchedUsers) {
      if (userRegex.test(u.name)) {
        userConditions.push({ user: u._id, isAnonymous: { $ne: true } });
      }
      if (u.anonymousUsername && userRegex.test(u.anonymousUsername)) {
        userConditions.push({ user: u._id, isAnonymous: true });
      }
    }

    if (userConditions.length === 0) {
      return {
        posts: [],
        pagination: {
          page: validPage,
          limit: validLimit,
          total: 0,
          pages: 0,
          hasMore: false,
        },
      };
    }

    query.$or = userConditions;
  }

  // Keyword search on post text
  if (q && typeof q === "string" && q.trim()) {
    const textRegex = new RegExp(escapeRegex(q.trim()), "i");
    if (query.$or) {
      query.$and = [{ $or: query.$or }, { text: textRegex }];
      delete query.$or;
    } else {
      query.text = textRegex;
    }
  }

  const [posts, total] = await Promise.all([
    Post.find(query)
      .select("-__v -moderationReason -moderatedBy -trendingNotified")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(validLimit)
      .populate("user", "name image anonymousUsername department semester role")
      .lean(),
    Post.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / validLimit) || 0;

  return {
    posts: posts.map((p) => Post.formatPublicPost(p, currentUserId, isAdmin)),
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      pages: totalPages,
      hasMore: validPage < totalPages,
    },
  };
};

/**
 * Search posts by department, username, or text query (alias to getPosts)
 */
const searchPosts = async (params) => {
  return getPosts(params);
};

/**
 * Get posts by department
 */
const getPostsByDepartment = async (
  department,
  { page = 1, limit = 10, currentUserId } = {},
) => {
  return getPosts({ page, limit, department, currentUserId });
};

/**
 * Get a single post by ID and track unique views
 */
const getPostById = async (postId, viewerId, currentUserId) => {
  const post = await Post.findById(postId)
    .select("+viewedBy")
    .populate("user", "name image anonymousUsername department semester role");

  if (!post || post.isDeleted || post.isHidden) {
    const error = new Error("Post not found");
    error.status = 404;
    throw error;
  }

  if (!post.viewedBy) post.viewedBy = [];
  if (typeof post.views !== "number") post.views = 0;

  if (viewerId && !post.viewedBy.includes(viewerId)) {
    post.viewedBy.push(viewerId);
    post.views += 1;
    await post.save();
  }

  return post.toPublicJSON(currentUserId);
};

/**
 * Update an existing post (owner only)
 */
const updatePost = async (postId, userId, { text, isAnonymous, file }) => {
  const post = await Post.findById(postId);

  if (!post) {
    const error = new Error("Post not found");
    error.status = 404;
    throw error;
  }

  if (post.user.toString() !== userId.toString()) {
    const error = new Error("You can only edit your own posts");
    error.status = 403;
    throw error;
  }

  if (text !== undefined) post.text = text;
  if (isAnonymous !== undefined) post.isAnonymous = Boolean(isAnonymous);
  if (file) post.image = await uploadImage(file, "/posts");

  const updated = await post.save();
  await updated.populate(
    "user",
    "name image anonymousUsername department semester role",
  );
  return updated.toPublicJSON(userId);
};

/**
 * Delete a post (owner only)
 */
const deletePost = async (postId, userId) => {
  const post = await Post.findById(postId);

  if (!post) {
    const error = new Error("Post not found");
    error.status = 404;
    throw error;
  }

  if (post.user.toString() !== userId.toString()) {
    const error = new Error("You can only delete your own posts");
    error.status = 403;
    throw error;
  }

  await Comment.deleteMany({ post: postId });
  await post.deleteOne();
  return { success: true, message: "Post deleted" };
};

/**
 * Get all posts created by a specific user with pagination
 */
const getPostsByUser = async (
  userId,
  currentUserId,
  { page = 1, limit = 10 } = {},
  isAdmin = false,
) => {
  const isSelf = currentUserId && String(userId) === String(currentUserId);
  const validPage = Math.max(parseInt(page, 10) || 1, 1);
  const validLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const skip = (validPage - 1) * validLimit;

  const query = {
    user: userId,
  };

  // If not admin, hide moderation hidden/deleted posts and respect student anonymity
  if (!isAdmin) {
    query.isHidden = { $ne: true };
    query.isDeleted = { $ne: true };
    if (!isSelf) {
      query.isAnonymous = { $ne: true };
    }
  }

  const [posts, total] = await Promise.all([
    Post.find(query)
      .select("-__v -moderationReason -moderatedBy -trendingNotified")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(validLimit)
      .populate("user", "name image anonymousUsername department semester role")
      .lean(),
    Post.countDocuments(query),
  ]);

  const totalPages = Math.ceil(total / validLimit) || 0;

  return {
    posts: posts.map((p) => Post.formatPublicPost(p, currentUserId)),
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      pages: totalPages,
      hasMore: validPage < totalPages,
    },
  };
};

/**
 * Add, change, or toggle reaction on a post
 */
const reactToPost = async (postId, userId, emoji) => {
  const post = await Post.findById(postId);

  if (!post) {
    const error = new Error("Post not found");
    error.status = 404;
    throw error;
  }

  post.reactions = (post.reactions || []).filter(
    (r) => r && r.user && ALLOWED_REACTIONS.includes(r.emoji),
  );

  const existingIndex = post.reactions.findIndex(
    (r) => r.user.toString() === userId.toString(),
  );

  let action = "added";
  if (existingIndex > -1) {
    if (post.reactions[existingIndex].emoji === emoji) {
      // User clicked the same emoji -> remove reaction (toggle)
      post.reactions.splice(existingIndex, 1);
      action = "removed";
    } else {
      // User chose a different emoji -> change reaction
      post.reactions[existingIndex].emoji = emoji;
      post.reactions[existingIndex].createdAt = new Date();
      action = "changed";
    }
  } else {
    // Add new reaction
    post.reactions.push({
      user: userId,
      emoji,
      createdAt: new Date(),
    });
    action = "added";
  }

  await post.save();
  await post.populate(
    "user",
    "name image anonymousUsername department semester role",
  );

  // Trigger reaction notification for post owner if different user
  if (
    post.user &&
    post.user._id &&
    post.user._id.toString() !== userId.toString()
  ) {
    const senderUser = await User.findById(userId).select(
      "name anonymousUsername",
    );
    const senderName = senderUser ? senderUser.name : "Someone";
    createNotification({
      recipient: post.user._id,
      sender: userId,
      type: "reaction",
      post: post._id,
      reactionEmoji: emoji,
      message: `${senderName} reacted ${emoji} to your rant`,
    }).catch(() => {});
  }

  // Check if post becomes trending
  checkAndNotifyTrending(post).catch(() => {});

  return {
    action,
    post: post.toPublicJSON(userId),
  };
};

/**
 * Explicitly remove user reaction from a post
 */
const removeReaction = async (postId, userId) => {
  const post = await Post.findById(postId);

  if (!post) {
    const error = new Error("Post not found");
    error.status = 404;
    throw error;
  }

  post.reactions = (post.reactions || []).filter(
    (r) => r && r.user && ALLOWED_REACTIONS.includes(r.emoji),
  );

  const existingIndex = post.reactions.findIndex(
    (r) => r.user.toString() === userId.toString(),
  );
  if (existingIndex > -1) {
    post.reactions.splice(existingIndex, 1);
  }
  await post.save();

  await post.populate(
    "user",
    "name image anonymousUsername department semester role",
  );
  return post.toPublicJSON(userId);
};

/**
 * Get detailed list of users who reacted to a post.
 * Strictly restricted to the post owner.
 */
const getPostReactions = async (postId, requesterId) => {
  const post = await Post.findById(postId).populate(
    "reactions.user",
    "name image department semester anonymousUsername",
  );

  if (!post) {
    const error = new Error("Post not found");
    error.status = 404;
    throw error;
  }

  if (post.user.toString() !== requesterId.toString()) {
    const error = new Error(
      "Only the post owner can see who reacted to their post",
    );
    error.status = 403;
    throw error;
  }

  const postPublic = post.toPublicJSON(requesterId);

  const reactors = (post.reactions || [])
    .filter((r) => r.user && r.user._id)
    .map((r) => ({
      id: r._id,
      emoji: r.emoji,
      createdAt: r.createdAt,
      user: {
        id: r.user._id,
        name: r.user.name,
        anonymousUsername: r.user.anonymousUsername,
        image: r.user.image,
        department: r.user.department,
        semester: r.user.semester,
      },
    }));

  return {
    counts: postPublic.reactions.counts,
    total: postPublic.reactions.total,
    reactions: reactors,
  };
};

/**
 * Get all posts the user has reacted to, with their reaction emoji indicated
 */
const getMyReactedPosts = async (userId, { page = 1, limit = 20 } = {}) => {
  const validPage = Math.max(parseInt(page, 10) || 1, 1);
  const validLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (validPage - 1) * validLimit;

  const query = {
    "reactions.user": userId,
    isHidden: { $ne: true },
    isDeleted: { $ne: true },
  };

  const [posts, total] = await Promise.all([
    Post.find(query)
      .select("-__v -moderationReason -moderatedBy -trendingNotified")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(validLimit)
      .populate("user", "name image anonymousUsername department semester role")
      .lean(),
    Post.countDocuments(query),
  ]);

  return {
    posts: posts.map((p) => Post.formatPublicPost(p, userId)),
    pagination: {
      page: validPage,
      limit: validLimit,
      total,
      pages: Math.ceil(total / validLimit) || 0,
    },
  };
};

/**
 * Calculate trending / popular posts based on reactions + comments + recency
 * @param {'today' | 'week' | 'popular'} timeframe
 */
const getTrendingPosts = async ({
  timeframe = "today",
  page = 1,
  limit,
  sortBy,
  currentUserId,
} = {}) => {
  const defaultLimit = timeframe === "today" ? 10 : 20;
  const maxLimit = timeframe === "today" ? 10 : 100;
  const validPage = Math.max(parseInt(page, 10) || 1, 1);
  const validLimit = Math.min(
    Math.max(parseInt(limit, 10) || defaultLimit, 1),
    maxLimit,
  );
  const skip = (validPage - 1) * validLimit;

  const now = new Date();
  const matchStage = {
    isHidden: { $ne: true },
    isDeleted: { $ne: true },
  };

  if (timeframe === "today") {
    matchStage.createdAt = {
      $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    };
  } else if (timeframe === "week") {
    matchStage.createdAt = {
      $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    };
  }

  const pipeline = [
    { $match: matchStage },
    {
      $addFields: {
        reactionsCount: { $size: { $ifNull: ["$reactions", []] } },
        safeCommentsCount: { $ifNull: ["$commentsCount", 0] },
        safeViews: { $ifNull: ["$views", 0] },
        totalEngagement: {
          $add: [
            { $size: { $ifNull: ["$reactions", []] } },
            { $ifNull: ["$commentsCount", 0] },
          ],
        },
      },
    },
    {
      $sort: {
        totalEngagement: -1,
        reactionsCount: -1,
        safeCommentsCount: -1,
        createdAt: -1,
      },
    },
  ];

  const [results, countResult] = await Promise.all([
    Post.aggregate([...pipeline, { $skip: skip }, { $limit: validLimit }]),
    Post.countDocuments(matchStage),
  ]);

  const populatedResults = await Post.populate(results, {
    path: "user",
    select: "name image anonymousUsername department semester role",
  });

  const posts = populatedResults.map((doc) => {
    return Post.formatPublicPost(doc, currentUserId);
  });

  return {
    posts,
    pagination: {
      page: validPage,
      limit: validLimit,
      total: countResult,
      pages: Math.ceil(countResult / validLimit) || 1,
    },
  };
};

/**
 * Get recent official/admin announcements within a given timeframe (default: last 24 hours)
 */
const getRecentOfficialPosts = async ({
  hours = 24,
  limit = 5,
  currentUserId,
} = {}) => {
  const validHours = Math.max(parseFloat(hours) || 24, 1);
  const validLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 50);
  const cutoff = new Date(Date.now() - validHours * 60 * 60 * 1000);

  const adminUsers = await User.find({ role: "admin" }).select("_id");
  const adminIds = adminUsers.map((u) => u._id);

  const query = {
    isHidden: { $ne: true },
    isDeleted: { $ne: true },
    createdAt: { $gte: cutoff },
    $or: [{ isOfficial: true }, { user: { $in: adminIds } }],
  };

  const posts = await Post.find(query)
    .select("-__v -moderationReason -moderatedBy -trendingNotified")
    .sort({ createdAt: -1 })
    .limit(validLimit)
    .populate("user", "name image anonymousUsername department semester role")
    .lean();

  return posts.map((post) => Post.formatPublicPost(post, currentUserId));
};

module.exports = {
  createPost,
  getPosts,
  searchPosts,
  getPostsByDepartment,
  getPostById,
  updatePost,
  deletePost,
  getPostsByUser,
  reactToPost,
  removeReaction,
  getPostReactions,
  getMyReactedPosts,
  getTrendingPosts,
  getRecentOfficialPosts,
};
