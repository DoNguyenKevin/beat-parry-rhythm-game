const { query } = require('./pool');
const { createSessionToken, sessionExpiresAt } = require('../lib/auth');

async function createSession(userId, client) {
  const token = createSessionToken();
  const expiresAt = sessionExpiresAt();
  await query(
    'INSERT INTO user_sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
    [token, userId, expiresAt],
    client
  );
  return { token, expiresAt };
}

async function getSessionUser(token, client) {
  if (!token) return null;
  const result = await query(
    `SELECT s.user_id, s.expires_at, u.id, u.username, u.rud_balance
     FROM user_sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1`,
    [token],
    client
  );
  const row = result.rows[0];
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    await query('DELETE FROM user_sessions WHERE token = $1', [token], client);
    return null;
  }
  return {
    ...row,
    user_id: Number(row.user_id),
    id: Number(row.id),
    rud_balance: Number(row.rud_balance),
  };
}

async function deleteSession(token, client) {
  if (!token) return;
  await query('DELETE FROM user_sessions WHERE token = $1', [token], client);
}

module.exports = {
  createSession,
  getSessionUser,
  deleteSession,
};
