const { query } = require('./pool');

async function getUser(id, client) {
  const result = await query(
    'SELECT id, username, rud_balance FROM users WHERE id = $1',
    [id],
    client
  );
  return result.rows[0];
}

async function getUserByUsername(username, client) {
  const result = await query(
    'SELECT id, username, rud_balance, password_hash FROM users WHERE username = $1',
    [username],
    client
  );
  return result.rows[0];
}

async function findUserForRegister(username, client, { forUpdate = false } = {}) {
  const lock = forUpdate ? ' FOR UPDATE' : '';
  const result = await query(
    `SELECT id, username, password_hash FROM users WHERE username = $1${lock}`,
    [username],
    client
  );
  return result.rows[0];
}

async function insertUser(username, passwordHash, client) {
  const result = await query(
    'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
    [username, passwordHash],
    client
  );
  return result.rows[0].id;
}

async function updateUserPassword(id, passwordHash, client) {
  await query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [passwordHash, id],
    client
  );
}

async function debitBalance(userId, amount, client) {
  const result = await query(
    'UPDATE users SET rud_balance = rud_balance - $1 WHERE id = $2 AND rud_balance >= $1 RETURNING rud_balance',
    [amount, userId],
    client
  );
  return result.rows[0]?.rud_balance ?? null;
}

async function creditBalance(userId, amount, client) {
  const result = await query(
    'UPDATE users SET rud_balance = rud_balance + $1 WHERE id = $2 RETURNING rud_balance',
    [amount, userId],
    client
  );
  return result.rows[0].rud_balance;
}

async function getEquippedSkinField(userId, client) {
  const result = await query(
    'SELECT equipped_skin FROM users WHERE id = $1',
    [userId],
    client
  );
  return result.rows[0]?.equipped_skin;
}

async function setEquippedSkin(userId, skinId, client) {
  await query(
    'UPDATE users SET equipped_skin = $1 WHERE id = $2',
    [skinId, userId],
    client
  );
}

async function upsertSecretEligibleAccount(username, passwordHash, verifyFn, client) {
  const existing = await findUserForRegister(username, client);
  if (!existing) {
    await query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      [username, passwordHash],
      client
    );
    console.log(`[auth] created secret-eligible account "${username}"`);
    return;
  }
  if (!existing.password_hash || !verifyFn(existing.password_hash)) {
    await updateUserPassword(existing.id, passwordHash, client);
    console.log(`[auth] synced password for secret-eligible account "${username}"`);
  }
}

module.exports = {
  getUser,
  getUserByUsername,
  findUserForRegister,
  insertUser,
  updateUserPassword,
  debitBalance,
  creditBalance,
  getEquippedSkinField,
  setEquippedSkin,
  upsertSecretEligibleAccount,
};
