const mongoose = require("mongoose");

// Photos are stored in Mongo (resized JPEG) so there's no storage vendor
// to sign up for. Swap to Cloudinary/S3 later by changing routes/photos.js.
const PhotoSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    kind: { type: String, enum: ["profile", "selfie"], default: "profile" },
    data: { type: Buffer, required: true, select: false },
    mime: { type: String, default: "image/jpeg" },
    faceMatch: Number, // similarity to the owner's verified selfie
    aiScore: Number, // 0..1 chance the image is AI-generated (null = unscanned)
  },
  { timestamps: true },
);

module.exports = mongoose.model("Photo", PhotoSchema);
