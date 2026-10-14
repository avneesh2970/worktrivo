const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { google } = require('googleapis');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in backend/.env');
  process.exit(1);
}

const parsedRedirect = new URL(REDIRECT_URI);
const PORT = parseInt(parsedRedirect.port, 10) || 3000;
const CALLBACK_PATH = parsedRedirect.pathname || '/oauth2callback';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Generate Google Auth URL with offline access and prompt=consent to ensure refresh token is returned
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: [
    'https://mail.google.com/',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
});

console.log('\n================================================================');
console.log('       WorkTrivo Gmail OAuth2 Refresh Token Generator          ');
console.log('================================================================\n');
console.log('1. Click or copy the following URL and open it in your browser:\n');
console.log(authUrl);
console.log('\n----------------------------------------------------------------');
console.log(`2. Waiting for authorization callback on: http://localhost:${PORT}${CALLBACK_PATH}`);
console.log('   (Sign in with your worktrivo@gmail.com Google account and grant access)\n');

// Start temporary local server to capture the authorization code
const server = http.createServer(async (req, res) => {
  const reqUrl = url.parse(req.url, true);

  if (reqUrl.pathname === CALLBACK_PATH) {
    const code = reqUrl.query.code;
    const error = reqUrl.query.error;

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`
        <div style="font-family:sans-serif;max-width:600px;margin:50px auto;padding:30px;background:#fef2f2;border:1px solid #fecaca;border-radius:16px;">
          <h2 style="color:#dc2626;">❌ Authorization Denied</h2>
          <p style="color:#7f1d1d;">Error: ${error}</p>
        </div>
      `);
      console.error(`❌ Authorization was rejected: ${error}`);
      return;
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>No code provided</h1>');
      return;
    }

    try {
      console.log('⏳ Received authorization code. Exchanging for tokens...');
      const { tokens } = await oauth2Client.getToken(code);
      const refreshToken = tokens.refresh_token;

      if (!refreshToken) {
        console.warn('⚠️ No refresh_token returned by Google.');
        console.warn('Reason: You may have already authorized without prompt=consent, or access_type was not offline.');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <div style="font-family:sans-serif;max-width:600px;margin:50px auto;padding:30px;background:#fffbeb;border:1px solid #fde68a;border-radius:16px;">
            <h2 style="color:#d97706;">⚠️ Access Token Received, but No Refresh Token</h2>
            <p style="color:#78350f;">Google only sends a refresh token the first time or when prompt=consent is used. Please revoke app access at <a href="https://myaccount.google.com/permissions">Google Account Permissions</a> and re-run.</p>
          </div>
        `);
        return;
      }

      console.log('✅ REFRESH TOKEN RECEIVED SUCCESSFULLY!\n');
      console.log('Token:', refreshToken);

      // Auto-save to backend/.env
      const envPath = path.join(__dirname, '../.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
          envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/g, `GOOGLE_REFRESH_TOKEN=${refreshToken}`);
        } else {
          envContent += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
        console.log(`\n💾 Successfully saved GOOGLE_REFRESH_TOKEN to backend/.env!`);
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <div style="font-family:sans-serif;max-width:600px;margin:50px auto;padding:30px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:16px;text-align:center;">
          <h2 style="color:#059669;margin-bottom:8px;">✅ OAuth Setup Complete!</h2>
          <p style="color:#065f46;font-size:15px;line-height:1.5;">Your Google Refresh Token has been acquired and saved to <code>backend/.env</code>.<br/>You can close this tab now and return to the terminal.</p>
          <div style="background:#ffffff;padding:12px;border-radius:8px;font-family:monospace;font-size:12px;word-break:break-all;color:#334155;margin-top:16px;border:1px solid #e2e8f0;">
            ${refreshToken}
          </div>
        </div>
      `);

      setTimeout(() => {
        console.log('\n🎉 Finished! You can now test sending emails with:');
        console.log('   node src/utils/testEmail.js [target-email]\n');
        process.exit(0);
      }, 2000);

    } catch (err) {
      console.error('❌ Error exchanging code for tokens:', err.message);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<h1>Token Exchange Error</h1><p>${err.message}</p>`);
    }
  }
});

server.listen(PORT, () => {
  // ready
});
