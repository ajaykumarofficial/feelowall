const nodemailer = require('nodemailer');
const config = require('../config');

let transport = null;
const getTransport = () => {
  if (!config.SMTP_URL) return null;
  if (!transport) transport = nodemailer.createTransport(config.SMTP_URL);
  return transport;
};

/** Messages sent during tests, so tests can read the links out of them. */
const testOutbox = [];

const sendMail = async ({ to, subject, text }) => {
  if (process.env.NODE_ENV === 'test') {
    testOutbox.push({ to, subject, text });
    return;
  }
  const mailer = getTransport();
  if (!mailer) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(`SMTP_URL is not set, so an email to ${to} ("${subject}") was not sent.`);
    } else {
      // Development convenience. Never logged in production, because these contain login-equivalent links.
      console.log(`[dev email] To: ${to}\nSubject: ${subject}\n${text}`);
    }
    return;
  }
  await mailer.sendMail({ from: config.MAIL_FROM, to, subject, text });
};

const sendVerificationEmail = (to, token) => sendMail({
  to,
  subject: 'Confirm your FeeloWall email',
  text: `Confirm this email address for your FeeloWall account:\n\n${config.FRONTEND_URL}/verify-email?token=${token}\n\nThe link expires in 24 hours. If you didn't request this, you can ignore this email.`
});

const sendPasswordResetEmail = (to, token) => sendMail({
  to,
  subject: 'Reset your FeeloWall password',
  text: `Reset your FeeloWall password:\n\n${config.FRONTEND_URL}/reset-password?token=${token}\n\nThe link expires in 1 hour and works once. If you didn't request this, you can ignore this email.`
});

module.exports = { sendMail, sendVerificationEmail, sendPasswordResetEmail, testOutbox };
