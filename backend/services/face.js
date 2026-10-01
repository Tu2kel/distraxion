// Free, self-hosted face engine (@vladmandic/human on tfjs-node).
// Used for: selfie liveness checks, face embeddings, and matching
// profile photos against the verified selfie. No per-call vendor cost.
const path = require("path");
const tf = require("@tensorflow/tfjs-node");
const Human = require("@vladmandic/human").default;

const MODEL_DIR = path.join(
  __dirname,
  "..",
  "node_modules",
  "@vladmandic",
  "human",
  "models",
);

const human = new Human({
  modelBasePath: "file://" + MODEL_DIR + "/",
  backend: "tensorflow",
  debug: false,
  face: {
    enabled: true,
    detector: { rotation: true, maxDetected: 3, minConfidence: 0.5 },
    mesh: { enabled: true },
    iris: { enabled: false },
    description: { enabled: true }, // faceres: embedding + age/gender
    emotion: { enabled: true }, // used for the "smile" challenge
    antispoof: { enabled: true }, // photo-of-a-photo / screen replay
    liveness: { enabled: true },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  gesture: { enabled: true },
  segmentation: { enabled: false },
});

let ready = null;
function init() {
  if (!ready) ready = human.load().then(() => human.warmup());
  return ready;
}

// Analyze one JPEG/PNG buffer. Returns a flat summary per detected face.
async function analyze(buffer) {
  await init();
  const tensor = tf.node.decodeImage(buffer, 3);
  try {
    const res = await human.detect(tensor);
    const gestures = res.gesture || [];
    return res.face.map((f, i) => ({
      score: f.score,
      boxScore: f.boxScore,
      embedding: f.embedding ? Array.from(f.embedding) : null,
      yaw: f.rotation ? f.rotation.angle.yaw : 0, // radians, + = their left
      pitch: f.rotation ? f.rotation.angle.pitch : 0,
      real: f.real ?? null, // antispoof: 1 = real face
      live: f.live ?? null, // liveness: 1 = live
      age: f.age ?? null,
      happy: (f.emotion || []).find((e) => e.emotion === "happy")?.score || 0,
      gestures: gestures
        .filter((g) => g.face === i)
        .map((g) => g.gesture),
      size: f.box ? Math.min(f.box[2], f.box[3]) : 0,
    }));
  } finally {
    tf.dispose(tensor);
  }
}

// Similarity 0..1 between two embeddings (higher = same person)
function similarity(a, b) {
  if (!a || !b) return 0;
  return human.match.similarity(a, b);
}

module.exports = { init, analyze, similarity };
