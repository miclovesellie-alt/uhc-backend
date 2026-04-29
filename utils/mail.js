const sgMail = require("@sendgrid/mail");
require("dotenv").config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Sends an email using SendGrid.
 * @param {Object} options - { to, subject, html, text }
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const from = process.env.EMAIL_FROM || "unihealthplatform@gmail.com";
  
  if (!process.env.SENDGRID_API_KEY) {
    console.error("❌ ERROR: SENDGRID_API_KEY is missing in environment variables.");
    console.log("-----------------------------------------");
    console.log(`SUBJECT: ${subject}`);
    console.log(`TO: ${to}`);
    console.log(`CONTENT (HTML): ${html.substring(0, 100)}...`);
    console.log("-----------------------------------------");
    return { success: false, error: "Missing API Key" };
  }

  const msg = {
    to,
    from,
    subject,
    html,
    text: text || "This is a password reset email.",
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Email sent successfully to ${to}`);
    return { success: true };
  } catch (error) {
    console.error("❌ SendGrid Email Error:");
    if (error.response) {
      console.error(JSON.stringify(error.response.body, null, 2));
    } else {
      console.error(error.message);
    }
    
    // Log the fallback URL to console if it's a reset email
    if (html.includes("reset-password")) {
      console.log("-----------------------------------------");
      console.log("FALLBACK RESET URL:", html.match(/href="([^"]*)"/)?.[1]);
      console.log("-----------------------------------------");
    }
    
    return { success: false, error: error.message };
  }
};

module.exports = { sendEmail };
