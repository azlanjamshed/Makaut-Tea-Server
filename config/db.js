const mongoose = require('mongoose');

/**
 * GLOBAL DATABASE DELETION FIREWALL:
 * Enforces that data can ONLY be deleted through explicit user or admin action with specific criteria.
 * Blanket mass deletions, empty filter wipes, and collection/database drops are permanently blocked.
 */
mongoose.plugin((schema) => {
  schema.pre('deleteMany', function (next) {
    const filter = this.getFilter();
    // 1. Block empty filter deleteMany({})
    if (!filter || Object.keys(filter).length === 0) {
      const err = new Error('DATABASE SAFETY BLOCK: Blanket deletion without criteria is strictly prohibited!');
      console.error(err.message);
      return next(err);
    }

    // 2. Block undefined/null parameters in filter (e.g. { user: undefined })
    for (const [key, value] of Object.entries(filter)) {
      if (value === undefined || value === null) {
        const err = new Error(`DATABASE SAFETY BLOCK: Deletion filter contains invalid '${key}: ${value}'!`);
        console.error(err.message);
        return next(err);
      }
    }
    next();
  });
});

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/rant-website';
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${conn.connection.host}`);

    // Permanently block dropDatabase and dropCollection on active connections
    conn.connection.dropDatabase = async () => {
      throw new Error('DATABASE SAFETY BLOCK: dropDatabase() has been permanently disabled on this connection.');
    };
    conn.connection.dropCollection = async (name) => {
      throw new Error(`DATABASE SAFETY BLOCK: dropCollection('${name}') has been permanently disabled on this connection.`);
    };
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
