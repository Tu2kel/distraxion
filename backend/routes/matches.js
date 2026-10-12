const router = require("express").Router();
const User = require("../models/User");
const { Match, Swipe, pairKey } = require("../models/Match");
const { isBlockedEitherWay } = require("../services/relations");
const auth = require("../middleware/auth");
const verified = require("../middleware/verified");

// SWIPE ON A USER
router.post("/swipe", auth, verified, async (req, res) => {
  try {
    const { targetId, direction } = req.body;

    if (!targetId || !direction) {
      return res
        .status(400)
        .json({ msg: "targetId and direction are required" });
    }

    if (!["right", "left"].includes(direction)) {
      return res
        .status(400)
        .json({ msg: "direction must be 'right' or 'left'" });
    }

    if (targetId === req.user.id) {
      return res.status(400).json({ msg: "You cannot swipe on yourself" });
    }

    const me = req.me;
    const targetUser = await User.findById(targetId);

    if (
      !targetUser ||
      !targetUser.active ||
      !targetUser.isVerified() ||
      (await isBlockedEitherWay(me._id, targetUser._id))
    ) {
      return res.status(404).json({ msg: "Target user not found" });
    }

    // Reset/check daily swipes
    const swipeStatus = me.checkSwipes();

    if (me.tier === "free" && swipeStatus.remaining <= 0) {
      await me.save();
      return res.status(403).json({
        msg: "Daily limit reached",
        paywall: true,
      });
    }

    // One swipe per pair, enforced by the unique {from, to} index
    try {
      await Swipe.create({ from: me._id, to: targetId, direction });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(400).json({ msg: "You already swiped on this user" });
      }
      throw e;
    }

    me.swipesUsed += 1;
    await me.save();

    let matched = false;
    let matchRecord = null;

    // If I swipe right, check whether they already swiped right on me
    if (direction === "right") {
      const theyLikedMe = await Swipe.findOne({
        from: targetId,
        to: me._id,
        direction: "right",
      });

      if (theyLikedMe) {
        // Upsert on the pair key: simultaneous mutual swipes resolve to one match
        const pair = pairKey(me._id, targetId);
        try {
          matchRecord = await Match.findOneAndUpdate(
            { pair },
            { $setOnInsert: { users: [me._id, targetUser._id], pair } },
            { upsert: true, returnDocument: "after" },
          );
        } catch (e) {
          if (e.code !== 11000) throw e;
          matchRecord = await Match.findOne({ pair });
        }
        matched = !matchRecord.endedAt;
        if (!matched) matchRecord = null;
      }
    }

    const refreshedSwipeStatus = me.checkSwipes();

    return res.json({
      matched,
      matchId: matchRecord ? matchRecord._id : null,
      swipesRemaining: me.tier !== "free"
        ? "unlimited"
        : refreshedSwipeStatus.remaining,
    });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// GET MY MATCHES
router.get("/mine", auth, verified, async (req, res) => {
  try {
    const matches = await Match.find({
      users: req.user.id,
      endedAt: null,
    })
      .populate(
        "users",
        "name city photos age bio gender seeking background vibe",
      )
      .sort({ createdAt: -1 });

    const formatted = matches.map((match) => {
      const otherUser = match.users.find(
        (user) => user._id.toString() !== req.user.id,
      );

      return {
        matchId: match._id,
        user: otherUser || null,
        createdAt: match.createdAt,
      };
    });

    return res.json(formatted);
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// UNMATCH — ends the match for both people; messages are kept for moderation
router.post("/:matchId/unmatch", auth, verified, async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.me._id,
      endedAt: null,
    });
    if (!match) return res.status(404).json({ msg: "Match not found" });
    match.endedAt = new Date();
    match.endedBy = req.me._id;
    match.endReason = "unmatch";
    await match.save();
    return res.json({ msg: "Unmatched" });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
