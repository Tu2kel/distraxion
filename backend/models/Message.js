const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema(
  {
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  },
);

// Loading a chat reads one match's messages in time order
MessageSchema.index({ match: 1, createdAt: 1 });

module.exports = mongoose.model("Message", MessageSchema);
