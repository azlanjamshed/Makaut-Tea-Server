const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_1234567890';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/rant-website-test';
const TEST_PORT = process.env.TEST_PORT || '5003';

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const { notFound, errorHandler } = require('../middleware/errorMiddleware');
const authRoutes = require('../modules/auth/auth.routes');
const userRoutes = require('../modules/user/user.routes');
const postRoutes = require('../modules/post/post.routes');
const commentRoutes = require('../modules/comment/comment.routes');
const adminRoutes = require('../modules/admin/admin.routes');
const reportRoutes = require('../modules/report/report.routes');
const notificationRoutes = require('../modules/notification/notification.routes');

async function runTests() {
  console.log('=== STARTING ROUTE VERIFICATION SUITE ===\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB test database.');

  const collections = await mongoose.connection.db.collections();
  for (let col of collections) {
    await col.deleteMany({});
  }

  const app = express();
  app.set('trust proxy', true);
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Rant website API is running' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/posts', postRoutes);
  app.use('/api/comments', commentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use(notFound);
  app.use(errorHandler);

  const server = app.listen(TEST_PORT);
  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

  const results = [];
  function assert(title, condition, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${title}`);
      results.push({ title, pass: true });
    } else {
      console.error(`  ❌ FAIL: ${title} - ${details}`);
      results.push({ title, pass: false, details });
    }
  }

  try {
    // 1. Health
    console.log('--- 1. Testing Health Route ---');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert('GET /api/health returns 200', healthRes.status === 200 && healthData.success === true);

    // 2. Auth Registration
    console.log('\n--- 2. Testing Auth Registration ---');
    const badReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bademail', password: '123' }),
    });
    assert('POST /api/auth/register invalid input returns 400', badReg.status === 400);

    const regAlice = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Wonder',
        email: 'alice@college.edu',
        password: 'password123',
        bio: 'Just venting',
      }),
    });
    const regDataAlice = await regAlice.json();
    assert('POST /api/auth/register returns 201', regAlice.status === 201 && regDataAlice.success === true);
    assert('Password is not returned in response', !regDataAlice.data.password);
    const tokenAlice = regDataAlice.token;
    const aliceId = regDataAlice.data.id;

    const dupReg = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Twin',
        email: 'alice@college.edu',
        password: 'password123',
      }),
    });
    assert('Duplicate email registration returns 400', dupReg.status === 400);

    // Register with avatar upload
    const bobForm = new FormData();
    bobForm.append('name', 'Bob Builder');
    bobForm.append('email', 'bob@college.edu');
    bobForm.append('password', 'secretBob123');
    bobForm.append('bio', 'Fixing campus issues');
    bobForm.append('image', new Blob(['fake image bytes'], { type: 'image/png' }), 'bob.png');

    const regBob = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST', body: bobForm });
    const regDataBob = await regBob.json();
    assert('Registration with image upload returns 201', regBob.status === 201 && regDataBob.data.image.startsWith('/uploads/'));
    const tokenBob = regDataBob.token;
    const bobId = regDataBob.data.id;

    // 3. Auth Login
    console.log('\n--- 3. Testing Auth Login ---');
    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@college.edu', password: 'wrong' }),
    });
    assert('Login with wrong password returns 401', badLogin.status === 401);

    const goodLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@college.edu', password: 'password123' }),
    });
    const loginData = await goodLogin.json();
    assert('Login with correct password returns 200', goodLogin.status === 200 && typeof loginData.token === 'string');

    // 4. Logout & Change Password & GET /api/auth/me
    console.log('\n--- 4. Testing Logout & Change Password & GET /api/auth/me ---');
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
    const logoutData = await logoutRes.json();
    assert('POST /api/auth/logout returns 200', logoutRes.status === 200 && logoutData.success === true);

    const meNoToken = await fetch(`${baseUrl}/api/auth/me`);
    assert('GET /api/auth/me without token returns 401', meNoToken.status === 401);

    const meAlice = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const meData = await meAlice.json();
    assert('GET /api/auth/me with valid token returns 200', meAlice.status === 200 && meData.data.name === 'Alice Wonder');

    // Change password tests
    const changePwdNoAuth = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'password123', newPassword: 'newsecurepass123' }),
    });
    assert('PUT /api/auth/change-password without token returns 401', changePwdNoAuth.status === 401);

    const changePwdWrongCurrent = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`,
      },
      body: JSON.stringify({ currentPassword: 'wrongCurrentPassword', newPassword: 'newsecurepass123' }),
    });
    assert('PUT /api/auth/change-password with wrong current password returns 401', changePwdWrongCurrent.status === 401);

    const changePwdSuccess = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`,
      },
      body: JSON.stringify({ currentPassword: 'password123', newPassword: 'newsecurepass123' }),
    });
    assert('PUT /api/auth/change-password with correct credentials returns 200', changePwdSuccess.status === 200);

    const testOldPassLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@college.edu', password: 'password123' }),
    });
    assert('Login with old password now fails with 401', testOldPassLogin.status === 401);

    const testNewPassLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@college.edu', password: 'newsecurepass123' }),
    });
    assert('Login with new password succeeds with 200', testNewPassLogin.status === 200);

    // 5. Users Endpoints
    console.log('\n--- 5. Testing Users Endpoints ---');
    const userRes = await fetch(`${baseUrl}/api/users/${aliceId}`);
    const userData = await userRes.json();
    assert('GET /api/users/:id returns 200', userRes.status === 200);
    assert('User profile includes anonymousUsername', typeof userData.data.anonymousUsername === 'string' && userData.data.anonymousUsername.startsWith('anon_'));

    const updateProfileRes = await fetch(`${baseUrl}/api/users/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`,
      },
      body: JSON.stringify({
        name: 'Alice New Name',
        bio: 'Updated bio',
        department: 'Computer Science',
        semester: 'Semester 6',
        anonymousUsername: 'campus_whistleblower',
      }),
    });
    const updateProfileData = await updateProfileRes.json();
    assert('PUT /api/users/me updates profile with 200', updateProfileRes.status === 200);
    assert('Updated department, semester, anonymousUsername are saved',
      updateProfileData.data.department === 'Computer Science' &&
      updateProfileData.data.semester === 'Semester 6' &&
      updateProfileData.data.anonymousUsername === 'campus_whistleblower'
    );

    // 6. Posts Endpoints
    console.log('\n--- 6. Testing Posts Endpoints ---');
    // Test character limit (>2000 chars rejected)
    const tooLongText = 'a'.repeat(2001);
    const tooLongRes = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ text: tooLongText }),
    });
    assert('POST /api/posts with >2000 chars returns 400', tooLongRes.status === 400);

    // Alice creates public post (without passing department/semester -> auto inherits 'Computer Science' & 'Semester 6')
    const postRes1 = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`,
      },
      body: JSON.stringify({
        text: 'Rant 1: Finals schedule is exhausting!',
        department: 'ShouldBeIgnoredDept',
        semester: 'ShouldBeIgnoredSem',
      }),
    });
    const postData1 = await postRes1.json();
    assert('POST /api/posts creates post with 201', postRes1.status === 201 && postData1.data.views === 0);
    assert('POST /api/posts automatically sets department from user data', postData1.data.department === 'Computer Science');
    assert('POST /api/posts automatically sets semester from user data', postData1.data.semester === 'Semester 6');
    assert('POST /api/posts saves created time (createdAt)', Boolean(postData1.data.createdAt) && !isNaN(Date.parse(postData1.data.createdAt)));
    assert('Image is optional and defaults to empty string when not provided', postData1.data.image === '');
    assert('Public post displays author real name', postData1.data.user.name === 'Alice New Name');
    const post1Id = postData1.data.id;

    // Alice creates Anonymous post
    const anonPostRes = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`,
      },
      body: JSON.stringify({
        text: 'Anonymous Rant: Cafeteria coffee is getting worse!',
        isAnonymous: true,
      }),
    });
    const anonPostData = await anonPostRes.json();
    assert('POST /api/posts with isAnonymous: true creates post with 201', anonPostRes.status === 201);
    assert('Anonymous post masks user name with anonymousUsername', anonPostData.data.user.name === 'campus_whistleblower');
    assert('Anonymous post hides user profile image', anonPostData.data.user.image === '');
    assert('Anonymous post automatically preserves user department', anonPostData.data.department === 'Computer Science');
    assert('Anonymous post automatically preserves user semester', anonPostData.data.semester === 'Semester 6');

    // Bob creates Post 3
    const postRes2 = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenBob}`,
      },
      body: JSON.stringify({ text: 'Rant 2: Campus Wi-Fi down again.' }),
    });
    assert('Bob creates Post with 201', postRes2.status === 201);

    // GET /api/posts (pagination and latest sort)
    const allPostsRes = await fetch(`${baseUrl}/api/posts?page=1&limit=10`);
    const allPostsData = await allPostsRes.json();
    assert('GET /api/posts returns 200 with pagination', allPostsRes.status === 200 && allPostsData.pagination.total === 3);
    assert(
      'GET /api/posts returns latest rants first',
      new Date(allPostsData.data[0].createdAt).getTime() >= new Date(allPostsData.data[1].createdAt).getTime()
    );

    // GET /api/posts/department/:department
    const csDeptRes = await fetch(`${baseUrl}/api/posts/department/Computer%20Science`);
    const csDeptData = await csDeptRes.json();
    assert('GET /api/posts/department/:dept returns 200 with pagination', csDeptRes.status === 200 && csDeptData.pagination.total === 2);
    assert('Every returned post matches department', csDeptData.data.every((p) => p.department === 'Computer Science'));

    // GET /api/posts?department=:department
    const csQueryRes = await fetch(`${baseUrl}/api/posts?department=Computer%20Science`);
    const csQueryData = await csQueryRes.json();
    assert('GET /api/posts?department=... returns 200', csQueryRes.status === 200 && csQueryData.pagination.total === 2);

    // Empty department test
    const emptyDeptRes = await fetch(`${baseUrl}/api/posts/department/Mechanical%20Engineering`);
    const emptyDeptData = await emptyDeptRes.json();
    assert('Unmatched department returns 0 posts', emptyDeptRes.status === 200 && emptyDeptData.pagination.total === 0);

    // GET /api/posts/user/:userId
    const userPostsRes = await fetch(`${baseUrl}/api/posts/user/${aliceId}`);
    const userPostsData = await userPostsRes.json();
    assert('GET /api/posts/user/:userId returns 200', userPostsRes.status === 200 && userPostsData.data.length === 2);

    // Search posts tests (by department & username)
    console.log('\n--- Testing Search Rants by Department & Username ---');
    // 1. Search by department
    const searchDeptRes = await fetch(`${baseUrl}/api/posts/search?department=Computer%20Science`);
    const searchDeptData = await searchDeptRes.json();
    assert('GET /api/posts/search?department=... returns 200', searchDeptRes.status === 200 && searchDeptData.pagination.total === 2);
    assert('All search results match queried department', searchDeptData.data.every((p) => p.department === 'Computer Science'));

    // 2. Search by real username returns only public posts (preserves anonymity)
    const searchRealUserRes = await fetch(`${baseUrl}/api/posts/search?username=Alice`);
    const searchRealUserData = await searchRealUserRes.json();
    assert('Search by real username returns 200 with public posts only', searchRealUserRes.status === 200 && searchRealUserData.pagination.total === 1);
    assert('Returned post is not anonymous', searchRealUserData.data[0].isAnonymous === false);
    assert('Anonymous post is never revealed when searching author real name', !searchRealUserData.data.some((p) => p.isAnonymous === true));

    // 3. Search Bob by username
    const searchBobRes = await fetch(`${baseUrl}/api/posts/search?username=Bob`);
    const searchBobData = await searchBobRes.json();
    assert('Search by username Bob returns 1 post', searchBobRes.status === 200 && searchBobData.pagination.total === 1);

    // 4. Search by anonymous username returns anonymous post without exposing real name
    const searchAnonUserRes = await fetch(`${baseUrl}/api/posts/search?username=campus_whistleblower`);
    const searchAnonUserData = await searchAnonUserRes.json();
    assert('Search by anonymous username returns 200 with anonymous post', searchAnonUserRes.status === 200 && searchAnonUserData.pagination.total === 1);
    assert('Anonymous post displays anonymous username', searchAnonUserData.data[0].user.name === 'campus_whistleblower');
    assert('Anonymous post does not leak real author name', searchAnonUserData.data[0].user.name !== 'Alice New Name');

    // 5. Search by both department and username
    const searchBothRes = await fetch(`${baseUrl}/api/posts/search?department=Computer%20Science&username=Alice`);
    const searchBothData = await searchBothRes.json();
    assert('Search by department AND username returns 1 matching post', searchBothRes.status === 200 && searchBothData.pagination.total === 1);

    // 6. Search by department AND mismatched username returns 0 posts
    const searchMismatchedRes = await fetch(`${baseUrl}/api/posts/search?department=Computer%20Science&username=Bob`);
    const searchMismatchedData = await searchMismatchedRes.json();
    assert('Search by department with non-matching user returns 0 posts', searchMismatchedRes.status === 200 && searchMismatchedData.pagination.total === 0);

    // 7. Search with non-existent username returns 0 posts
    const searchNonExistentRes = await fetch(`${baseUrl}/api/posts/search?username=ghost_user_999`);
    const searchNonExistentData = await searchNonExistentRes.json();
    assert('Search by nonexistent username returns 200 with 0 posts', searchNonExistentRes.status === 200 && searchNonExistentData.pagination.total === 0);

    // 8. Search query param on feed endpoint GET /api/posts?username=Bob
    const feedSearchRes = await fetch(`${baseUrl}/api/posts?username=Bob`);
    const feedSearchData = await feedSearchRes.json();
    assert('GET /api/posts?username=... filters feed successfully', feedSearchRes.status === 200 && feedSearchData.pagination.total === 1);

    // 7. View Counting
    console.log('\n--- 7. Testing View Counting on GET /api/posts/:id ---');
    const v1 = await fetch(`${baseUrl}/api/posts/${post1Id}`, { headers: { 'x-forwarded-for': '198.51.100.10' } });
    const d1 = await v1.json();
    assert('Guest 1 view increments views to 1', d1.data.views === 1);

    const v2 = await fetch(`${baseUrl}/api/posts/${post1Id}`, { headers: { 'x-forwarded-for': '198.51.100.10' } });
    const d2 = await v2.json();
    assert('Guest 1 repeat view does not increment (remains 1)', d2.data.views === 1);

    const v3 = await fetch(`${baseUrl}/api/posts/${post1Id}`, { headers: { 'x-forwarded-for': '198.51.100.20' } });
    const d3 = await v3.json();
    assert('Guest 2 view increments views to 2', d3.data.views === 2);

    const v4 = await fetch(`${baseUrl}/api/posts/${post1Id}`, { headers: { Authorization: `Bearer ${tokenBob}` } });
    const d4 = await v4.json();
    assert('Authenticated Bob view increments views to 3', d4.data.views === 3);

    // 8. Reactions
    console.log('\n--- 8. Testing Reactions (Add, Change, Toggle, Delete, Counts, Owner Visibility) ---');
    // 8.1 Invalid emoji fails
    const invalidEmojiRes = await fetch(`${baseUrl}/api/posts/${post1Id}/reactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenBob}`,
      },
      body: JSON.stringify({ emoji: '🎉' }),
    });
    assert('POST reaction with invalid emoji returns 400', invalidEmojiRes.status === 400);

    // 8.2 Add reaction (Bob reacts with 🔥)
    const addReactionRes = await fetch(`${baseUrl}/api/posts/${post1Id}/reactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenBob}`,
      },
      body: JSON.stringify({ emoji: '🔥' }),
    });
    const addReactionData = await addReactionRes.json();
    assert('Bob adds 🔥 reaction with 200', addReactionRes.status === 200 && addReactionData.message === 'Reaction added');
    assert('Reaction count for 🔥 is 1', addReactionData.data.reactions.counts['🔥'] === 1 && addReactionData.data.reactions.total === 1);
    assert('Bob userReaction is 🔥', addReactionData.data.reactions.userReaction === '🔥');

    // 8.3 Change reaction (Bob changes from 🔥 to 😂)
    const changeReactionRes = await fetch(`${baseUrl}/api/posts/${post1Id}/reactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenBob}`,
      },
      body: JSON.stringify({ emoji: '😂' }),
    });
    const changeReactionData = await changeReactionRes.json();
    assert('Bob changes reaction to 😂 with 200', changeReactionRes.status === 200 && changeReactionData.message === 'Reaction changed');
    assert('Counts updated: 😂 is 1, 🔥 is 0', changeReactionData.data.reactions.counts['😂'] === 1 && changeReactionData.data.reactions.counts['🔥'] === 0);

    // 8.4 Toggle reaction (Bob taps 😂 again -> removed)
    const toggleReactionRes = await fetch(`${baseUrl}/api/posts/${post1Id}/reactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenBob}`,
      },
      body: JSON.stringify({ emoji: '😂' }),
    });
    const toggleReactionData = await toggleReactionRes.json();
    assert('Bob taps same emoji again to toggle remove with 200', toggleReactionRes.status === 200 && toggleReactionData.message === 'Reaction removed');
    assert('Reaction counts are 0 after removal', toggleReactionData.data.reactions.total === 0);

    // 8.5 Explicit DELETE /reactions
    await fetch(`${baseUrl}/api/posts/${post1Id}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ emoji: '💀' }),
    });
    const deleteReactionRes = await fetch(`${baseUrl}/api/posts/${post1Id}/reactions`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    const deleteReactionData = await deleteReactionRes.json();
    assert('DELETE /api/posts/:id/reactions removes reaction', deleteReactionRes.status === 200 && deleteReactionData.data.reactions.total === 0);

    // 8.6 Multiple users reacting & aggregated counts
    // Alice reacts with 💀, Bob reacts with 😂
    await fetch(`${baseUrl}/api/posts/${post1Id}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ emoji: '💀' }),
    });
    await fetch(`${baseUrl}/api/posts/${post1Id}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ emoji: '😂' }),
    });
    const publicPostRes = await fetch(`${baseUrl}/api/posts/${post1Id}`);
    const publicPostData = await publicPostRes.json();
    assert(
      'Aggregated reaction counts accurate for multiple users',
      publicPostData.data.reactions.counts['💀'] === 1 &&
      publicPostData.data.reactions.counts['😂'] === 1 &&
      publicPostData.data.reactions.total === 2
    );

    // 8.7 Owner-only visibility of reactor list
    // Non-owner (Bob) attempts to see who reacted
    const nonOwnerReactorsRes = await fetch(`${baseUrl}/api/posts/${post1Id}/reactions`, {
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    assert('Non-owner cannot view reactor user details (returns 403)', nonOwnerReactorsRes.status === 403);

    // Owner (Alice) views who reacted
    const ownerReactorsRes = await fetch(`${baseUrl}/api/posts/${post1Id}/reactions`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const ownerReactorsData = await ownerReactorsRes.json();
    assert('Owner can view who reacted to their post (returns 200)', ownerReactorsRes.status === 200);
    assert('Reactor list contains Bob with name, id, and emoji',
      ownerReactorsData.data.reactions.some((r) => r.user.id === bobId && r.user.name === 'Bob Builder' && r.emoji === '😂')
    );

    // 8.8 User can see what they reacted to across posts (GET /api/posts/my-reactions)
    const myReactionsNoAuth = await fetch(`${baseUrl}/api/posts/my-reactions`);
    assert('GET /api/posts/my-reactions without token returns 401', myReactionsNoAuth.status === 401);

    const bobReactionsRes = await fetch(`${baseUrl}/api/posts/my-reactions`, {
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    const bobReactionsData = await bobReactionsRes.json();
    assert('Bob gets their reacted posts with 200', bobReactionsRes.status === 200);
    assert('Bob sees their reaction (😂) on post1',
      bobReactionsData.data.some((p) => p.id === post1Id && p.reactions.userReaction === '😂')
    );

    // 9. Comments
    console.log('\n--- 9. Testing Comments (Add, Edit, Delete, Get, Pagination) ---');
    // 9.1 Add comment without token returns 401
    const unauthComment = await fetch(`${baseUrl}/api/posts/${post1Id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Unauthorized comment' }),
    });
    assert('POST /api/posts/:postId/comments without token returns 401', unauthComment.status === 401);

    // 9.2 Add comment with empty text returns 400
    const emptyComment = await fetch(`${baseUrl}/api/posts/${post1Id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ text: '' }),
    });
    assert('POST comment with empty text returns 400', emptyComment.status === 400);

    // 9.3 Bob adds comment to Post 1
    const bobCommentRes = await fetch(`${baseUrl}/api/posts/${post1Id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ text: "Bob's helpful study tip comment" }),
    });
    const bobCommentData = await bobCommentRes.json();
    assert('Bob adds comment successfully with 201', bobCommentRes.status === 201 && bobCommentData.success === true);
    assert('Comment author is Bob Builder', bobCommentData.data.user.name === 'Bob Builder');
    const bobCommentId = bobCommentData.data.id;

    // 9.4 Alice adds anonymous comment to Post 1
    const aliceCommentRes = await fetch(`${baseUrl}/api/posts/${post1Id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ text: 'Alice anonymous comment', isAnonymous: true }),
    });
    const aliceCommentData = await aliceCommentRes.json();
    assert('Alice adds anonymous comment with 201', aliceCommentRes.status === 201);
    assert('Anonymous comment masks name with anonymousUsername', aliceCommentData.data.user.name === 'campus_whistleblower');
    assert('Anonymous comment hides user profile image', aliceCommentData.data.user.image === '');

    // 9.5 Verify Post commentsCount is 2
    const postWithCommentsRes = await fetch(`${baseUrl}/api/posts/${post1Id}`);
    const postWithCommentsData = await postWithCommentsRes.json();
    assert('Post commentsCount is incremented to 2', postWithCommentsData.data.commentsCount === 2);

    // 9.6 Get comments with pagination
    const paginatedCommentsRes = await fetch(`${baseUrl}/api/posts/${post1Id}/comments?page=1&limit=1`);
    const paginatedCommentsData = await paginatedCommentsRes.json();
    assert('GET comments returns 200 with pagination', paginatedCommentsRes.status === 200);
    assert('Pagination meta accurate (total 2, pages 2, limit 1)',
      paginatedCommentsData.pagination.total === 2 &&
      paginatedCommentsData.pagination.pages === 2 &&
      paginatedCommentsData.data.length === 1
    );

    // 9.7 Edit comment - Alice cannot edit Bob's comment (returns 403)
    const forbiddenEditComment = await fetch(`${baseUrl}/api/comments/${bobCommentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ text: 'Alice trying to hijack comment' }),
    });
    assert('Non-author edit comment returns 403 Forbidden', forbiddenEditComment.status === 403);

    // 9.8 Bob edits his own comment
    const allowedEditComment = await fetch(`${baseUrl}/api/comments/${bobCommentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ text: "Bob's updated comment text" }),
    });
    const updatedCommentData = await allowedEditComment.json();
    assert('Author edits own comment returns 200', allowedEditComment.status === 200 && updatedCommentData.data.text.includes('updated'));

    // 9.9 Delete comment - non-owner/non-post-owner cannot delete
    const regCharlie = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Charlie Nonowner', email: 'charlie@college.edu', password: 'password123' }),
    });
    const regDataCharlie = await regCharlie.json();
    const tokenCharlie = regDataCharlie.token;

    const forbiddenDeleteComment = await fetch(`${baseUrl}/api/comments/${bobCommentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenCharlie}` },
    });
    assert('Unauthorized user cannot delete comment (returns 403)', forbiddenDeleteComment.status === 403);

    // 9.10 Bob deletes his own comment
    const allowedDeleteComment = await fetch(`${baseUrl}/api/comments/${bobCommentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    assert('Author deletes own comment returns 200', allowedDeleteComment.status === 200);

    // 9.11 Verify commentsCount decrements to 1
    const postAfterDeleteComment = await fetch(`${baseUrl}/api/posts/${post1Id}`);
    const postAfterDeleteData = await postAfterDeleteComment.json();
    assert('Post commentsCount decrements to 1 after comment deletion', postAfterDeleteData.data.commentsCount === 1);

    // 10. Comment Replies
    console.log('\n--- 10. Testing Comment Replies (Reply, Get Replies, Edit, Delete) ---');
    const aliceCommentId = aliceCommentData.data.id;

    // 10.1 Add reply without token returns 401
    const unauthReply = await fetch(`${baseUrl}/api/comments/${aliceCommentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Unauthorized reply' }),
    });
    assert('POST /api/comments/:commentId/replies without token returns 401', unauthReply.status === 401);

    // 10.2 Add reply with empty text returns 400
    const emptyReply = await fetch(`${baseUrl}/api/comments/${aliceCommentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ text: '' }),
    });
    assert('POST reply with empty text returns 400', emptyReply.status === 400);

    // 10.3 Bob replies to Alice's comment
    const bobReplyRes = await fetch(`${baseUrl}/api/comments/${aliceCommentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ text: "Bob's helpful reply to Alice comment" }),
    });
    const bobReplyData = await bobReplyRes.json();
    assert('Bob adds reply successfully with 201', bobReplyRes.status === 201 && bobReplyData.success === true);
    assert('Reply author is Bob Builder', bobReplyData.data.user.name === 'Bob Builder');
    const bobReplyId = bobReplyData.data.id;

    // 10.4 Alice replies anonymously
    const aliceReplyRes = await fetch(`${baseUrl}/api/comments/${aliceCommentId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ text: 'Alice anonymous reply', isAnonymous: true }),
    });
    const aliceReplyData = await aliceReplyRes.json();
    assert('Alice adds anonymous reply with 201', aliceReplyRes.status === 201);
    assert('Anonymous reply masks user name with anonymousUsername', aliceReplyData.data.user.name === 'campus_whistleblower');
    assert('Anonymous reply hides profile image', aliceReplyData.data.user.image === '');

    // 10.5 Get replies with pagination
    const paginatedRepliesRes = await fetch(`${baseUrl}/api/comments/${aliceCommentId}/replies?page=1&limit=1`);
    const paginatedRepliesData = await paginatedRepliesRes.json();
    assert('GET /api/comments/:commentId/replies returns 200 with pagination', paginatedRepliesRes.status === 200);
    assert('Replies pagination meta accurate (total 2, pages 2, limit 1)',
      paginatedRepliesData.pagination.total === 2 &&
      paginatedRepliesData.pagination.pages === 2 &&
      paginatedRepliesData.data.length === 1
    );

    // 10.6 Edit reply - Charlie cannot edit Bob's reply (returns 403)
    const forbiddenEditReply = await fetch(`${baseUrl}/api/comments/${aliceCommentId}/replies/${bobReplyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCharlie}` },
      body: JSON.stringify({ text: 'Charlie trying to tamper reply' }),
    });
    assert('Non-author edit reply returns 403 Forbidden', forbiddenEditReply.status === 403);

    // 10.7 Bob edits his own reply
    const allowedEditReply = await fetch(`${baseUrl}/api/comments/${aliceCommentId}/replies/${bobReplyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenBob}` },
      body: JSON.stringify({ text: "Bob's updated reply text" }),
    });
    const updatedReplyData = await allowedEditReply.json();
    assert('Author edits own reply returns 200', allowedEditReply.status === 200 && updatedReplyData.data.text.includes('updated'));

    // 10.8 Delete reply - Charlie cannot delete Bob's reply (returns 403)
    const forbiddenDeleteReply = await fetch(`${baseUrl}/api/comments/${aliceCommentId}/replies/${bobReplyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenCharlie}` },
    });
    assert('Unauthorized user cannot delete reply (returns 403)', forbiddenDeleteReply.status === 403);

    // 10.9 Bob deletes his own reply
    const allowedDeleteReply = await fetch(`${baseUrl}/api/comments/${aliceCommentId}/replies/${bobReplyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    assert('Author deletes own reply returns 200', allowedDeleteReply.status === 200);

    // 10.10 Verify replies total decrements to 1
    const repliesAfterDeleteRes = await fetch(`${baseUrl}/api/comments/${aliceCommentId}/replies`);
    const repliesAfterDeleteData = await repliesAfterDeleteRes.json();
    assert('Replies count decrements to 1 after deletion', repliesAfterDeleteData.pagination.total === 1);

    // 11. Trending & Popular Rants
    console.log('\n--- 11. Testing Trending & Popular Rants (Today, Week, Popular) ---');
    // 11.1 Trending today
    const trendingTodayRes = await fetch(`${baseUrl}/api/posts/trending/today`);
    const trendingTodayData = await trendingTodayRes.json();
    assert('GET /api/posts/trending/today returns 200 with data', trendingTodayRes.status === 200 && Array.isArray(trendingTodayData.data));
    assert('Trending today ranks post with reactions and comments first',
      trendingTodayData.data.length > 0 && trendingTodayData.data[0].id === post1Id
    );

    // 11.2 Trending this week
    const trendingWeekRes = await fetch(`${baseUrl}/api/posts/trending/week`);
    const trendingWeekData = await trendingWeekRes.json();
    assert('GET /api/posts/trending/week returns 200 with data', trendingWeekRes.status === 200 && Array.isArray(trendingWeekData.data));

    // 11.3 Popular (All-time highest engagement)
    const popularRes = await fetch(`${baseUrl}/api/posts/popular`);
    const popularData = await popularRes.json();
    assert('GET /api/posts/popular returns 200 with data', popularRes.status === 200 && Array.isArray(popularData.data));
    assert('Popular ranks highest engagement post on top',
      popularData.data.length > 0 && popularData.data[0].id === post1Id
    );

    // 11.4 Query parameter variant GET /api/posts/trending?timeframe=today
    const queryTrendingRes = await fetch(`${baseUrl}/api/posts/trending?timeframe=today`);
    const queryTrendingData = await queryTrendingRes.json();
    assert('GET /api/posts/trending?timeframe=today returns 200 with pagination',
      queryTrendingRes.status === 200 && queryTrendingData.pagination.total > 0
    );

    // 12. Update Post
    console.log('\n--- 12. Testing Post Update (PUT /api/posts/:id) ---');
    const forbiddenUpdate = await fetch(`${baseUrl}/api/posts/${post1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenBob}`,
      },
      body: JSON.stringify({ text: 'Bob trying to tamper' }),
    });
    assert('Non-owner update returns 403 Forbidden', forbiddenUpdate.status === 403);

    const allowedUpdate = await fetch(`${baseUrl}/api/posts/${post1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenAlice}`,
      },
      body: JSON.stringify({ text: 'Rant 1: Updated with good news!' }),
    });
    const updatedPostData = await allowedUpdate.json();
    assert('Owner update returns 200', allowedUpdate.status === 200 && updatedPostData.data.text.includes('good news'));

    // 13. Delete Post
    console.log('\n--- 13. Testing Post Delete (DELETE /api/posts/:id) ---');
    const forbiddenDelete = await fetch(`${baseUrl}/api/posts/${post1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    assert('Non-owner delete returns 403 Forbidden', forbiddenDelete.status === 403);

    const allowedDelete = await fetch(`${baseUrl}/api/posts/${post1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert('Owner delete returns 200', allowedDelete.status === 200);

    const postGone = await fetch(`${baseUrl}/api/posts/${post1Id}`);
    assert('Deleted post returns 404', postGone.status === 404);

    // 14. Account Delete & Cascade
    console.log('\n--- 14. Testing User Account Delete & Cascade ---');
    const deleteAccountRes = await fetch(`${baseUrl}/api/users/me`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenBob}` },
    });
    assert('DELETE /api/users/me returns 200', deleteAccountRes.status === 200);

    const bobGone = await fetch(`${baseUrl}/api/users/${bobId}`);
    assert('Bob account returns 404', bobGone.status === 404);

    // 15. Error handling
    console.log('\n--- 15. Testing 404 and File Filter ---');
    const notFoundRes = await fetch(`${baseUrl}/api/nonexistent`);
    assert('404 on undefined routes', notFoundRes.status === 404);

    const badFileForm = new FormData();
    badFileForm.append('name', 'Bad File User');
    badFileForm.append('email', 'bad@test.com');
    badFileForm.append('password', 'secret123');
    badFileForm.append('image', new Blob(['txt content'], { type: 'text/plain' }), 'test.txt');
    const badFileRes = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST', body: badFileForm });
    assert('Invalid file upload returns 400 (not 500)', badFileRes.status === 400);

    // ========================================================
    // 16. PHASE 9 — ADMIN BACKEND
    // ========================================================
    console.log('\n--- 16. Testing Phase 9 — Admin Backend ---');

    // Setup Admin user directly in DB
    const User = require('../models/User');
    const adminUser = await User.create({
      name: 'System Admin',
      email: 'superadmin@campus.edu',
      password: 'admin_secure_password',
      role: 'admin',
      department: 'Dean Office',
    });

    // 24. Admin Authentication
    console.log('-> 24. Admin Authentication');
    // Normal user attempts to log in via admin login endpoint -> 403
    const normalUserAdminLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@college.edu', password: 'newsecurepass123' }),
    });
    assert('Normal user login to /api/admin/login returns 403 Forbidden', normalUserAdminLoginRes.status === 403);

    // Normal user token on admin protected route -> 403
    const normalUserAdminAccessRes = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    assert('Normal user token on /api/admin/dashboard returns 403 Forbidden', normalUserAdminAccessRes.status === 403);

    // Unauthenticated request to admin route -> 401
    const unauthAdminRes = await fetch(`${baseUrl}/api/admin/dashboard`);
    assert('Unauthenticated access to /api/admin/dashboard returns 401 Unauthorized', unauthAdminRes.status === 401);

    // Real Admin login -> 200
    const adminLoginRes = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@campus.edu', password: 'admin_secure_password' }),
    });
    const adminLoginData = await adminLoginRes.json();
    assert('Admin login returns 200 with JWT', adminLoginRes.status === 200 && Boolean(adminLoginData.token));
    assert('Admin role returned as admin', adminLoginData.data.role === 'admin');
    const tokenAdmin = adminLoginData.token;

    // GET /api/admin/me
    const adminMeRes = await fetch(`${baseUrl}/api/admin/me`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert('GET /api/admin/me returns 200', adminMeRes.status === 200);

    // 25. Admin Rant Management (View, Hide, Delete, Restore)
    console.log('-> 25. Admin Rant Management');
    // Create a new post to moderate
    const modPostRes = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ text: 'Rant to be moderated: Exam leaks rumors.' }),
    });
    const modPostData = await modPostRes.json();
    const modPostId = modPostData.data.id;
    assert('Post to moderate created with 201', modPostRes.status === 201);

    // Admin view rants
    const adminPostsRes = await fetch(`${baseUrl}/api/admin/posts?status=all`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const adminPostsData = await adminPostsRes.json();
    assert('Admin GET /api/admin/posts returns 200 with list', adminPostsRes.status === 200 && adminPostsData.data.length > 0);

    // Admin Hide rant
    const hideRes = await fetch(`${baseUrl}/api/admin/posts/${modPostId}/hide`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ reason: 'Investigating misinformation' }),
    });
    const hideData = await hideRes.json();
    assert('Admin PUT /api/admin/posts/:id/hide returns 200', hideRes.status === 200 && hideData.data.isHidden === true);

    // Public view of hidden rant -> 404
    const publicHiddenViewRes = await fetch(`${baseUrl}/api/posts/${modPostId}`);
    assert('Public view of hidden rant returns 404', publicHiddenViewRes.status === 404);

    // Public feed does not contain hidden rant
    const publicFeedAfterHide = await fetch(`${baseUrl}/api/posts`);
    const publicFeedAfterHideData = await publicFeedAfterHide.json();
    assert('Public feed excludes hidden rant', !publicFeedAfterHideData.data.some((p) => p.id === modPostId));

    // Admin Unhide / Restore rant
    const unhideRes = await fetch(`${baseUrl}/api/admin/posts/${modPostId}/unhide`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert('Admin PUT /api/admin/posts/:id/unhide returns 200', unhideRes.status === 200);

    // Public view is restored
    const publicRestoredViewRes = await fetch(`${baseUrl}/api/posts/${modPostId}`);
    assert('Public view of unhidden rant returns 200', publicRestoredViewRes.status === 200);

    // Admin Delete rant (soft-delete)
    const adminDeletePostRes = await fetch(`${baseUrl}/api/admin/posts/${modPostId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ reason: 'Terms of service violation' }),
    });
    assert('Admin DELETE /api/admin/posts/:id returns 200', adminDeletePostRes.status === 200);

    // Public view of deleted rant -> 404
    const publicDeletedViewRes = await fetch(`${baseUrl}/api/posts/${modPostId}`);
    assert('Public view of deleted rant returns 404', publicDeletedViewRes.status === 404);

    // Admin Restore deleted rant
    const adminRestorePostRes = await fetch(`${baseUrl}/api/admin/posts/${modPostId}/restore`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert('Admin PUT /api/admin/posts/:id/restore returns 200', adminRestorePostRes.status === 200);

    const publicAfterRestoreRes = await fetch(`${baseUrl}/api/posts/${modPostId}`);
    assert('Restored rant is accessible again by public with 200', publicAfterRestoreRes.status === 200);

    // 26. Report Management (View reports, Assign status, Resolve, Reject, Take action)
    console.log('-> 26. Report Management');
    // Normal user creates report
    const submitReportRes = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({
        targetType: 'post',
        targetId: modPostId,
        reason: 'hate_speech',
        description: 'Contains harmful speech targeting students',
      }),
    });
    const submitReportData = await submitReportRes.json();
    assert('User submits report with 201', submitReportRes.status === 201);
    const report1Id = submitReportData.data._id;

    // Prevent duplicate pending report
    const dupReportRes = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({
        targetType: 'post',
        targetId: modPostId,
        reason: 'hate_speech',
      }),
    });
    assert('Duplicate report submission prevented with 400', dupReportRes.status === 400);

    // Admin views reports
    const adminReportsRes = await fetch(`${baseUrl}/api/admin/reports?status=pending`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const adminReportsData = await adminReportsRes.json();
    assert('Admin GET /api/admin/reports returns 200 with list', adminReportsRes.status === 200 && adminReportsData.data.length > 0);

    // Admin views single report
    const adminSingleReportRes = await fetch(`${baseUrl}/api/admin/reports/${report1Id}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert('Admin GET /api/admin/reports/:id returns 200', adminSingleReportRes.status === 200);

    // Admin assigns status (investigating)
    const assignStatusRes = await fetch(`${baseUrl}/api/admin/reports/${report1Id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ status: 'investigating', notes: 'Currently under active investigation' }),
    });
    const assignStatusData = await assignStatusRes.json();
    assert('Admin assigns status investigating with 200', assignStatusRes.status === 200 && assignStatusData.data.status === 'investigating');

    // Admin rejects report
    const rejectReportRes = await fetch(`${baseUrl}/api/admin/reports/${report1Id}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ notes: 'Report does not violate policy' }),
    });
    const rejectReportData = await rejectReportRes.json();
    assert('Admin rejects report with 200', rejectReportRes.status === 200 && rejectReportData.data.status === 'rejected');

    // Create a 2nd report to test "Take Action"
    const submitReport2Res = await fetch(`${baseUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({
        targetType: 'post',
        targetId: modPostId,
        reason: 'spam',
        description: 'Spam content',
      }),
    });
    const submitReport2Data = await submitReport2Res.json();
    const report2Id = submitReport2Data.data._id;
    assert('Second report created for action testing with 201', submitReport2Res.status === 201);

    // Admin takes action: hide_post
    const takeActionRes = await fetch(`${baseUrl}/api/admin/reports/${report2Id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ action: 'hide_post', reason: 'Confirmed spam', notes: 'Hidden automatically' }),
    });
    const takeActionData = await takeActionRes.json();
    assert('Admin take action on report returns 200', takeActionRes.status === 200 && takeActionData.data.status === 'resolved');
    assert('Report action execution hid the target post', takeActionData.actionResult.isHidden === true);

    // 27. User Management (View users, Suspend user, Ban user, Restore user)
    console.log('-> 27. User Management');
    // View users
    const adminUsersRes = await fetch(`${baseUrl}/api/admin/users?search=Alice`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const adminUsersData = await adminUsersRes.json();
    assert('Admin GET /api/admin/users returns 200 with matching users', adminUsersRes.status === 200 && adminUsersData.data.length > 0);

    // View single user
    const adminSingleUserRes = await fetch(`${baseUrl}/api/admin/users/${aliceId}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const adminSingleUserData = await adminSingleUserRes.json();
    assert('Admin GET /api/admin/users/:id returns 200 with user stats', adminSingleUserRes.status === 200 && typeof adminSingleUserData.stats.postsCount === 'number');

    // Suspend Alice
    const suspendAliceRes = await fetch(`${baseUrl}/api/admin/users/${aliceId}/suspend`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ reason: 'Inappropriate conduct in comments', durationDays: 3 }),
    });
    const suspendAliceData = await suspendAliceRes.json();
    assert('Admin suspends user with 200', suspendAliceRes.status === 200 && suspendAliceData.data.status === 'suspended');

    // Suspended Alice blocked from creating posts
    const suspendedPostAttempt = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ text: 'Attempted post while suspended' }),
    });
    assert('Suspended user blocked from creating posts with 403 Forbidden', suspendedPostAttempt.status === 403);

    // Restore Alice from suspension
    const restoreAliceRes = await fetch(`${baseUrl}/api/admin/users/${aliceId}/restore`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert('Admin restores user with 200', restoreAliceRes.status === 200);

    // Restored Alice can post
    const restoredPostAttempt = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ text: 'Post after suspension restored' }),
    });
    assert('Restored user can create post with 201', restoredPostAttempt.status === 201);

    // Ban Alice
    const banAliceRes = await fetch(`${baseUrl}/api/admin/users/${aliceId}/ban`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
      body: JSON.stringify({ reason: 'Permanent ban for recurring violations' }),
    });
    assert('Admin bans user with 200', banAliceRes.status === 200);

    // Banned Alice blocked
    const bannedPostAttempt = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ text: 'Attempted post while banned' }),
    });
    assert('Banned user blocked with 403 Forbidden', bannedPostAttempt.status === 403);

    // Restore Alice again
    const unbanAliceRes = await fetch(`${baseUrl}/api/admin/users/${aliceId}/restore`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    assert('Admin unbans user with 200', unbanAliceRes.status === 200);

    // 28. Dashboard Statistics
    console.log('-> 28. Dashboard Statistics');
    const dashboardRes = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    const dashboardData = await dashboardRes.json();
    assert('Admin GET /api/admin/dashboard returns 200', dashboardRes.status === 200 && dashboardData.success === true);
    assert('Dashboard returns Total Users metric', typeof dashboardData.data.totalUsers === 'number' && dashboardData.data.totalUsers >= 2);
    assert('Dashboard returns Total Rants metric', typeof dashboardData.data.totalRants === 'number' && dashboardData.data.totalRants >= 1);
    assert('Dashboard returns Total Comments metric', typeof dashboardData.data.totalComments === 'number');
    assert('Dashboard returns Total Reactions metric', typeof dashboardData.data.totalReactions === 'number');
    assert('Dashboard returns Today\'s Rants metric', typeof dashboardData.data.todayRants === 'number' && dashboardData.data.todayRants >= 1);
    assert('Dashboard returns Today\'s Active Users metric', typeof dashboardData.data.todayActiveUsers === 'number' && dashboardData.data.todayActiveUsers >= 1);
    assert('Dashboard returns Pending Reports metric', typeof dashboardData.data.pendingReports === 'number');

    // ========================================================
    // 17. PHASE 10 — NOTIFICATIONS
    // ========================================================
    console.log('\n--- 17. Testing Phase 10 — Notifications ---');

    // 1. Setup a fresh test author (Dave) and recipient post
    const daveForm = new FormData();
    daveForm.append('name', 'Dave Brown');
    daveForm.append('email', 'dave@college.edu');
    daveForm.append('password', 'dave12345');
    const daveReg = await fetch(`${baseUrl}/api/auth/register`, { method: 'POST', body: daveForm });
    const daveData = await daveReg.json();
    const tokenDave = daveData.token;
    const daveId = daveData.data.id;
    assert('Dave registers as rant author with 201', daveReg.status === 201);

    // Dave posts a rant
    const davePostRes = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenDave}` },
      body: JSON.stringify({ text: 'Dave Rant: Chemistry lab equipment is outdated.' }),
    });
    const davePostData = await davePostRes.json();
    const davePostId = davePostData.data.id;
    assert('Dave creates rant with 201', davePostRes.status === 201);

    // 2. Notification: Comment on your rant
    // Alice comments on Dave's rant
    const aliceCommentOnDaveRes = await fetch(`${baseUrl}/api/posts/${davePostId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ text: 'Totally agree, the beakers are cracked!' }),
    });
    const aliceCommentOnDaveData = await aliceCommentOnDaveRes.json();
    const commentOnDaveId = aliceCommentOnDaveData.data.id;
    assert('Alice comments on Dave rant with 201', aliceCommentOnDaveRes.status === 201);

    // Check Dave's notifications
    const daveNotifsRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${tokenDave}` },
    });
    const daveNotifsData = await daveNotifsRes.json();
    assert('Dave fetches notifications with 200', daveNotifsRes.status === 200);
    const commentNotif = daveNotifsData.data.find((n) => n.type === 'comment');
    assert('Dave receives comment notification', Boolean(commentNotif));
    assert('Comment notification message mentions commenter or comment text', commentNotif && commentNotif.message.includes('commented on your rant'));
    assert('Comment notification has isRead: false', commentNotif && commentNotif.isRead === false);

    // 3. Notification: Reply to your comment
    // Dave replies to Alice's comment
    const daveReplyToAliceRes = await fetch(`${baseUrl}/api/comments/${commentOnDaveId}/replies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenDave}` },
      body: JSON.stringify({ text: 'Thanks for backing me up, Alice!' }),
    });
    assert('Dave replies to Alice comment with 201', daveReplyToAliceRes.status === 201);

    // Check Alice's notifications
    const aliceNotifsRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${tokenAlice}` },
    });
    const aliceNotifsData = await aliceNotifsRes.json();
    const replyNotif = aliceNotifsData.data.find((n) => n.type === 'reply');
    assert('Alice receives reply notification', Boolean(replyNotif));
    assert('Reply notification message contains reply alert', replyNotif && replyNotif.message.includes('replied to your comment'));

    // 4. Notification: Reaction on your rant
    // Alice reacts 🔥 to Dave's rant
    const aliceReactDaveRes = await fetch(`${baseUrl}/api/posts/${davePostId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAlice}` },
      body: JSON.stringify({ emoji: '🔥' }),
    });
    assert('Alice reacts to Dave rant with 200', aliceReactDaveRes.status === 200);

    // Check Dave's notifications again
    const daveNotifs2Res = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${tokenDave}` },
    });
    const daveNotifs2Data = await daveNotifs2Res.json();
    const reactNotif = daveNotifs2Data.data.find((n) => n.type === 'reaction');
    assert('Dave receives reaction notification', Boolean(reactNotif));
    assert('Reaction notification includes emoji 🔥', reactNotif && reactNotif.reactionEmoji === '🔥');

    // 5. Notification: Rant becomes trending
    // With 1 comment and 1 reaction, Dave's post engagement reached the trending threshold!
    const trendingNotif = daveNotifs2Data.data.find((n) => n.type === 'trending');
    assert('Dave receives trending notification when rant gets popular', Boolean(trendingNotif));
    assert('Trending notification message announces trending rant', trendingNotif && trendingNotif.message.includes('trending'));

    // 6. Notification Endpoints (Unread count, Mark as read, Mark all as read, Delete)
    // Check unread count
    const unreadCountRes = await fetch(`${baseUrl}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${tokenDave}` },
    });
    const unreadCountData = await unreadCountRes.json();
    assert('GET /api/notifications/unread-count returns 200', unreadCountRes.status === 200 && unreadCountData.count >= 2);

    // Mark single notification as read
    const markOneRes = await fetch(`${baseUrl}/api/notifications/${commentNotif.id}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenDave}` },
    });
    const markOneData = await markOneRes.json();
    assert('PUT /api/notifications/:id/read returns 200 and marks isRead: true', markOneRes.status === 200 && markOneData.data.isRead === true);

    // Mark all as read
    const markAllRes = await fetch(`${baseUrl}/api/notifications/mark-all-read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenDave}` },
    });
    assert('PUT /api/notifications/mark-all-read returns 200', markAllRes.status === 200);

    // Verify unread count is 0
    const unreadAfterAll = await fetch(`${baseUrl}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${tokenDave}` },
    });
    const unreadAfterAllData = await unreadAfterAll.json();
    assert('Unread count becomes 0 after mark-all-read', unreadAfterAllData.count === 0);

    // Delete single notification
    const deleteNotifRes = await fetch(`${baseUrl}/api/notifications/${commentNotif.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenDave}` },
    });
    assert('DELETE /api/notifications/:id returns 200', deleteNotifRes.status === 200);

    // Clear all notifications
    const clearAllRes = await fetch(`${baseUrl}/api/notifications`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenDave}` },
    });
    assert('DELETE /api/notifications returns 200', clearAllRes.status === 200);

    const daveNotifsEmptyRes = await fetch(`${baseUrl}/api/notifications`, {
      headers: { Authorization: `Bearer ${tokenDave}` },
    });
    const daveNotifsEmptyData = await daveNotifsEmptyRes.json();
    assert('Notifications list is empty after clear', daveNotifsEmptyData.data.length === 0);

  } finally {
    server.close();
    // Drop test database and close connection
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
    // Clean any test upload files
    const uploadsDir = path.join(__dirname, '../uploads');
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      if (file !== '.gitkeep') {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
    }
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n========================================`);
  console.log(`ALL TESTS PASSED: ${passed}/${results.length}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
