@echo off
echo Installing dependencies for 2FA test...
npm install express body-parser jsonwebtoken speakeasy qrcode dotenv

echo Starting 2FA test server...
node test-2fa.js

pause
