const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET is missing or too short (need 32+ chars)");
  process.exit(1);
}

// CORS — only the origins listed in CORS_ORIGINS may call the API
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Origin not allowed"));
    },
  }),
);
// Selfie frames arrive as base64 JPEGs, so allow larger bodies
app.use(express.json({ limit: "6mb" }));

// Request log — method + path only, never bodies (they contain passwords)
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/", (req, res) => {
  res.status(200).json({ status: "DistraXion API running" });
});

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/verify", require("./routes/verify"));
app.use("/api/photos", require("./routes/photos"));
app.use("/api/profiles", require("./routes/profiles"));
app.use("/api/matches", require("./routes/matches"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/safety", require("./routes/safety"));

// 404 fallback for unknown API routes
app.use((req, res) => {
  res.status(404).json({ msg: "Route not found" });
});

// Start server after DB connection
const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in .env");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Server startup error:", err.message);
    process.exit(1);
  }
};

startServer();
