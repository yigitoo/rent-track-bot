require('dotenv').config();

const {
  SESSION_DAYS,
  checkPassword,
  clearedCookie,
  createSession,
  getRequestToken,
  sessionCookie,
  verifySession,
} = require('../utils/webAuth');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const session = verifySession(getRequestToken(req));
    return res.status(session ? 200 : 401).json(
      session
        ? { valid: true, expiresAt: new Date(session.exp).toISOString() }
        : { valid: false }
    );
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearedCookie());
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const password = String(req.body?.password || '').trim();
  if (!password) {
    return res.status(400).json({ error: 'Şifre gerekli.' });
  }
  if (!checkPassword(password)) {
    return res.status(401).json({ error: 'Şifre hatalı.' });
  }

  const { token, expiresAt } = createSession(SESSION_DAYS);
  res.setHeader('Set-Cookie', sessionCookie(token, expiresAt));
  return res.status(200).json({
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    days: SESSION_DAYS,
  });
};
