const User = require("../models/User");

// Runs after `auth`. Blocks browse/swipe/message until the account has a
// confirmed email, a passed live selfie, and a face-matched profile photo.
module.exports = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ msg: "User not found" });
    if (!user.isVerified()) {
      return res.status(403).json({
        msg: "Verify your account first",
        needsVerification: true,
        steps: {
          email: user.emailVerified,
          selfie: user.verification?.status === "verified",
          photo: user.photos.length > 0,
        },
      });
    }
    // Activity heartbeat, throttled to one write per 5 minutes
    const now = Date.now();
    if (!user.lastActiveAt || now - user.lastActiveAt.getTime() > 5 * 60 * 1000) {
      user.lastActiveAt = new Date(now);
      await User.updateOne({ _id: user._id }, { lastActiveAt: user.lastActiveAt });
    }
    req.me = user;
    next();
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
};
