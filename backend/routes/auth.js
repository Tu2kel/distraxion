const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

// ─── SUPERUSER CONFIG ────────────────────────────────────────────────
const SU_USERNAME = "imperio";
const SU_PASSWORD = "imperioTest";
const SU_ID = "superuser-dev-001"; // fake stable ID

const TIER_REGION = {
  free: "local",
  plus: "texas",
  global: "worldwide",
};

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function superUserPayload(tier = "free") {
  return {
    id: SU_ID,
    isSuperUser: true,
    tier,
    tierRegion: TIER_REGION[tier],
    name: "Imperio (Dev)",
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
// ─────────────────────────────────────────────────────────────────────

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      age,
      city,
      gender,
      seeking,
      background,
      vibe,
      bio,
    } = req.body;

    if (!name || !email || !password || !age || !city) {
      return res.status(400).json({ msg: "Missing required fields" });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists)
      return res.status(400).json({ msg: "Email already registered" });

    const user = await User.create({
      name,
      email,
      password,
      age,
      city,
      gender,
      seeking,
      background,
      vibe,
      bio,
    });

    const token = signToken({ id: user._id });
    return res.status(201).json({ token, msg: "Account created" });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── SuperUser bypass ──────────────────────────────────────────────
    if (email === SU_USERNAME && password === SU_PASSWORD) {
      const payload = superUserPayload("free");
      const token = signToken(payload);
      return res.json({
        token,
        user: payload,
        isSuperUser: true,
        msg: "SuperUser login — dev mode active",
      });
    }
    // ─────────────────────────────────────────────────────────────────

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const match = await user.matchPassword(password);
    if (!match) return res.status(400).json({ msg: "Invalid credentials" });

    if (!user.active)
      return res.status(403).json({ msg: "Account deactivated" });

    const token = signToken({ id: user._id });
    return res.json({ token, msg: "Login successful" });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// GET /api/auth/me
router.get("/me", auth, async (req, res) => {
  try {
    // ── SuperUser bypass ──────────────────────────────────────────────
    if (req.user.isSuperUser) {
      return res.json(req.user);
    }
    // ─────────────────────────────────────────────────────────────────

    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// POST /api/auth/superuser-upgrade
// Body: { tier: 'plus' | 'global' }
// Returns a new token at the requested tier + $0 charge confirmation.
router.post("/superuser-upgrade", auth, async (req, res) => {
  try {
    if (!req.user.isSuperUser) {
      return res.status(403).json({ msg: "Not authorized" });
    }

    const { tier } = req.body;
    if (!["free", "plus", "global"].includes(tier)) {
      return res.status(400).json({ msg: "Invalid tier" });
    }

    const payload = superUserPayload(tier);
    const token = signToken(payload);

    return res.json({
      token,
      user: payload,
      isSuperUser: true,
      charged: 0,
      currency: "USD",
      msg: `SuperUser upgraded to ${tier} — $0.00 charged`,
    });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
