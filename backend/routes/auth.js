const router = require("express").Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

// Helper: token creator
const makeToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// Helper: safe user payload
const safeUser = (u) => {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    age: u.age,
    city: u.city,
    gender: u.gender,
    seeking: u.seeking,
    background: u.background,
    vibe: u.vibe,
    bio: u.bio,
    photos: u.photos,
    isPremium: u.isPremium,
    active: u.active,
    createdAt: u.createdAt,
  };
};

// SIGN UP
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
      return res
        .status(400)
        .json({ msg: "Name, email, password, age, and city are required" });
    }

    if (String(password).length < 6) {
      return res
        .status(400)
        .json({ msg: "Password must be at least 6 characters" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ msg: "Email already registered" });
    }

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password,
      age,
      city: String(city).trim(),
      gender,
      seeking,
      background: Array.isArray(background) ? background : [],
      vibe: Array.isArray(vibe) ? vibe : [],
      bio: bio ? String(bio).trim() : "",
    });

    const token = makeToken(user._id);

    return res.status(201).json({
      token,
      user: safeUser(user),
    });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ msg: "Invalid credentials" });
    }

    const token = makeToken(user._id);

    return res.json({
      token,
      user: safeUser(user),
    });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// LOGOUT
router.post("/logout", auth, async (req, res) => {
  return res.json({ msg: "Logged out" });
});

// DELETE PROFILE
router.delete("/delete", auth, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.user.id);

    if (!deletedUser) {
      return res.status(404).json({ msg: "User not found" });
    }

    return res.json({ msg: "Profile deleted" });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// GET CURRENT USER
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    return res.json(user);
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
