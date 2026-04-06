const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  age: { type: Number, required: true },
  city: { type: String, required: true },
  gender: { type: String, enum: ["woman", "man", "non-binary"] },
  seeking: { type: String, enum: ["women", "men", "everyone"] },
  background: [String],
  vibe: [String],
  bio: { type: String, maxlength: 300 },
  photos: [String],
  swipesUsed: { type: Number, default: 0 },
  swipeDate: { type: String, default: "" },
  tier: { type: String, enum: ["free", "plus", "global"], default: "free" },
  tierRegion: { type: String, default: "local" },
  stripeCustomerId: { type: String },
  themePreference: {
    type: String,
    enum: ["imperio", "ivory", "metallic"],
    default: "imperio",
  },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

UserSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

UserSchema.methods.checkSwipes = function () {
  const today = new Date().toISOString().split("T")[0];
  if (this.swipeDate !== today) {
    this.swipesUsed = 0;
    this.swipeDate = today;
  }
  const limit = this.tier === "free" ? 10 : Infinity;
  return {
    used: this.swipesUsed,
    limit,
    remaining: Math.max(0, limit - this.swipesUsed),
  };
};

module.exports = mongoose.model("User", UserSchema);
