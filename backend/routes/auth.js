const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

// ─── SUPERUSER CONFIG ────────────────────────────────────────────────
const SU_USERNAME = "imperio";
const SU_PASSWORD = "imperioTest";
const SU_ID = "superuser-dev-001";

const TIER_REGION = {
  free: "local",
  plus: "texas",
  global: "worldwide",
};

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET || "secret", {
    expiresIn: "7d",
  });
}

function superUserPayload(tier = "free") {
  return {
    id: SU_ID,
    isSuperUser: true,
    tier,
    tierRegion: TIER_REGION[tier],
    name: "Imperio (Dev)",
    username: "imperio",
    email: "dev@imperiovita.co",
    age: 30,
    city: "Killeen",
    gender: "man",
    seeking: "everyone",
    background: ["Veteran"],
    vibe: ["Taking it slow"],
    bio: "SuperUser dev account.",
    photos: [],
    active: true,
  };
}

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { name, username, email, password, age, city, gender, seeking } =
      req.body;

    if (!name || !username || !email || !password || !age || !city) {
      return res.status(400).json({ msg: "Missing required fields" });
    }

    const emailExists = await User.findOne({ email: email.toLowerCase() });
    if (emailExists)
      return res.status(400).json({ msg: "Email already registered" });

    const usernameExists = await User.findOne({
      username: username.toLowerCase(),
    });
    if (usernameExists)
      return res.status(400).json({ msg: "Username already taken" });

    const user = await User.create({
      name,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      age,
      city,
      gender,
      seeking,
    });

    const token = signToken({ id: user._id });
    return res.status(201).json({ token, msg: "Account created" });
  } catch (err) {
    console.error("Signup Error:", err); // This helps you see the error in VS Code
    return res.status(500).json({ msg: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // SuperUser bypass
    if (username === SU_USERNAME && password === SU_PASSWORD) {
      const payload = superUserPayload("free");
      const token = signToken(payload);
      return res.json({
        token,
        user: payload,
        isSuperUser: true,
        msg: "SuperUser login",
      });
    }

    if (!username || !password) {
      return res.status(400).json({ msg: "Username and password required" });
    }

    const user = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: username.toLowerCase() },
      ],
    });

    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const match = await user.matchPassword(password);
    if (!match) return res.status(400).json({ msg: "Invalid credentials" });

    const token = signToken({ id: user._id });
    return res.json({ token, msg: "Login successful" });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
