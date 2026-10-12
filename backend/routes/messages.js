const router = require("express").Router();
const Message = require("../models/Message");
const { Match } = require("../models/Match");
const auth = require("../middleware/auth");
const verified = require("../middleware/verified");
const mongoose = require("mongoose");

// The caller's live match, or null. Ended matches (unmatch / block /
// report) are closed to both people.
function findOpenMatch(matchId, userId) {
  if (!mongoose.isValidObjectId(matchId)) return null;
  return Match.findOne({ _id: matchId, users: userId, endedAt: null });
}

// SEND MESSAGE TO A MATCH
router.post("/:matchId", auth, verified, async (req, res) => {
  try {
    const { text } = req.body;
    const { matchId } = req.params;

    if (!text || !String(text).trim()) {
      return res.status(400).json({ msg: "Message text is required" });
    }

    const match = await findOpenMatch(matchId, req.me._id);

    if (!match) {
      return res.status(404).json({ msg: "Match not found" });
    }

    const message = await Message.create({
      match: matchId,
      sender: req.user.id,
      text: String(text).trim(),
    });

    const populatedMessage = await Message.findById(message._id).populate(
      "sender",
      "name photos city",
    );

    return res.status(201).json(populatedMessage);
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// GET ALL MESSAGES FOR A MATCH
router.get("/:matchId", auth, verified, async (req, res) => {
  try {
    const { matchId } = req.params;

    const match = await findOpenMatch(matchId, req.me._id);

    if (!match) {
      return res.status(404).json({ msg: "Match not found" });
    }

    const messages = await Message.find({ match: matchId })
      .populate("sender", "name photos city")
      .sort({ createdAt: 1 });

    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
