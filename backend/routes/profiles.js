const router = require("express").Router();
const User = require("../models/User");
const auth = require("../middleware/auth");

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
    tier: u.tier,
    tierRegion: u.tierRegion,
    active: u.active,
    createdAt: u.createdAt,
  };
};

// GET all browseable profiles except current user
router.get("/browse", auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id).select("-password");

    if (!currentUser) {
      return res.status(404).json({ msg: "Current user not found" });
    }

    const query = {
      _id: { $ne: req.user.id },
      active: true,
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
router.get("/:id", auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user || !user.active) {
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
      "photos",
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

    if (updates.photos && !Array.isArray(updates.photos)) {
      return res.status(400).json({ msg: "photos must be an array" });
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
