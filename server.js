const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'beat-parry.db');

const GRADE_RUD_MULT = { S: 2, A: 1.6, B: 1.3, C: 1, D: 0.7, F: 0.4 };

const SHOP_ITEMS = {
  'wide-window': { price: 120, modes: ['play', 'training'] },
  'combo-shield': { price: 180, modes: ['play'] },
  'score-boost': { price: 200, modes: ['play'] },
  'slow-start': { price: 100, modes: ['training'] },
  'second-chance': { price: 150, modes: ['play', 'training'] },
  'rud-magnet': { price: 250, modes: ['play', 'training', 'dodge', 'boss'] },
  'ghost-phase': { price: 180, modes: ['dodge', 'boss'] },
  'long-warning': { price: 140, modes: ['dodge', 'boss'] },
  'op-overdrive': { price: 0, modes: ['play', 'training', 'dodge', 'boss'], secret: true },
  'op-void-dash': { price: 0, modes: ['play', 'training', 'dodge', 'boss'], secret: true },
};

const SECRET_CODES = {
  '0968127380': ['op-overdrive', 'op-void-dash', 'skin-void-god'],
};

const SECRET_ELIGIBLE_ACCOUNTS = {
  kevin: 'theburger',
  keios: 'khacbrother',
};

const SKINS = {
  default: { price: 0, passives: {} },
  'skin-neon': { price: 350, passives: { scoreMult: 1.08 } },
  'skin-emerald': { price: 600, passives: { windowMult: 1.12 } },
  'skin-solar': { price: 900, passives: { rudMult: 1.15 } },
  'skin-inferno': { price: 1400, passives: { scoreMult: 1.2, comboCapBonus: 10 } },
  'skin-void-god': { price: 0, secret: true, passives: { scoreMult: 1.3, rudMult: 1.3, windowMult: 1.2, comboCapBonus: 20, dodgeHealthBonus: 30 } },
};

const DEFAULT_SKIN_ID = 'default';

const OVERDRIVE_ID = 'op-overdrive';
const OVERDRIVE_BONUS_ID = 'op-void-dash';
const VOID_GOD_SKIN_ID = 'skin-void-god';

function expandSecretUnlocks(ids) {
  const set = new Set(Array.isArray(ids) ? ids : []);
  if (set.has(OVERDRIVE_ID)) set.add(OVERDRIVE_BONUS_ID);
  return [...set];
}

function isSecretEligibleUsername(username) {
  const key = String(username || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(SECRET_ELIGIBLE_ACCOUNTS, key);
}

function isSecretEligibleUserId(userId) {
  const user = getUser(userId);
  return !!(user && isSecretEligibleUsername(user.username));
}

function ensureSecretEligibleAccounts() {
  for (const [username, password] of Object.entries(SECRET_ELIGIBLE_ACCOUNTS)) {
    const existing = db.prepare(
      'SELECT id, password_hash FROM users WHERE username = ? COLLATE NOCASE'
    ).get(username);
    const passwordHash = hashPassword(password);
    if (!existing) {
      db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
        .run(username, passwordHash);
      console.log(`[auth] created secret-eligible account "${username}"`);
      continue;
    }
    if (!existing.password_hash || !verifyPassword(password, existing.password_hash)) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        .run(passwordHash, existing.id);
      console.log(`[auth] synced password for secret-eligible account "${username}"`);
    }
  }
}

function ensureOverdriveBonus(userId) {
  if (!isSecretEligibleUserId(userId)) return;
  const hasOverdrive = db.prepare(
    'SELECT 1 FROM user_redeemed_codes WHERE user_id = ? AND ability_id = ?'
  ).get(userId, OVERDRIVE_ID);
  if (!hasOverdrive) return;

  const hasBonus = db.prepare(
    'SELECT 1 FROM user_redeemed_codes WHERE user_id = ? AND ability_id = ?'
  ).get(userId, OVERDRIVE_BONUS_ID);
  if (hasBonus) return;

  db.prepare(
    'INSERT OR IGNORE INTO user_redeemed_codes (user_id, code, ability_id) VALUES (?, ?, ?)'
  ).run(userId, 'overdrive-bonus', OVERDRIVE_BONUS_ID);
}

function ensureVoidGodSkin(userId) {
  if (!isSecretEligibleUserId(userId)) return;
  if (!hasSecretUnlock(userId, OVERDRIVE_ID)) return;

  if (!hasSecretUnlock(userId, VOID_GOD_SKIN_ID)) {
    db.prepare(
      'INSERT OR IGNORE INTO user_redeemed_codes (user_id, code, ability_id) VALUES (?, ?, ?)'
    ).run(userId, 'void-god-bonus', VOID_GOD_SKIN_ID);
  }
  addOwnedSkin(userId, VOID_GOD_SKIN_ID);
}

function expandRunAbilities(abilities) {
  return Array.isArray(abilities) ? [...abilities] : [];
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    rud_balance INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS best_scores (
    user_id INTEGER NOT NULL,
    song_id TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, song_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_inventory (
    user_id INTEGER NOT NULL,
    ability_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, ability_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_redeemed_codes (
    user_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    ability_id TEXT NOT NULL,
    redeemed_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, ability_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

function migrateRedeemedCodesTable() {
  const row = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='user_redeemed_codes'"
  ).get();
  if (!row?.sql || row.sql.includes('PRIMARY KEY (user_id, ability_id)')) return;

  db.exec(`
    CREATE TABLE user_redeemed_codes_migrated (
      user_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      ability_id TEXT NOT NULL,
      redeemed_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, ability_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    INSERT OR IGNORE INTO user_redeemed_codes_migrated (user_id, code, ability_id, redeemed_at)
      SELECT user_id, code, ability_id, redeemed_at FROM user_redeemed_codes;
    DROP TABLE user_redeemed_codes;
    ALTER TABLE user_redeemed_codes_migrated RENAME TO user_redeemed_codes;
  `);
  console.log('[db] migrated user_redeemed_codes primary key to (user_id, ability_id)');
}

migrateRedeemedCodesTable();

function migrateUsersAuth() {
  const cols = db.prepare('PRAGMA table_info(users)').all();
  if (!cols.some((c) => c.name === 'password_hash')) {
    db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT');
    console.log('[db] added users.password_hash column');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
}

migrateUsersAuth();

function migrateSkins() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_owned_skins (
      user_id INTEGER NOT NULL,
      skin_id TEXT NOT NULL,
      purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, skin_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  const cols = db.prepare('PRAGMA table_info(users)').all();
  if (!cols.some((c) => c.name === 'equipped_skin')) {
    db.exec("ALTER TABLE users ADD COLUMN equipped_skin TEXT NOT NULL DEFAULT 'default'");
    console.log('[db] added users.equipped_skin column');
  }
}

migrateSkins();

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

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, userId, expiresAt);
  return { token, expiresAt };
}

function getTokenFromReq(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return String(req.body?.token || req.query?.token || '').trim() || null;
}

function getSessionUser(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT s.user_id, s.expires_at, u.id, u.username, u.rud_balance
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token);
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM user_sessions WHERE token = ?').run(token);
    return null;
  }
  return row;
}

function buildUserProfile(user) {
  const userId = user.id;
  const canRedeemSecrets = isSecretEligibleUsername(user.username);
  if (canRedeemSecrets) {
    ensureOverdriveBonus(userId);
    ensureVoidGodSkin(userId);
  }
  return {
    id: userId,
    username: user.username,
    balance: user.rud_balance,
    bestScores: getBestScores(userId),
    inventory: getInventory(userId),
    secretUnlocks: getRedeemedSecrets(userId),
    ownedSkins: getOwnedSkins(userId),
    equippedSkin: getEquippedSkin(userId),
    canRedeemSecrets,
  };
}

function requireAuth(req, res, next) {
  const token = getTokenFromReq(req);
  const session = getSessionUser(token);
  if (!session) {
    return res.status(401).json({ error: 'Not logged in. Please sign in again.' });
  }
  const routeUserId = parseInt(req.params.id, 10);
  if (routeUserId !== session.user_id) {
    return res.status(403).json({ error: 'You can only access your own account.' });
  }
  req.authUserId = session.user_id;
  req.authToken = token;
  next();
}

function getUser(id) {
  return db.prepare('SELECT id, username, rud_balance FROM users WHERE id = ?').get(id);
}

function getBestScores(userId) {
  const rows = db.prepare(
    'SELECT song_id, score FROM best_scores WHERE user_id = ?'
  ).all(userId);
  const map = {};
  for (const row of rows) map[row.song_id] = row.score;
  return map;
}

function getBestScore(userId, songId) {
  const row = db.prepare(
    'SELECT score FROM best_scores WHERE user_id = ? AND song_id = ?'
  ).get(userId, songId);
  return row ? row.score : 0;
}

function getRedeemedSecrets(userId) {
  if (!isSecretEligibleUserId(userId)) return [];
  ensureOverdriveBonus(userId);
  ensureVoidGodSkin(userId);
  const rows = db.prepare(
    'SELECT ability_id FROM user_redeemed_codes WHERE user_id = ?'
  ).all(userId);
  return expandSecretUnlocks([...new Set(rows.map((r) => r.ability_id))]);
}

function hasSecretUnlock(userId, unlockId) {
  if (!isSecretEligibleUserId(userId)) return false;
  if (unlockId === OVERDRIVE_BONUS_ID && hasSecretUnlock(userId, OVERDRIVE_ID)) return true;
  return !!db.prepare(
    'SELECT 1 FROM user_redeemed_codes WHERE user_id = ? AND ability_id = ?'
  ).get(userId, unlockId);
}

function getOwnedSkins(userId) {
  const owned = new Set([DEFAULT_SKIN_ID]);
  const rows = db.prepare(
    'SELECT skin_id FROM user_owned_skins WHERE user_id = ?'
  ).all(userId);
  for (const row of rows) owned.add(row.skin_id);
  for (const skinId of Object.keys(SKINS)) {
    if (SKINS[skinId].secret && hasSecretUnlock(userId, skinId)) {
      owned.add(skinId);
    }
  }
  return [...owned];
}

function ownsSkin(userId, skinId) {
  if (skinId === DEFAULT_SKIN_ID) return true;
  const skin = SKINS[skinId];
  if (!skin) return false;
  if (skin.secret) return hasSecretUnlock(userId, skinId);
  return !!db.prepare(
    'SELECT 1 FROM user_owned_skins WHERE user_id = ? AND skin_id = ?'
  ).get(userId, skinId);
}

function getEquippedSkin(userId) {
  const user = db.prepare('SELECT equipped_skin FROM users WHERE id = ?').get(userId);
  const equipped = user?.equipped_skin || DEFAULT_SKIN_ID;
  return ownsSkin(userId, equipped) ? equipped : DEFAULT_SKIN_ID;
}

function addOwnedSkin(userId, skinId) {
  db.prepare(
    'INSERT OR IGNORE INTO user_owned_skins (user_id, skin_id) VALUES (?, ?)'
  ).run(userId, skinId);
}

function getSkinPassives(skinId) {
  return SKINS[skinId]?.passives || {};
}

function getInventory(userId) {
  const rows = db.prepare(
    'SELECT ability_id, quantity FROM user_inventory WHERE user_id = ? AND quantity > 0'
  ).all(userId);
  const map = {};
  for (const row of rows) map[row.ability_id] = row.quantity;
  return map;
}

function addInventory(userId, abilityId, amount = 1) {
  db.prepare(`
    INSERT INTO user_inventory (user_id, ability_id, quantity)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, ability_id) DO UPDATE SET
      quantity = quantity + excluded.quantity
  `).run(userId, abilityId, amount);
}

function consumeInventory(userId, abilityIds) {
  const consumed = [];
  for (const abilityId of abilityIds) {
    const row = db.prepare(
      'SELECT quantity FROM user_inventory WHERE user_id = ? AND ability_id = ?'
    ).get(userId, abilityId);
    if (!row || row.quantity <= 0) {
      return { ok: false, error: `Not enough ${abilityId} in inventory.` };
    }
  }

  for (const abilityId of abilityIds) {
    db.prepare(`
      UPDATE user_inventory SET quantity = quantity - 1
      WHERE user_id = ? AND ability_id = ? AND quantity > 0
    `).run(userId, abilityId);
    db.prepare(
      'DELETE FROM user_inventory WHERE user_id = ? AND ability_id = ? AND quantity <= 0'
    ).run(userId, abilityId);
    consumed.push(abilityId);
  }

  return { ok: true, consumed };
}

function calculateReward({ score, grade, isTraining, isDodge, isBoss, isNightmare, trainingLevel, songId, userId, dodged = 0, timeSurvived = 0, bossRound = 0 }) {
  if (isDodge || isBoss) {
    if (score <= 0 && dodged <= 0 && (timeSurvived || 0) < 2 && (bossRound || 0) < 1) {
      return { earned: 0, base: 0, bonus: 0, isNewBest: false };
    }
  } else if (score <= 0 && dodged <= 0) {
    return { earned: 0, base: 0, bonus: 0, isNewBest: false };
  }

  let base;
  if (isBoss) {
    base = Math.floor(score / 120)
      + (bossRound || trainingLevel || 1) * 18
      + Math.floor((dodged || 0) / 2)
      + Math.floor((timeSurvived || 0) / 3);
  } else if (isDodge) {
    base = Math.floor(score / 140)
      + (trainingLevel || 1) * 5
      + Math.floor((dodged || 0) / 3)
      + Math.floor((timeSurvived || 0) / 4);
  } else if (isTraining) {
    base = Math.floor(score / 200) + (trainingLevel || 1) * 2;
  } else if (isNightmare && grade === 'S') {
    base = 10000;
  } else {
    const mult = GRADE_RUD_MULT[grade] || 1;
    base = Math.floor((score / 100) * mult);
  }

  let bonus = 0;
  let isNewBest = false;

  if (songId && userId) {
    const prev = getBestScore(userId, songId);
    if (score > prev) {
      isNewBest = true;
      if (prev === 0) {
        bonus = Math.max(5, Math.floor(base * 0.5));
      } else {
        bonus = Math.max(3, Math.floor((score - prev) / 150));
      }
      db.prepare(`
        INSERT INTO best_scores (user_id, song_id, score, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(user_id, song_id) DO UPDATE SET
          score = excluded.score,
          updated_at = excluded.updated_at
      `).run(userId, songId, score);
    }
  }

  const earned = isNightmare && grade === 'S' ? 10000 : Math.max(1, base + bonus);
  return { earned, base, bonus, isNewBest };
}

const app = express();
app.use(express.json());

function logRequest(req, res, next) {
  const start = Date.now();
  const { method, url, ip } = req;
  const body = req.method !== 'GET' && req.body && Object.keys(req.body).length
    ? JSON.stringify(req.body)
    : null;

  console.log(`[${new Date().toISOString()}] --> ${method} ${url} from ${ip}${body ? ` body=${body}` : ''}`);

  res.on('finish', () => {
    const ms = Date.now() - start;
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    console.log(`[${new Date().toISOString()}] <-- ${method} ${url} ${res.statusCode} ${ms}ms [${level}]`);
  });

  next();
}

app.use(logRequest);

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/register', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  const userErr = validateUsername(username);
  if (userErr) return res.status(400).json({ error: userErr });
  const passErr = validatePassword(password);
  if (passErr) return res.status(400).json({ error: passErr });

  const existing = db.prepare(
    'SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE'
  ).get(username);

  let userId;
  if (existing) {
    if (existing.password_hash) {
      return res.status(400).json({ error: 'Username already taken. Try logging in.' });
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(hashPassword(password), existing.id);
    userId = existing.id;
    console.log(`[auth/register] claimed legacy account id=${userId} username="${existing.username}"`);
  } else {
    const result = db.prepare(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)'
    ).run(username, hashPassword(password));
    userId = result.lastInsertRowid;
    console.log(`[auth/register] created user id=${userId} username="${username}"`);
  }

  const user = getUser(userId);
  const session = createSession(userId);
  res.json({ ...buildUserProfile(user), token: session.token, expiresAt: session.expiresAt });
});

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  const userErr = validateUsername(username);
  if (userErr) return res.status(400).json({ error: userErr });
  if (!password) return res.status(400).json({ error: 'Password is required.' });

  const user = db.prepare(
    'SELECT id, username, rud_balance, password_hash FROM users WHERE username = ? COLLATE NOCASE'
  ).get(username);

  if (!user) return res.status(401).json({ error: 'Wrong username or password.' });
  if (!user.password_hash) {
    return res.status(400).json({
      error: 'This account has no password yet. Use Register with the same username to set one.',
    });
  }
  if (!verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Wrong username or password.' });
  }

  const session = createSession(user.id);
  console.log(`[auth/login] user id=${user.id} username="${user.username}"`);
  res.json({ ...buildUserProfile(user), token: session.token, expiresAt: session.expiresAt });
});

app.get('/api/auth/me', (req, res) => {
  const session = getSessionUser(getTokenFromReq(req));
  if (!session) return res.status(401).json({ error: 'Not logged in.' });
  res.json(buildUserProfile(session));
});

app.post('/api/auth/logout', (req, res) => {
  const token = getTokenFromReq(req);
  if (token) db.prepare('DELETE FROM user_sessions WHERE token = ?').run(token);
  res.json({ ok: true });
});

app.post('/api/users', (req, res) => {
  res.status(410).json({
    error: 'Name-only login is disabled. Create an account with password via Register.',
  });
});

app.get('/api/users/:id', requireAuth, (req, res) => {
  const user = getUser(req.authUserId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  res.json(buildUserProfile(user));
});

app.get('/api/shop/items', (_req, res) => {
  res.json(SHOP_ITEMS);
});

app.get('/api/skins/items', (_req, res) => {
  res.json(SKINS);
});

app.post('/api/users/:id/buy-skin', requireAuth, (req, res) => {
  const userId = req.authUserId;
  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const skinId = String(req.body.skinId || '');
  const skin = SKINS[skinId];
  if (!skin) return res.status(400).json({ error: 'Unknown skin.' });
  if (skin.secret) return res.status(400).json({ error: 'This skin cannot be purchased.' });
  if (ownsSkin(userId, skinId)) {
    return res.status(400).json({ error: 'You already own this skin.' });
  }
  if (user.rud_balance < skin.price) {
    return res.status(400).json({ error: 'Not enough RUD.' });
  }

  db.prepare('UPDATE users SET rud_balance = rud_balance - ? WHERE id = ?')
    .run(skin.price, userId);
  addOwnedSkin(userId, skinId);

  const updated = getUser(userId);
  res.json({
    skinId,
    balance: updated.rud_balance,
    ownedSkins: getOwnedSkins(userId),
    equippedSkin: getEquippedSkin(userId),
  });
});

app.post('/api/users/:id/equip-skin', requireAuth, (req, res) => {
  const userId = req.authUserId;
  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const skinId = String(req.body.skinId || DEFAULT_SKIN_ID);
  if (!ownsSkin(userId, skinId)) {
    return res.status(400).json({ error: 'You do not own this skin.' });
  }

  db.prepare('UPDATE users SET equipped_skin = ? WHERE id = ?').run(skinId, userId);
  res.json({
    equippedSkin: skinId,
    ownedSkins: getOwnedSkins(userId),
  });
});

app.post('/api/users/:id/buy', requireAuth, (req, res) => {
  const userId = req.authUserId;
  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const abilityId = String(req.body.abilityId || '');
  const item = SHOP_ITEMS[abilityId];
  if (!item) return res.status(400).json({ error: 'Unknown ability.' });
  if (item.secret) return res.status(400).json({ error: 'This ability cannot be purchased.' });

  if (user.rud_balance < item.price) {
    return res.status(400).json({ error: 'Not enough RUD.' });
  }

  db.prepare('UPDATE users SET rud_balance = rud_balance - ? WHERE id = ?')
    .run(item.price, userId);
  addInventory(userId, abilityId, 1);

  const updated = getUser(userId);
  res.json({
    abilityId,
    balance: updated.rud_balance,
    inventory: getInventory(userId),
  });
});

app.post('/api/users/:id/consume', requireAuth, (req, res) => {
  const userId = req.authUserId;
  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const mode = String(req.body.mode || '');
  const abilityIds = Array.isArray(req.body.abilityIds) ? req.body.abilityIds : [];

  if (abilityIds.length > 2) {
    return res.status(400).json({ error: 'Max 2 abilities per run.' });
  }

  const consumable = [];
  for (const abilityId of abilityIds) {
    const item = SHOP_ITEMS[abilityId];
    if (!item) return res.status(400).json({ error: `Unknown ability: ${abilityId}` });
    if (!item.modes.includes(mode)) {
      return res.status(400).json({ error: `${abilityId} cannot be used in ${mode} mode.` });
    }
    if (item.secret && !hasSecretUnlock(userId, abilityId)) {
      return res.status(400).json({ error: 'Secret ability not unlocked.' });
    }
    if (!item.secret) consumable.push(abilityId);
  }

  const secrets = abilityIds.filter((id) => SHOP_ITEMS[id]?.secret);
  let consumed = [];
  if (consumable.length) {
    const result = consumeInventory(userId, consumable);
    if (!result.ok) return res.status(400).json({ error: result.error });
    consumed = result.consumed;
  }

  res.json({
    abilities: expandRunAbilities([...secrets, ...consumed]),
    balance: user.rud_balance,
    inventory: getInventory(userId),
  });
});

app.post('/api/users/:id/redeem', requireAuth, (req, res) => {
  const userId = req.authUserId;
  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (!isSecretEligibleUserId(userId)) {
    return res.status(403).json({ error: 'Your account cannot redeem secret codes.' });
  }

  const code = String(req.body.code || '').trim();
  const mapped = SECRET_CODES[code];
  if (!mapped) return res.status(400).json({ error: 'Invalid code.' });

  const unlockIds = Array.isArray(mapped) ? mapped : [mapped];
  const missing = unlockIds.filter((id) => !hasSecretUnlock(userId, id));
  if (!missing.length) {
    return res.status(400).json({ error: 'Code already redeemed.' });
  }

  for (const unlockId of missing) {
    db.prepare(
      'INSERT OR IGNORE INTO user_redeemed_codes (user_id, code, ability_id) VALUES (?, ?, ?)'
    ).run(userId, code, unlockId);
    if (SKINS[unlockId]) addOwnedSkin(userId, unlockId);
  }

  res.json({
    abilityIds: missing.filter((id) => SHOP_ITEMS[id]),
    skinIds: missing.filter((id) => SKINS[id]),
    inventory: getInventory(userId),
    secretUnlocks: getRedeemedSecrets(userId),
    ownedSkins: getOwnedSkins(userId),
  });
});

app.post('/api/users/:id/complete', requireAuth, (req, res) => {
  const userId = req.authUserId;
  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const {
    score = 0,
    grade = null,
    songId = null,
    isTraining = false,
    isDodge = false,
    isBoss = false,
    isNightmare = false,
    trainingLevel = 1,
    bossRound = 0,
    dodged = 0,
    timeSurvived = 0,
    activeAbilities = [],
    skinId = DEFAULT_SKIN_ID,
  } = req.body;

  const isNightmareRun = !!isNightmare || (songId && String(songId).startsWith('nightmare-'));

  const reward = calculateReward({
    score: Number(score) || 0,
    grade,
    isTraining: !!isTraining,
    isDodge: !!isDodge,
    isBoss: !!isBoss,
    isNightmare: isNightmareRun,
    trainingLevel: Number(trainingLevel) || 1,
    bossRound: Number(bossRound) || 0,
    dodged: Number(dodged) || 0,
    timeSurvived: Number(timeSurvived) || 0,
    songId: songId || null,
    userId,
  });

  let earned = reward.earned;
  if (earned > 0 && Array.isArray(activeAbilities) && activeAbilities.includes('rud-magnet')) {
    earned = Math.floor(earned * 1.2);
  }
  const skinPassives = getSkinPassives(ownsSkin(userId, skinId) ? skinId : DEFAULT_SKIN_ID);
  if (earned > 0 && skinPassives.rudMult) {
    earned = Math.floor(earned * skinPassives.rudMult);
  }

  let balance = user.rud_balance;
  if (earned > 0) {
    db.prepare('UPDATE users SET rud_balance = rud_balance + ? WHERE id = ?')
      .run(earned, userId);
    balance += earned;
  }

  res.json({
    ...reward,
    earned,
    balance,
    bestScores: getBestScores(userId),
    inventory: getInventory(userId),
  });
});

app.get('/api/leaderboard', (_req, res) => {
  const rows = db.prepare(`
    SELECT username, rud_balance AS balance
    FROM users
    ORDER BY rud_balance DESC, username ASC
    LIMIT 10
  `).all();
  res.json(rows);
});

app.use(express.static(__dirname, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.js') || filePath.endsWith('.html') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  },
}));

app.use((req, res) => {
  console.log(`[404] no route for ${req.method} ${req.url}`);
  res.status(404).json({ error: `No route for ${req.method} ${req.url}` });
});

app.use((err, req, res, _next) => {
  console.error(`[500] ${req.method} ${req.url}`, err);
  res.status(500).json({ error: 'Server error. Try restarting with npm run restart.' });
});

app.listen(PORT, () => {
  ensureSecretEligibleAccounts();
  console.log(`Beat Parry server running at http://localhost:${PORT}`);
  console.log(`API routes: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout`);
  console.log(`          GET /api/users/:id, POST /api/users/:id/buy|buy-skin|equip-skin|consume|redeem|complete, GET /api/leaderboard`);
  console.log(`Use "npm start" — not "npx serve" (serve has no API).`);
});
