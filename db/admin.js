const { query } = require('./pool');

const DEFAULT_ADMIN_CONFIG = {
  wheelLuckMult: 1,
  speedPlay: 1,
  speedTraining: 1,
  speedDodge: 1,
  speedBoss: 1,
  rudMultGlobal: 1,
  wheelSpinCost: 150,
  freeSpinHours: 24,
  trainingLevelInterval: 9,
  dodgeLevelInterval: 4,
  maintenanceMode: false,
  announcement: '',
};

async function getAdminConfig(client) {
  const result = await query(
    'SELECT value FROM admin_config WHERE key = $1',
    ['settings'],
    client
  );
  if (!result.rows[0]) return { ...DEFAULT_ADMIN_CONFIG };
  try {
    return { ...DEFAULT_ADMIN_CONFIG, ...JSON.parse(result.rows[0].value) };
  } catch {
    return { ...DEFAULT_ADMIN_CONFIG };
  }
}

async function setAdminConfig(partial, client) {
  const next = { ...(await getAdminConfig(client)), ...partial };
  await query(
    `INSERT INTO admin_config (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    ['settings', JSON.stringify(next)],
    client
  );
  return next;
}

async function isAdminUserId(userId, client) {
  const result = await query(
    'SELECT is_admin FROM users WHERE id = $1',
    [userId],
    client
  );
  return !!result.rows[0]?.is_admin;
}

async function usernameTaken(username, client) {
  const result = await query(
    'SELECT 1 FROM users WHERE username = $1',
    [String(username || '').trim()],
    client
  );
  return result.rowCount > 0;
}

async function getWheelUserRow(userId, client) {
  const result = await query(
    'SELECT id, rud_balance, last_free_spin_at, wheel_bonus_spins FROM users WHERE id = $1',
    [userId],
    client
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: Number(row.id),
    rud_balance: Number(row.rud_balance),
    last_free_spin_at: row.last_free_spin_at,
    wheel_bonus_spins: Number(row.wheel_bonus_spins || 0),
  };
}

async function decrementBonusSpin(userId, client) {
  await query(
    'UPDATE users SET wheel_bonus_spins = wheel_bonus_spins - 1 WHERE id = $1 AND wheel_bonus_spins > 0',
    [userId],
    client
  );
}

async function setLastFreeSpinNow(userId, client) {
  await query(
    'UPDATE users SET last_free_spin_at = NOW() WHERE id = $1',
    [userId],
    client
  );
}

async function addBonusSpins(userId, count, client) {
  await query(
    'UPDATE users SET wheel_bonus_spins = wheel_bonus_spins + $1 WHERE id = $2',
    [count, userId],
    client
  );
}

async function resetFreeSpin(userId, client) {
  await query(
    'UPDATE users SET last_free_spin_at = NULL WHERE id = $1',
    [userId],
    client
  );
}

async function seedAdminAccounts(usernames, client) {
  for (const username of usernames) {
    await query(
      'UPDATE users SET is_admin = TRUE WHERE username = $1',
      [username],
      client
    );
  }
}

async function getAdminStats(client) {
  const users = await query('SELECT COUNT(*)::int AS count FROM users', [], client);
  const totalRud = await query(
    'SELECT COALESCE(SUM(rud_balance), 0)::int AS sum FROM users',
    [],
    client
  );
  const spins = await query(
    'SELECT COALESCE(SUM(wheel_bonus_spins), 0)::int AS sum FROM users',
    [],
    client
  );
  return {
    users: users.rows[0].count,
    totalRud: totalRud.rows[0].sum,
    pendingBonusSpins: spins.rows[0].sum,
  };
}

async function searchUsers(q, client) {
  const sql = q
    ? `SELECT id, username, rud_balance, wheel_bonus_spins, last_free_spin_at, created_at, is_admin
       FROM users WHERE username ILIKE $1 ORDER BY id DESC LIMIT 40`
    : `SELECT id, username, rud_balance, wheel_bonus_spins, last_free_spin_at, created_at, is_admin
       FROM users ORDER BY id DESC LIMIT 40`;
  const params = q ? [`%${q}%`] : [];
  const result = await query(sql, params, client);
  return result.rows.map((u) => ({
    ...u,
    id: Number(u.id),
    rud_balance: Number(u.rud_balance),
    wheel_bonus_spins: Number(u.wheel_bonus_spins || 0),
    is_admin: !!u.is_admin,
  }));
}

async function listAdmins(client) {
  const result = await query(
    `SELECT id, username, rud_balance, created_at
     FROM users WHERE is_admin = TRUE ORDER BY username ASC`,
    [],
    client
  );
  return result.rows.map((u) => ({
    ...u,
    id: Number(u.id),
    rud_balance: Number(u.rud_balance),
  }));
}

async function getUserAdminRow(userId, client) {
  const result = await query(
    'SELECT id, username, is_admin FROM users WHERE id = $1',
    [userId],
    client
  );
  const row = result.rows[0];
  if (!row) return undefined;
  return {
    id: Number(row.id),
    username: row.username,
    is_admin: !!row.is_admin,
  };
}

async function countAdmins(client) {
  const result = await query(
    'SELECT COUNT(*)::int AS c FROM users WHERE is_admin = TRUE',
    [],
    client
  );
  return result.rows[0].c;
}

async function setUserAdmin(userId, grant, client) {
  await query(
    'UPDATE users SET is_admin = $1 WHERE id = $2',
    [grant, userId],
    client
  );
}

async function setUserBalance(userId, balance, client) {
  await query(
    'UPDATE users SET rud_balance = $1 WHERE id = $2',
    [balance, userId],
    client
  );
}

async function adjustUserBalance(userId, amount, client) {
  await query(
    'UPDATE users SET rud_balance = rud_balance + $1 WHERE id = $2',
    [amount, userId],
    client
  );
  await query(
    'UPDATE users SET rud_balance = 0 WHERE id = $1 AND rud_balance < 0',
    [userId],
    client
  );
}

module.exports = {
  DEFAULT_ADMIN_CONFIG,
  getAdminConfig,
  setAdminConfig,
  isAdminUserId,
  usernameTaken,
  getWheelUserRow,
  decrementBonusSpin,
  setLastFreeSpinNow,
  addBonusSpins,
  resetFreeSpin,
  seedAdminAccounts,
  getAdminStats,
  searchUsers,
  listAdmins,
  getUserAdminRow,
  countAdmins,
  setUserAdmin,
  setUserBalance,
  adjustUserBalance,
};
