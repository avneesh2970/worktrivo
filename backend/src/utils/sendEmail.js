const transporter = require('./nodemailer');

const sendEmail = async (to, subject, html) => {
  if (!to || !to.includes('@')) {
    console.warn(`[sendEmail] Skipping invalid email recipient: ${to}`);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SENDER_EMAIL || 'noreply@worktrivo.com',
      to,
      subject,
      html,
    });
    console.log(`✅ [Email Sent] to: ${to}, subject: "${subject}" (messageId: ${info?.messageId || 'ok'})`);
    return info;
  } catch (err) {
    console.error(`❌ [Email Error] to: ${to}, subject: "${subject}":`, err.message);
  }
};

/**
 * Non-blocking fire-and-forget background email sender.
 * Executes on setImmediate so it never blocks the HTTP response cycle.
 */
const sendEmailAsync = (to, subject, html) => {
  setImmediate(() => {
    sendEmail(to, subject, html).catch((err) => {
      console.error('[sendEmailAsync Error]:', err.message);
    });
  });
};

module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
module.exports.sendEmailAsync = sendEmailAsync;