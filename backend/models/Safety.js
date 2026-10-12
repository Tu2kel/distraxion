const mongoose = require("mongoose");

// A block hides two people from each other everywhere: feed, profile,
// swipes, matches and messages. Either direction counts.
const BlockSchema = new mongoose.Schema(
  {
    blocker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    blocked: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
BlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
BlockSchema.index({ blocked: 1 });

const REPORT_REASONS = [
  "fake_profile",
  "scam_or_money",
  "harassment",
  "underage",
  "explicit_content",
  "off_platform_push",
  "other",
];

// Reports are kept even after the reporter deletes their account
// (reporter is cleared), so moderation history survives.
const ReportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reported: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    details: { type: String, maxlength: 1000 },
    match: { type: mongoose.Schema.Types.ObjectId, ref: "Match" },
    status: {
      type: String,
      enum: ["open", "reviewed", "actioned"],
      default: "open",
    },
  },
  { timestamps: true },
);
ReportSchema.index({ reported: 1, status: 1 });

module.exports = {
  Block: mongoose.model("Block", BlockSchema),
  Report: mongoose.model("Report", ReportSchema),
  REPORT_REASONS,
};
