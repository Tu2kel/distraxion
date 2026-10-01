// AI-generated image check for profile photos via Sightengine's "genai"
// model (free tier covers early volume). Returns 0..1, or null when no
// keys are configured — the selfie face-match still applies either way.
async function aiGeneratedScore(buffer) {
  const user = process.env.SIGHTENGINE_USER;
  const secret = process.env.SIGHTENGINE_SECRET;
  if (!user || !secret) return null;

  const form = new FormData();
  form.append("media", new Blob([buffer], { type: "image/jpeg" }), "p.jpg");
  form.append("models", "genai");
  form.append("api_user", user);
  form.append("api_secret", secret);

  const res = await fetch("https://api.sightengine.com/1.0/check.json", {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (data.status !== "success") {
    console.error("Sightengine error:", data.error?.message);
    return null;
  }
  return data.type?.ai_generated ?? null;
}

module.exports = { aiGeneratedScore };
