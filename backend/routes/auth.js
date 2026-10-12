const router = require("express").Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const Photo = require("../models/Photo");
const Message = require("../models/Message");
const { Match, Swipe } = require("../models/Match");
const { Block, Report } = require("../models/Safety");
const auth = require("../middleware/auth");
const { sendVerificationCode } = require("../services/email");

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 });
const codeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8 });

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}

const hashCode = (code) =>
  crypto.createHash("sha256").update(String(code)).digest("hex");

async function issueEmailCode(user) {
  const code = String(crypto.randomInt(100000, 1000000));
  user.emailCode = hashCode(code);
  user.emailCodeExpires = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();
  await sendVerificationCode(user.email, code);
  return code;
}

// Local/demo only: echo the code back so testers can finish signup
// without an email service. Never set DEV_SHOW_CODES in production.
const devCode = (code) =>
  process.env.DEV_SHOW_CODES === "1" ? { devCode: code } : {};

// Cloudflare Turnstile (free bot check). Skipped when no secret is set.
async function passesTurnstile(token, ip) {
  if (!process.env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET,
        response: token,
        remoteip: ip,
      }),
    },
  );
  const data = await res.json();
  return data.success === true;
}

function verificationState(user) {
  return {
    email: user.emailVerified,
    selfie: user.verification?.status === "verified",
    photo: user.photos.length > 0,
    verified: user.isVerified(),
  };
}

// POST /api/auth/signup
router.post("/signup", authLimiter, async (req, res) => {
  try {
    const {
      name,
      username,
      email,
      password,
      age,
      city,
      gender,
      seeking,
      background,
      vibe,
      bio,
      turnstileToken,
    } = req.body;

    if (!name || !username || !email || !password || !age || !city) {
      return res.status(400).json({ msg: "Missing required fields" });
    }
    if (Number(age) < 18) {
      return res.status(400).json({ msg: "You must be 18 or older" });
    }
    if (String(password).length < 8) {
      return res
        .status(400)
        .json({ msg: "Password must be at least 8 characters" });
    }
    if (!(await passesTurnstile(turnstileToken, req.ip))) {
      return res.status(400).json({ msg: "Bot check failed — try again" });
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
      background: Array.isArray(background) ? background : [],
      vibe: Array.isArray(vibe) ? vibe : [],
      bio,
    });

    const code = await issueEmailCode(user);

    const token = signToken({ id: user._id });
    return res.status(201).json({
      token,
      msg: "Account created — check your email for a code",
      verification: verificationState(user),
      ...devCode(code),
    });
  } catch (err) {
    console.error("Signup Error:", err.message);
    return res.status(500).json({ msg: "Signup failed" });
  }
});

// POST /api/auth/login
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ msg: "Username and password required" });
    }

    const user = await User.findOne({
      $or: [
        { username: String(username).toLowerCase() },
        { email: String(username).toLowerCase() },
      ],
    });

    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const match = await user.matchPassword(password);
    if (!match) return res.status(400).json({ msg: "Invalid credentials" });

    await User.updateOne({ _id: user._id }, { lastActiveAt: new Date() });

    const token = signToken({ id: user._id });
    return res.json({
      token,
      msg: "Login successful",
      verification: verificationState(user),
    });
  } catch (err) {
    return res.status(500).json({ msg: "Login failed" });
  }
});

// GET /api/auth/me
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });
    return res.json({
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      age: user.age,
      city: user.city,
      gender: user.gender,
      seeking: user.seeking,
      background: user.background,
      vibe: user.vibe,
      bio: user.bio,
      photos: user.photos,
      tier: user.tier,
      verification: verificationState(user),
    });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// POST /api/auth/verify-email  { code }
router.post("/verify-email", auth, codeLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "+emailCode +emailCodeExpires",
    );
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (user.emailVerified) {
      return res.json({ msg: "Email already verified" });
    }
    if (
      !user.emailCode ||
      user.emailCodeExpires < new Date() ||
      user.emailCode !== hashCode(String(req.body.code || "").trim())
    ) {
      return res.status(400).json({ msg: "Invalid or expired code" });
    }
    user.emailVerified = true;
    user.emailCode = undefined;
    user.emailCodeExpires = undefined;
    await user.save();
    return res.json({
      msg: "Email verified",
      verification: verificationState(user),
    });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// POST /api/auth/resend-code
router.post("/resend-code", auth, codeLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (user.emailVerified) return res.json({ msg: "Email already verified" });
    const code = await issueEmailCode(user);
    return res.json({ msg: "New code sent", ...devCode(code) });
  } catch (err) {
    return res.status(500).json({ msg: "Could not send code" });
  }
});

// DELETE /api/auth/me  { password } — permanently delete the account and
// everything it owns. Conversations under a report are kept as moderation
// evidence; reports filed by this user are kept with the reporter cleared.
router.delete("/me", auth, authLimiter, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (!req.body?.password || !(await user.matchPassword(req.body.password))) {
      return res.status(400).json({ msg: "Password is incorrect" });
    }
    const id = user._id;

    const matchIds = await Match.find({ users: id }).distinct("_id");
    const evidence = await Report.find({ match: { $in: matchIds } }).distinct("match");
    const keep = new Set(evidence.map(String));
    const removable = matchIds.filter((m) => !keep.has(String(m)));

    await Promise.all([
      Photo.deleteMany({ owner: id }), // profile photos + private selfie
      Swipe.deleteMany({ $or: [{ from: id }, { to: id }] }),
      Message.deleteMany({ match: { $in: removable } }),
      Match.deleteMany({ _id: { $in: removable } }),
      Match.updateMany(
        { _id: { $in: evidence }, endedAt: null },
        { endedAt: new Date(), endedBy: id, endReason: "unmatch" },
      ),
      Block.deleteMany({ $or: [{ blocker: id }, { blocked: id }] }),
      Report.updateMany({ reporter: id }, { $unset: { reporter: 1 } }),
    ]);
    await User.deleteOne({ _id: id });

    return res.json({ msg: "Account deleted" });
  } catch (err) {
    console.error("Delete account error:", err.message);
    return res.status(500).json({ msg: "Could not delete account" });
  }
});

module.exports = router;
