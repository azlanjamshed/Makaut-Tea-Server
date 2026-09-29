# Rant Website — Backend API

A backend for a college "rant" / confession-style site. Users sign up with a
profile (name, email, password, bio, image), post rants (text + optional
image), and only the post's owner can edit or delete it. Each post tracks
how many unique people have viewed it.

## Stack

- Express.js (REST API)
- MongoDB + Mongoose
- JWT for authentication
- bcryptjs for password hashing
- multer + ImageKit for cloud image uploads (profile avatars & rant images)
- zod for robust schema validation and input sanitization

## Folder structure

```
config/         MongoDB connection
models/         Mongoose DB schemas & models (User, Post)
modules/        Feature-based modular architecture
  auth/         auth.routes, auth.controller, auth.service, auth.validate
  user/         user.routes, user.controller, user.service, user.validate
  post/         post.routes, post.controller, post.service, post.validate
middleware/     auth, upload, error handling, Zod request validator
utils/          helpers (JWT signing, ImageKit cloud storage)
uploads/        local fallback upload storage if ImageKit keys are not set
server.js       app entrypoint
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in real values:
   ```bash
   cp .env.example .env
   ```
   - `PORT` — server port (defaults to 5001 to avoid macOS AirPlay conflict on 5000)
   - `MONGO_URI` — your MongoDB connection string (local or Atlas)
   - `JWT_SECRET` — any long random string
   - `CLIENT_URL` — your frontend's URL, for CORS
   - `IMAGEKIT_PUBLIC_KEY` — your ImageKit public API key
   - `IMAGEKIT_PRIVATE_KEY` — your ImageKit private API key
   - `IMAGEKIT_URL_ENDPOINT` — your ImageKit URL endpoint (e.g. `https://ik.imagekit.io/<your_id>`)
3. Run it:
   ```bash
   npm run dev    # with nodemon, auto-restarts on file changes
   # or
   npm start
   ```
5. Seed Admin User:
   ```bash
   npm run seed:admin
   # or with custom credentials:
   node scripts/seedAdmin.js --email=admin@campus.edu --password=MySecurePassword123
   ```
6. Health check: `GET http://localhost:5001/api/health`

## Authentication

Every private route expects a JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

You get a token back from `/api/auth/register` and `/api/auth/login`.

## Authorization model

- Any logged-in user can create posts.
- A post can only be edited or deleted by the user who created it
  (`postController.updatePost` / `deletePost` check `post.user` against
  `req.user._id`, derived from the JWT — never from something the client
  can fake in the request body).
- A user can only update or delete **their own** account (`/api/users/me`,
  identified from the token, not from a URL parameter).

## Email validation

Emails are validated twice:
- `zod` schema parsing on incoming requests (register/login)
- A matching format check in the Mongoose `User` schema itself, so bad data
  can't sneak in through any other code path

This checks the email is properly *formatted* (syntax, valid-looking domain).
Verifying the address is truly *reachable* would require sending a
confirmation email with a verification link/token — a common next step, not
included here since it needs an email-sending service (e.g. Nodemailer +
SMTP, SendGrid, Resend).

## API Reference

### Auth — `/api/auth`

| Method | Route              | Access  | Body                                               |
|--------|--------------------|---------|-----------------------------------------------------|
| POST   | `/register`        | Public  | `name, email, password, bio?` + optional `image` file (multipart/form-data) |
| POST   | `/login`           | Public  | `email, password`                                   |
| GET    | `/me`               | Private | —                                                    |

### Users — `/api/users`

| Method | Route     | Access          | Body |
|--------|-----------|-----------------|------|
| GET    | `/:id`    | Public          | — (public profile: name, bio, image, no password) |
| PUT    | `/me`     | Private (owner) | `name?, bio?, password?` + optional `image` file |
| DELETE | `/me`     | Private (owner) | — (also deletes all of that user's posts) |

### Posts — `/api/posts`

| Method | Route                   | Access               | Description / Query / Body |
|--------|-------------------------|----------------------|----------------------------|
| GET    | `/`                     | Public               | query: `page`, `limit`, `department`, `username`, `q` |
| GET    | `/search`               | Public               | query: `department`, `username`, `q`, `page`, `limit` |
| GET    | `/department/:dept`     | Public               | query: `page`, `limit` |
| POST   | `/`                     | Private              | `text`, `isAnonymous?` + optional `image` file |
| GET    | `/:id`                  | Public               | Increments `views` once per unique viewer |
| PUT    | `/:id`                  | Private (owner only) | `text?`, `isAnonymous?` + optional `image` file |
| DELETE | `/:id`                  | Private (owner only) | Delete post & its comments |
| GET    | `/user/:userId`         | Public               | All posts by one user |
| GET    | `/trending/today`       | Public               | Trending rants in past 24 hours |
| GET    | `/trending/week`        | Public               | Trending rants in past 7 days |
| GET    | `/popular`              | Public               | Top all-time popular rants |
| GET    | `/my-reactions`         | Private              | Rants the logged-in user reacted to |
| POST   | `/:id/reactions`        | Private              | `emoji`: 😂, 💀, 😭, 🔥 (toggle/change) |
| DELETE | `/:id/reactions`        | Private              | Remove reaction |
| GET    | `/:id/reactions`        | Private (owner only) | List of users who reacted with profile links |

Image uploads use `multipart/form-data` with the field name `image`.

### Reports — `/api/reports`

| Method | Route     | Access  | Description |
|--------|-----------|---------|-------------|
| POST   | `/`       | Private | Submit a report (`targetType: 'post'\|'comment'\|'user'`, `targetId`, `reason`, `description?`) |
| GET    | `/my`     | Private | View reports submitted by the logged-in user |

### Admin — `/api/admin`

All admin routes except `/login` require `protect` and `adminOnly` (`role: 'admin'`).

| Method | Route                   | Access          | Description |
|--------|-------------------------|-----------------|-------------|
| POST   | `/login`                | Public          | Admin login with email & password (requires `role: 'admin'`) |
| GET    | `/me`                   | Admin           | Get current admin profile |
| GET    | `/dashboard` / `/stats` | Admin           | Dashboard metrics: Total Users, Total Rants, Total Comments, Total Reactions, Today's Rants, Today's Active Users, Pending Reports |
| GET    | `/posts`                | Admin           | View all rants (filter: `status=all\|active\|hidden\|deleted`, `department`, `search`) |
| GET    | `/posts/:id`            | Admin           | View single rant with moderation details |
| PUT    | `/posts/:id/hide`       | Admin           | Hide a rant from public feeds (`reason?`) |
| PUT    | `/posts/:id/unhide`     | Admin           | Unhide a rant, restoring public visibility |
| DELETE | `/posts/:id`            | Admin           | Soft-delete a rant (`reason?`) |
| PUT    | `/posts/:id/restore`    | Admin           | Restore a deleted or hidden rant |
| GET    | `/reports`              | Admin           | View submitted reports (`status=pending\|investigating\|resolved\|rejected`, `targetType`) |
| GET    | `/reports/:id`          | Admin           | View single report with target details |
| PUT    | `/reports/:id/status`   | Admin           | Assign report status (`status: 'investigating'\|'resolved'\|'rejected'`, `notes?`) |
| PUT    | `/reports/:id/resolve`  | Admin           | Resolve report (`actionTaken`, `notes?`) |
| PUT    | `/reports/:id/reject`   | Admin           | Reject report (`notes?`) |
| POST   | `/reports/:id/action`   | Admin           | Take moderation action (`action: 'hide_post'\|'delete_post'\|'suspend_user'\|'ban_user'\|'dismiss'`, `reason?`, `durationDays?`, `notes?`) |
| GET    | `/users`                | Admin           | View all users (`status=active\|suspended\|banned`, `role=user\|admin`, `search`) |
| GET    | `/users/:id`            | Admin           | View user details with activity metrics |
| PUT    | `/users/:id/suspend`    | Admin           | Suspend user (`reason`, `durationDays?`) |
| PUT    | `/users/:id/ban`        | Admin           | Permanently ban user (`reason`) |
| PUT    | `/users/:id/restore`    | Admin           | Restore suspended or banned user |

### Notifications — `/api/notifications`

All notification routes require `protect`.

| Method | Route                   | Access  | Description |
|--------|-------------------------|---------|-------------|
| GET    | `/`                     | Private | Get paginated notifications (`page`, `limit`, `unreadOnly`) |
| GET    | `/unread-count`         | Private | Get unread notification badge count |
| PUT    | `/mark-all-read`        | Private | Mark all notifications for the user as read |
| PUT    | `/:id/read`             | Private | Mark a single notification as read |
| DELETE | `/:id`                  | Private | Delete a notification |
| DELETE | `/`                     | Private | Clear all notifications |

Notifications are automatically generated for:
- 💬 **Comment on your rant**: when another student comments on your post.
- ↩️ **Reply to your comment**: when another user replies to your comment.
- ❤️ **Reaction**: when someone reacts (`😂`, `💀`, `😭`, `🔥`) to your rant.
- 🚀 **Rant becomes trending**: when your rant gains high engagement and qualifies as trending.

## View counting

Each post keeps a hidden `viewedBy` list. Logged-in viewers are tracked by
their user id; anonymous viewers are tracked by a hashed IP. A post's
`views` count only increases the first time a given viewer opens it, so
repeated refreshes by the same person don't inflate the number.

## Notes / possible next steps

- Add rate limiting (e.g. `express-rate-limit`) on `/api/auth/*` to slow
  down brute-force login attempts.
- Add refresh tokens if you want shorter-lived access tokens.
- Add an email-verification flow if you need to confirm addresses are real,
  not just well-formatted.
- Add a `helmet` middleware pass for extra HTTP security headers in production.
