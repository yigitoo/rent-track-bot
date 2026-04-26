const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendMail(subject, text) {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_TO,
    subject,
    text,
  });
}

async function sendHtmlMail(subject, html) {
  await transporter.sendMail({
    from: `"Kira Takip" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_TO,
    subject,
    html,
  });
}

module.exports = { sendMail, sendHtmlMail };
