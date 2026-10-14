// const transporter = require('./nodemailer');

// const sendEmail = async (to, subject, html) => {
//   if (!to || !to.includes('@')) {
//     console.warn(`[sendEmail] Skipping invalid email recipient: ${to}`);
//     return;
//   }

//   try {
//     const info = await transporter.sendMail({
//       from: process.env.SENDER_EMAIL || 'noreply@worktrivo.com',
//       to,
//       subject,
//       html,
//     });
//     console.log(`✅ [Email Sent] to: ${to}, subject: "${subject}" (messageId: ${info?.messageId || 'ok'})`);
//     return info;
//   } catch (err) {
//     console.error(`❌ [Email Error] to: ${to}, subject: "${subject}":`, err.message);
//   }
// };

// /**
//  * Non-blocking fire-and-forget background email sender.
//  * Executes on setImmediate so it never blocks the HTTP response cycle.
//  */
// const sendEmailAsync = (to, subject, html) => {
//   setImmediate(() => {
//     sendEmail(to, subject, html).catch((err) => {
//       console.error('[sendEmailAsync Error]:', err.message);
//     });
//   });
// };

// module.exports = sendEmail;
// module.exports.sendEmail = sendEmail;
// module.exports.sendEmailAsync = sendEmailAsync;

const { google } = require('googleapis');
const transporter = require('./nodemailer');

/**
 * Sends an email using Google's official Gmail REST API over HTTPS (Port 443).
 * This completely avoids cloud provider SMTP port blocking and IPv6 ENETUNREACH errors.
 */
const sendEmailViaGmailApi = async (to, subject, html) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

  const sender = process.env.SENDER_EMAIL || 'worktrivo@gmail.com';
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    `From: "WorkTrivo" <${sender}>`,
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    html,
  ];
  const message = messageParts.join('\r\n');
  const encodedMessage = Buffer.from(message).toString('base64url');

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  return { messageId: res.data.id };
};

const sendEmail = async (to, subject, html) => {
  if (!to || !to.includes('@')) {
    console.warn(`[sendEmail] Skipping invalid email recipient: ${to}`);
    return;
  }

  // 1. If GOOGLE_REFRESH_TOKEN is set, use Gmail REST API over HTTPS (Port 443)
  // This is immune to cloud container IPv6 ENETUNREACH and SMTP port blocks!
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    try {
      const info = await sendEmailViaGmailApi(to, subject, html);
      console.log(
        `✅ [Email Sent via Gmail REST API] to: ${to}, subject: "${subject}" (id: ${info.messageId})`
      );
      return info;
    } catch (apiErr) {
      console.warn(`[Gmail API Warning] Failed via HTTPS (${apiErr.message}), falling back to SMTP...`);
    }
  }

  // 2. Standard SMTP fallback via Nodemailer
  try {
    const sender = process.env.SENDER_EMAIL || 'worktrivo@gmail.com';
    const info = await transporter.sendMail({
      from: `"WorkTrivo" <${sender}>`,
      to,
      subject,
      html,
    });

    console.log(
      `✅ [Email Sent via SMTP] to: ${to}, subject: "${subject}" (messageId: ${info?.messageId || 'ok'})`
    );

    return info;
  } catch (err) {
    console.error(
      `❌ [Email Error] to: ${to}, subject: "${subject}":`,
      err.message
    );
    throw err;
  }
};

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
