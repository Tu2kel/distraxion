const router = require("express").Router();
const User = require("../models/User");
const auth = require("../middleware/auth");
const verified = require("../middleware/verified");

// Only fully verified people are ever shown to anyone
const VERIFIED_QUERY = {
  emailVerified: true,
  "verification.status": "verified",
  "photos.0": { $exists: true },
};

// Helper: sanitize user object for public/profile responses
const publicUser = (u) => {
  return {
    id: u._id,
    name: u.name,
    age: u.age,
    city: u.city,
    gender: u.gender,
    seeking: u.seeking,
    background: u.background,
    vibe: u.vibe,
    bio: u.bio,
    photos: u.photos,
    verified: true,
    active: u.active,
    createdAt: u.createdAt,
  };
};

// GET all browseable profiles except current user
router.get("/browse", auth, verified, async (req, res) => {
  try {
    const currentUser = req.me;

    const query = {
      _id: { $ne: req.user.id },
      active: true,
      ...VERIFIED_QUERY,
    };

    // Basic seeking filter
    if (currentUser.seeking === "women") {
      query.gender = "woman";
    } else if (currentUser.seeking === "men") {
      query.gender = "man";
    }

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 });

    return res.json(users.map(publicUser));
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// GET one profile by ID
router.get("/:id", auth, verified, async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      active: true,
      ...VERIFIED_QUERY,
    }).select("-password");

    if (!user) {
      return res.status(404).json({ msg: "Profile not found" });
    }

    return res.json(publicUser(user));
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// UPDATE current user's profile
router.put("/me", auth, async (req, res) => {
  try {
    const allowedFields = [
      "name",
      "age",
      "city",
      "gender",
      "seeking",
      "background",
      "vibe",
      "bio",
      "active",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.name) updates.name = String(updates.name).trim();
    if (updates.city) updates.city = String(updates.city).trim();
    if (updates.bio !== undefined) updates.bio = String(updates.bio).trim();

    if (updates.background && !Array.isArray(updates.background)) {
      return res.status(400).json({ msg: "background must be an array" });
    }

    if (updates.vibe && !Array.isArray(updates.vibe)) {
      return res.status(400).json({ msg: "vibe must be an array" });
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    return res.json({
      msg: "Profile updated successfully",
      user: publicUser(user),
    });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
