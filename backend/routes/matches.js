const router = require("express").Router();
const User = require("../models/User");
const { Match, Swipe } = require("../models/Match");
const auth = require("../middleware/auth");

// SWIPE ON A USER
router.post("/swipe", auth, async (req, res) => {
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

    const me = await User.findById(req.user.id);
    const targetUser = await User.findById(targetId);

    if (!me) {
      return res.status(404).json({ msg: "Current user not found" });
    }

    if (!targetUser || !targetUser.active) {
      return res.status(404).json({ msg: "Target user not found" });
    }

    // Reset/check daily swipes
    const swipeStatus = me.checkSwipes();

    if (!me.isPremium && swipeStatus.remaining <= 0) {
      await me.save();
      return res.status(403).json({
        msg: "Daily limit reached",
        paywall: true,
      });
    }

    // Prevent duplicate swipe records from same user to same target
    const existingSwipe = await Swipe.findOne({
      from: me._id,
      to: targetId,
    });

    if (existingSwipe) {
      return res.status(400).json({ msg: "You already swiped on this user" });
    }

    // Save the swipe
    await Swipe.create({
      from: me._id,
      to: targetId,
      direction,
    });

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
        const existingMatch = await Match.findOne({
          users: { $all: [me._id, targetId] },
        });

        if (existingMatch) {
          matched = true;
          matchRecord = existingMatch;
        } else {
          matchRecord = await Match.create({
            users: [me._id, targetId],
          });
          matched = true;
        }
      }
    }

    const refreshedSwipeStatus = me.checkSwipes();

    return res.json({
      matched,
      matchId: matchRecord ? matchRecord._id : null,
      swipesRemaining: me.isPremium
        ? "unlimited"
        : refreshedSwipeStatus.remaining,
    });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// GET MY MATCHES
router.get("/mine", auth, async (req, res) => {
  try {
    const matches = await Match.find({
      users: req.user.id,
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

module.exports = router;
