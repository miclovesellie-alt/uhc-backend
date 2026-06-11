const { Resend } = require("resend");

const FROM = "UHC Academy <noreply@uhcacadamy.com>";

/**
 * Sends an email using Resend.
 * Lazy-initialises the Resend client so a missing RESEND_API_KEY in .env
 * does NOT crash the server at startup — it simply skips sending.
 * @param {Object} options - { to, subject, html, text }
 */
const sendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️  RESEND_API_KEY missing – email not sent");
    console.log(`TO: ${to}  |  SUBJECT: ${subject}`);
    return { success: false };
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const data = await resend.emails.send({ from: FROM, to, subject, html, text });
    console.log(`✅ Email sent to ${to} — id: ${data.id}`);
    return { success: true, id: data.id };
  } catch (err) {
    console.error("❌ Resend error:", err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendEmail };
