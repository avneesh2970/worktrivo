require('dotenv').config();
const transporter = require('./nodemailer');
const sendEmail = require('./sendEmail');

async function testEmailService() {
  console.log('==============================================');
  console.log('       WorkTrivo Email Diagnostics Tool       ');
  console.log('==============================================\n');

  const sender = process.env.SENDER_EMAIL || 'Not configured';
  const smtpUser = process.env.SMTP_USER || 'Not configured';
  const hasAppPass = !!process.env.SMTP_PASS && !process.env.SMTP_PASS.includes('Your SMTP');
  const hasOAuth2 = !!process.env.GOOGLE_REFRESH_TOKEN;
  const hasSmtpHost = !!process.env.SMTP_HOST;

  console.log('Active Configuration:');
  console.log(`- SENDER_EMAIL: ${sender}`);
  console.log(`- SMTP_USER:    ${smtpUser}`);
  console.log(`- Mode:         ${hasOAuth2 ? 'Gmail OAuth2' : hasSmtpHost ? `Custom SMTP (${process.env.SMTP_HOST})` : hasAppPass ? 'Gmail App Password' : 'No credentials configured'}\n`);

  console.log('Testing SMTP / Mail Connection...');
  try {
    await transporter.verify();
    console.log('✅ Connection to mail server verified successfully!\n');

    const targetEmail = process.argv[2] || process.env.SENDER_EMAIL || process.env.ADMIN_EMAIL;
    if (targetEmail && targetEmail.includes('@')) {
      console.log(`Sending a test email to: ${targetEmail}...`);
      const info = await sendEmail(
        targetEmail,
        '🧪 WorkTrivo Email Test',
        `
        <div style="font-family: sans-serif; padding: 20px; background-color: #f8fafc; border-radius: 12px;">
          <h2 style="color: #10b981; margin-bottom: 8px;">WorkTrivo Email System is Working!</h2>
          <p style="color: #334155; font-size: 14px;">This test confirms that your WorkTrivo email dispatch service is configured properly and able to send messages.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
          <p style="font-size: 12px; color: #64748b;">Sent at: ${new Date().toISOString()}</p>
        </div>
        `
      );
      if (info) {
        console.log('🎉 Test email dispatched successfully! Please check your inbox / spam folder.');
      }
    }
  } catch (err) {
    console.error('❌ Email connection failed:');
    console.error(`   Error message: ${err.message}\n`);
    console.log('👉 Diagnostic steps to fix:');
    if (!hasAppPass && !hasOAuth2 && !hasSmtpHost) {
      console.log('   1. If using Gmail (e.g. worktrivo@gmail.com):');
      console.log('      - Generate a 16-character Google App Password (https://myaccount.google.com/apppasswords)');
      console.log('      - Set SMTP_PASS="xxxx xxxx xxxx xxxx" in backend/.env');
      console.log('   2. Or if using Brevo / SendGrid:');
      console.log('      - Set SMTP_HOST=smtp-relay.brevo.com, SMTP_PORT=587, SMTP_USER=..., SMTP_PASS=... in backend/.env');
      console.log('   3. Or if using OAuth2:');
      console.log('      - Set GOOGLE_REFRESH_TOKEN=... in backend/.env');
    } else if (err.message.includes('Username and Password not accepted') || err.message.includes('Invalid login')) {
      console.log('   - The password or username in backend/.env was rejected by Gmail/SMTP.');
      console.log('   - Ensure you are using a 16-letter App Password (not your regular Gmail login password).');
    }
  }
}

testEmailService();
