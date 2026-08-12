const transporter = require('./nodemailer');

const sendEmail = async (to, subject, html) => {
  try {
    console.log("========== EMAIL DEBUG ==========");
    console.log("To:", to);
    console.log("Subject:", subject);

    const info = await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent successfully");
    console.log(info);

  } catch (err) {
    console.error("❌ Email Error:");
    console.error(err);
  }
};

module.exports = sendEmail;