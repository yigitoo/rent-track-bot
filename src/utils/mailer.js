const nodemailer = require('nodemailer');
const { getSettings } = require('../services/settings');

let transporter;

/* Taşıyıcı hazır mı. Alıcı listesi ayrı bir sorudur: hedefler artık
   ayarlardan gelir, ortam değişkeni yalnızca varsayılanı verir. */
function isMailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
}

async function resolveRecipients(recipients) {
  if (Array.isArray(recipients) && recipients.length) return recipients.filter(Boolean);
  if (typeof recipients === 'string' && recipients.trim()) return [recipients.trim()];
  const settings = await getSettings();
  return settings.emailRecipients;
}

async function deliver({ subject, text, html, recipients }) {
  const mailer = getTransporter();
  if (!mailer) return { sent: false, reason: 'not_configured' };

  const to = await resolveRecipients(recipients);
  if (!to.length) return { sent: false, reason: 'no_recipients' };

  try {
    await mailer.sendMail({
      from: '"Vedat Gayrimenkul" <' + process.env.EMAIL_USER + '>',
      to: to.join(', '),
      subject,
      ...(html ? { html } : { text }),
    });
    return { sent: true, recipients: to };
  } catch (error) {
    console.error('E-posta gönderilemedi:', error);
    return { sent: false, reason: 'email_error', error: error.message, recipients: to };
  }
}

function sendMail(subject, text, recipients) {
  return deliver({ subject, text, recipients });
}

function sendHtmlMail(subject, html, recipients) {
  return deliver({ subject, html, recipients });
}

module.exports = { isMailConfigured, sendMail, sendHtmlMail };
