const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const authRoutes = require("./modules/auth/auth.routes");
const userRoutes = require("./modules/user/user.routes");
const postRoutes = require("./modules/post/post.routes");
const commentRoutes = require("./modules/comment/comment.routes");
const adminRoutes = require("./modules/admin/admin.routes");
const reportRoutes = require("./modules/report/report.routes");
const notificationRoutes = require("./modules/notification/notification.routes");
const announcementRoutes = require("./modules/announcement/announcement.routes");
const feedbackRoutes = require("./modules/feedback/feedback.routes");

connectDB();

const app = express();

app.set("trust proxy", true);

// Allow CORS for user and admin frontends (configurable via CLIENT_URL, ADMIN_URL, or ALLOWED_ORIGINS)
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.ADMIN_URL,
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",")
    : []),
  "http://localhost:5173", // User frontend default port
  "http://localhost:5174", // Admin frontend default port
  "http://localhost:3000",
]
  .filter(Boolean)
  .map((o) => o.trim().replace(/\/+$/, ""));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const cleanOrigin = origin.replace(/\/+$/, "");
      if (
        allowedOrigins.length === 0 ||
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(cleanOrigin) ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in deployment to prevent unexpected cross-domain blocks
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically, e.g. GET /uploads/169999-abc.png
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get(["/health", "/api/health"], (req, res) => {
  res.status(200).json({ status: "OK", message: "Rant website API is running", timestamp: new Date() });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/announcement-requests", announcementRoutes);
app.use("/api/feedback", feedbackRoutes);


app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
  );
});

module.exports = { app, server };
