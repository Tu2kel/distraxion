const router = require("express").Router();
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const { Match, pairKey } = require("../models/Match");
const { Block, Report, REPORT_REASONS } = require("../models/Safety");
const auth = require("../middleware/auth");

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 });

// Ends any live match between two people (kept for moderation)
async function endMatch(me, otherId, reason) {
  await Match.updateOne(
    { pair: pairKey(me, otherId), endedAt: null },
    { endedAt: new Date(), endedBy: me, endReason: reason },
  );
}

async function blockUser(me, otherId) {
  await Block.updateOne(
    { blocker: me, blocked: otherId },
    { $setOnInsert: { blocker: me, blocked: otherId } },
    { upsert: true },
  );
}

function validTarget(req, res) {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) {
    res.status(404).json({ msg: "User not found" });
    return null;
  }
  if (userId === String(req.user.id)) {
    res.status(400).json({ msg: "You can't do that to yourself" });
    return null;
  }
  return userId;
}

// POST /api/safety/block/:userId — hide each other everywhere, end any match.
// Works whether or not you're verified, so new users can protect themselves.
router.post("/block/:userId", auth, limiter, async (req, res) => {
  try {
    const target = validTarget(req, res);
    if (!target) return;
    if (!(await User.exists({ _id: target }))) {
      return res.status(404).json({ msg: "User not found" });
    }
    await blockUser(req.user.id, target);
    await endMatch(req.user.id, target, "block");
    return res.json({ msg: "Blocked" });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// DELETE /api/safety/block/:userId — unblock (an ended match stays ended)
router.delete("/block/:userId", auth, async (req, res) => {
  try {
    const target = validTarget(req, res);
    if (!target) return;
    await Block.deleteOne({ blocker: req.user.id, blocked: target });
    return res.json({ msg: "Unblocked" });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// GET /api/safety/blocks — people I've blocked
router.get("/blocks", auth, async (req, res) => {
  try {
    const rows = await Block.find({ blocker: req.user.id })
      .populate("blocked", "name")
      .sort({ createdAt: -1 });
    return res.json(
      rows
        .filter((r) => r.blocked)
        .map((r) => ({ id: r.blocked._id, name: r.blocked.name, since: r.createdAt })),
    );
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// POST /api/safety/report/:userId  { reason, details?, matchId? }
// Reporting also blocks, so the reporter never sees that person again.
router.post("/report/:userId", auth, limiter, async (req, res) => {
  try {
    const target = validTarget(req, res);
    if (!target) return;
    const { reason, details, matchId } = req.body;
    if (!REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ msg: "Pick a reason", reasons: REPORT_REASONS });
    }
    if (!(await User.exists({ _id: target }))) {
      return res.status(404).json({ msg: "User not found" });
    }
    await Report.create({
      reporter: req.user.id,
      reported: target,
      reason,
      details: details ? String(details).slice(0, 1000) : undefined,
      match: mongoose.isValidObjectId(matchId) ? matchId : undefined,
    });
    await blockUser(req.user.id, target);
    await endMatch(req.user.id, target, "report");
    return res.status(201).json({ msg: "Reported — thanks for keeping DistraXion real" });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
