const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = "UHC Academy <noreply@uhcacadamy.com>";

/**
 * Sends an email using Resend.
 * Drop-in replacement for the old SendGrid sendEmail function.
 * @param {Object} options - { to, subject, html, text }
 */
const sendEmail = async ({ to, subject, html, text }) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️  RESEND_API_KEY missing – email not sent");
    console.log(`TO: ${to}  |  SUBJECT: ${subject}`);
    return { success: false };
  }
  try {
    const data = await resend.emails.send({ from: FROM, to, subject, html, text });
    console.log(`✅ Email sent to ${to} — id: ${data.id}`);
    return { success: true, id: data.id };
  } catch (err) {
    console.error("❌ Resend error:", err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendEmail };
