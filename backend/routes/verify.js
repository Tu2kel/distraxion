const router = require("express").Router();
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const Photo = require("../models/Photo");
const auth = require("../middleware/auth");
const face = require("../services/face");

// Tunables — similarity is 0..1 from the face engine
const SAME_PERSON = 0.5; // frames within one selfie session
const DUPLICATE_FACE = 0.62; // same face already verified on another account
const MIN_REAL = 0.5; // antispoof (printed photo / screen replay)
const MIN_LIVE = 0.5;
const MIN_FACE_PX = 100;
const CHALLENGE_TTL_MS = 2 * 60 * 1000;
const MAX_ATTEMPTS_PER_DAY = 5;

const STEPS = {
  center: {
    prompt: "Look straight at the camera",
    ok: (f) => Math.abs(f.yaw) < 0.15,
    fail: "Face the camera straight on",
  },
  turn: {
    prompt: "Turn your head to the side",
    ok: (f) => Math.abs(f.yaw) > 0.25,
    fail: "Turn your head further to the side",
  },
  smile: {
    prompt: "Give us a big smile",
    ok: (f) => f.happy > 0.6,
    fail: "We couldn't see a smile",
  },
};

// userId -> { nonce, steps, expires }  (single-instance in-memory store)
const challenges = new Map();

const limiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 15 });

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function decodeFrame(dataUrl) {
  const m = /^data:image\/(jpeg|png);base64,(.+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  return buf.length > 0 && buf.length < 2 * 1024 * 1024 ? buf : null;
}

function attemptsToday(user) {
  const last = user.verification?.lastAttemptAt;
  const sameDay =
    last && last.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
  return sameDay ? user.verification.attempts : 0;
}

async function recordFailure(user, reason) {
  user.verification.attempts = attemptsToday(user) + 1;
  user.verification.lastAttemptAt = new Date();
  user.verification.lastFailReason = reason;
  await user.save();
}

// GET /api/verify/status
router.get("/status", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ msg: "User not found" });
  return res.json({
    email: user.emailVerified,
    selfie: user.verification?.status === "verified",
    photo: user.photos.length > 0,
    verified: user.isVerified(),
    attemptsLeft: Math.max(0, MAX_ATTEMPTS_PER_DAY - attemptsToday(user)),
    lastFailReason: user.verification?.lastFailReason || null,
  });
});

// POST /api/verify/challenge — start a live selfie session
router.post("/challenge", auth, limiter, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ msg: "User not found" });
  if (!user.emailVerified) {
    return res.status(403).json({ msg: "Verify your email first" });
  }
  if (user.verification?.status === "verified") {
    return res.json({ msg: "Already verified", verified: true });
  }
  if (attemptsToday(user) >= MAX_ATTEMPTS_PER_DAY) {
    return res
      .status(429)
      .json({ msg: "Too many attempts today — try again tomorrow" });
  }

  const steps = shuffle(Object.keys(STEPS));
  const nonce = crypto.randomBytes(16).toString("hex");
  challenges.set(String(user._id), {
    nonce,
    steps,
    expires: Date.now() + CHALLENGE_TTL_MS,
  });

  return res.json({
    nonce,
    expiresInSec: CHALLENGE_TTL_MS / 1000,
    steps: steps.map((id) => ({ id, prompt: STEPS[id].prompt })),
  });
});

// POST /api/verify/selfie  { nonce, frames: [dataUrl, ...] } — one per step
router.post("/selfie", auth, limiter, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "+verification.embedding",
    );
    if (!user) return res.status(404).json({ msg: "User not found" });

    const key = String(user._id);
    const ch = challenges.get(key);
    challenges.delete(key); // one submission per challenge

    if (!ch || ch.nonce !== req.body.nonce || ch.expires < Date.now()) {
      return res
        .status(400)
        .json({ msg: "Session expired — start the selfie again" });
    }

    const frames = Array.isArray(req.body.frames) ? req.body.frames : [];
    if (frames.length !== ch.steps.length) {
      return res.status(400).json({ msg: "Missing selfie frames" });
    }

    const results = [];
    for (let i = 0; i < ch.steps.length; i++) {
      const step = STEPS[ch.steps[i]];
      const buf = decodeFrame(frames[i]);
      if (!buf) return res.status(400).json({ msg: "Bad image data" });

      const faces = await face.analyze(buf);
      let reason = null;
      if (faces.length === 0) reason = "No face found — check your lighting";
      else if (faces.length > 1) reason = "Only you should be in the frame";
      else if (faces[0].size < MIN_FACE_PX) reason = "Move closer to the camera";
      else if (faces[0].real < MIN_REAL || faces[0].live < MIN_LIVE)
        reason = "This looks like a photo of a screen or print";
      else if (!step.ok(faces[0])) reason = step.fail;

      if (reason) {
        await recordFailure(user, reason);
        return res.status(400).json({ msg: reason, step: i });
      }
      results.push({ buf, f: faces[0], id: ch.steps[i] });
    }

    // Every frame must be the same person as the straight-on frame
    const anchor = results.find((r) => r.id === "center");
    for (const r of results) {
      if (face.similarity(anchor.f.embedding, r.f.embedding) < SAME_PERSON) {
        const reason = "Frames don't look like the same person";
        await recordFailure(user, reason);
        return res.status(400).json({ msg: reason });
      }
    }

    // One face, one account: reject if this face is already verified elsewhere
    const others = await User.find({
      _id: { $ne: user._id },
      "verification.status": "verified",
    }).select("+verification.embedding");
    const dupe = others.find(
      (o) =>
        face.similarity(anchor.f.embedding, o.verification.embedding) >=
        DUPLICATE_FACE,
    );
    if (dupe) {
      const reason = "This face is already verified on another account";
      await recordFailure(user, reason);
      return res.status(409).json({ msg: reason });
    }

    // Keep the straight-on frame privately for appeals / moderation
    await Photo.create({ owner: user._id, kind: "selfie", data: anchor.buf });

    user.verification.status = "verified";
    user.verification.verifiedAt = new Date();
    user.verification.embedding = anchor.f.embedding;
    user.verification.lastFailReason = undefined;
    await user.save();

    return res.json({ msg: "Selfie verified", verified: user.isVerified() });
  } catch (err) {
    console.error("Selfie verify error:", err.message);
    return res.status(500).json({ msg: "Verification failed — try again" });
  }
});

module.exports = router;
module.exports.SAME_PERSON = SAME_PERSON;
