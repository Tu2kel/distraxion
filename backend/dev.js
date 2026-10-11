// Local QA launcher: throwaway in-memory database, codes shown on screen.
// Usage: npm run dev   → API on http://localhost:3001
// Data is wiped every time this stops. Never used in production.
const crypto = require("crypto");
const { MongoMemoryServer } = require("mongodb-memory-server");

(async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri();
  process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
  process.env.DEV_SHOW_CODES = "1";
  process.env.CORS_ORIGINS =
    "http://localhost:5500,http://127.0.0.1:5500";
  // dotenv won't override values already set above
  require("./server");
})();
