const mongoose = require("mongoose");

const MatchSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
  },
  {
    timestamps: true,
  },
);

const SwipeSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    direction: {
      type: String,
      enum: ["right", "left"],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate swipes from same user to same target
SwipeSchema.index({ from: 1, to: 1 }, { unique: true });

const Match = mongoose.model("Match", MatchSchema);
const Swipe = mongoose.model("Swipe", SwipeSchema);

module.exports = { Match, Swipe };
