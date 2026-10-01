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
    req.me = user;
    next();
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
};
