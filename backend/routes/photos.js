const router = require("express").Router();
const multer = require("multer");
const sharp = require("sharp");
const rateLimit = require("express-rate-limit");
const User = require("../models/User");
const Photo = require("../models/Photo");
const auth = require("../middleware/auth");
const face = require("../services/face");
const { aiGeneratedScore } = require("../services/aiDetect");
const { SAME_PERSON } = require("./verify");

const MAX_PHOTOS = 6;
const AI_REJECT = 0.7; // Sightengine ai_generated score

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    cb(null, /^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)),
});

const limiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30 });

// POST /api/photos  (multipart, field "photo")
// The photo must contain the face that passed the live selfie.
router.post("/", auth, limiter, upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "Image file required" });

    const user = await User.findById(req.user.id).select(
      "+verification.embedding",
    );
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (user.verification?.status !== "verified") {
      return res
        .status(403)
        .json({ msg: "Complete the live selfie before adding photos" });
    }
    if (user.photos.length >= MAX_PHOTOS) {
      return res.status(400).json({ msg: `Max ${MAX_PHOTOS} photos` });
    }

    // Normalize: auto-rotate, strip EXIF/GPS, cap size, JPEG
    const jpeg = await sharp(req.file.buffer)
      .rotate()
      .resize(1080, 1350, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    const faces = await face.analyze(jpeg);
    const best = Math.max(
      0,
      ...faces.map((f) =>
        face.similarity(user.verification.embedding, f.embedding),
      ),
    );
    if (best < SAME_PERSON) {
      return res.status(400).json({
        msg:
          faces.length === 0
            ? "We need to see your face in this photo"
            : "This photo doesn't match your verified selfie",
      });
    }

    const aiScore = await aiGeneratedScore(jpeg);
    if (aiScore !== null && aiScore >= AI_REJECT) {
      return res
        .status(400)
        .json({ msg: "This looks AI-generated or heavily edited" });
    }

    const photo = await Photo.create({
      owner: user._id,
      kind: "profile",
      data: jpeg,
      faceMatch: best,
      aiScore,
    });
    const url = `/api/photos/${photo._id}`;
    user.photos.push(url);
    await user.save();

    return res.status(201).json({ url, photos: user.photos });
  } catch (err) {
    console.error("Photo upload error:", err.message);
    return res.status(500).json({ msg: "Upload failed" });
  }
});

// DELETE /api/photos/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const photo = await Photo.findOne({
      _id: req.params.id,
      owner: req.user.id,
      kind: "profile",
    });
    if (!photo) return res.status(404).json({ msg: "Photo not found" });
    await photo.deleteOne();
    const user = await User.findById(req.user.id);
    user.photos = user.photos.filter((u) => u !== `/api/photos/${photo._id}`);
    await user.save();
    return res.json({ photos: user.photos });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

// GET /api/photos/:id — public profile photos only (selfies stay private).
// Unauthenticated so <img src> works; these photos are public on profiles.
router.get("/:id", async (req, res) => {
  try {
    const photo = await Photo.findOne({
      _id: req.params.id,
      kind: "profile",
    }).select("+data");
    if (!photo) return res.status(404).end();
    res.set("Content-Type", photo.mime);
    res.set("Cache-Control", "public, max-age=86400");
    return res.send(photo.data);
  } catch (err) {
    return res.status(404).end();
  }
});

module.exports = router;
