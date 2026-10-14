// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//     host: 'smtp-relay.brevo.com',
//     port: 587,
//     secure: false,
//     pool: true,
//     maxConnections: 5,
//     maxMessages: 100,
//     connectionTimeout: 5000,
//     socketTimeout: 8000,
//     auth: {
//         user: process.env.SMTP_USER,
//         pass: process.env.SMTP_PASS
//     }
// });

// module.exports = transporter;


const nodemailer = require('nodemailer');

const TIMEOUT_CONFIG = {
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 12000,
  family: 4, // Force IPv4 to prevent ENETUNREACH on cloud containers
};

const createTransporter = () => {
  // 1. Gmail OAuth2 (if GOOGLE_REFRESH_TOKEN is configured)
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      ...TIMEOUT_CONFIG,
      auth: {
        type: 'OAuth2',
        user: process.env.SENDER_EMAIL || process.env.SMTP_USER,
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
      },
    });
  }

  // 2. Custom SMTP Relay (e.g. Brevo, SendGrid, Mailgun)
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      ...TIMEOUT_CONFIG,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // 3. Gmail App Password (recommended and simplest for Gmail)
  if (
    process.env.SMTP_PASS &&
    !process.env.SMTP_PASS.includes('Your SMTP')
  ) {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      ...TIMEOUT_CONFIG,
      auth: {
        user: process.env.SENDER_EMAIL || process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // 4. Default / Fallback OAuth2 configuration
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    ...TIMEOUT_CONFIG,
    auth: {
      type: 'OAuth2',
      user: process.env.SENDER_EMAIL,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    },
  });
};

const transporter = {
  sendMail: (...args) => createTransporter().sendMail(...args),
  verify: (...args) => createTransporter().verify(...args),
};

module.exports = transporter;
