const crypto = require('crypto');

const SESSION_DAYS = 30;

function validateUsername(username) {
  if (!username || username.length < 2 || username.length > 20) {
    return 'Username must be 2–20 characters.';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'Username may only use letters, numbers, _ and -.';
  }
  return null;
}

function validatePassword(password) {
  if (!password || password.length < 4 || password.length > 64) {
    return 'Password must be 4–64 characters.';
  }
  return null;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const hashBuffer = crypto.scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(hash, 'hex');
  if (hashBuffer.length !== storedBuffer.length) return false;
  return crypto.timingSafeEqual(hashBuffer, storedBuffer);
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function sessionExpiresAt() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function getTokenFromReq(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return String(req.body?.token || req.query?.token || '').trim() || null;
}

module.exports = {
  SESSION_DAYS,
  validateUsername,
  validatePassword,
  hashPassword,
  verifyPassword,
  createSessionToken,
  sessionExpiresAt,
  getTokenFromReq,
};
