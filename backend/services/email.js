// Sends the signup verification code. Uses Resend's free tier when
// RESEND_API_KEY is set; otherwise prints the code to the server log
// so local development works without an email account.
async function sendVerificationCode(to, code) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[dev] email code for ${to}: ${code}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "DistraXion <onboarding@resend.dev>",
      to,
      subject: `Your DistraXion code: ${code}`,
      text: `Your DistraXion verification code is ${code}. It expires in 15 minutes.`,
    }),
  });
  if (!res.ok) throw new Error(`Email send failed (${res.status})`);
}

module.exports = { sendVerificationCode };
