const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin: "*",
    credentials: false,
  }),
);
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.status(200).json({ status: "CenTex Distraxion API running" });
});

// API Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/profiles", require("./routes/profiles"));
app.use("/api/matches", require("./routes/matches"));
app.use("/api/messages", require("./routes/messages"));

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
