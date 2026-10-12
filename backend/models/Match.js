const mongoose = require("mongoose");

// Order-independent key for a pair of users: "<smallerId>:<largerId>"
function pairKey(a, b) {
  return [String(a), String(b)].sort().join(":");
}

const MatchSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    // Unique per pair, so two simultaneous right-swipes can't make two matches
    pair: { type: String, required: true, unique: true },
    // Set on unmatch/block/report. The record and its messages are kept
    // for moderation, but neither user can see or use the match anymore.
    endedAt: Date,
    endedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    endReason: { type: String, enum: ["unmatch", "block", "report"] },
  },
  {
    timestamps: true,
  },
);

MatchSchema.pre("validate", function () {
  if (this.users?.length === 2) this.pair = pairKey(this.users[0], this.users[1]);
});

MatchSchema.index({ users: 1, endedAt: 1 });

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
SwipeSchema.index({ to: 1, direction: 1 });

const Match = mongoose.model("Match", MatchSchema);
const Swipe = mongoose.model("Swipe", SwipeSchema);

module.exports = { Match, Swipe, pairKey };
