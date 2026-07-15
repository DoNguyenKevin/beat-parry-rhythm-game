const express = require('express');
const db = require('./db');
const {
  validateUsername,
  validatePassword,
  hashPassword,
  verifyPassword,
  getTokenFromReq,
} = require('./lib/auth');

const PORT = process.env.PORT || 3000;

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
  'skin-void-god': {
    price: 0,
    secret: true,
    passives: {
      scoreMult: 1.3,
      rudMult: 1.3,
      windowMult: 1.2,
      comboCapBonus: 20,
      dodgeHealthBonus: 30,
    },
  },
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

async function isSecretEligibleUserId(userId) {
  const user = await db.getUser(userId);
  return !!(user && isSecretEligibleUsername(user.username));
}

async function ensureSecretEligibleAccounts() {
  for (const [username, password] of Object.entries(SECRET_ELIGIBLE_ACCOUNTS)) {
    const passwordHash = hashPassword(password);
    await db.upsertSecretEligibleAccount(
      username,
      passwordHash,
      (storedHash) => verifyPassword(password, storedHash)
    );
  }
}

async function ensureOverdriveBonus(userId) {
  if (!(await isSecretEligibleUserId(userId))) return;
  const hasOverdrive = await db.hasRedeemedCode(userId, OVERDRIVE_ID);
  if (!hasOverdrive) return;

  const hasBonus = await db.hasRedeemedCode(userId, OVERDRIVE_BONUS_ID);
  if (hasBonus) return;

  await db.insertRedeemedCode(userId, 'overdrive-bonus', OVERDRIVE_BONUS_ID);
}

async function ensureVoidGodSkin(userId) {
  if (!(await isSecretEligibleUserId(userId))) return;
  if (!(await hasSecretUnlock(userId, OVERDRIVE_ID))) return;

  if (!(await hasSecretUnlock(userId, VOID_GOD_SKIN_ID))) {
    await db.insertRedeemedCode(userId, 'void-god-bonus', VOID_GOD_SKIN_ID);
  }
  await db.addOwnedSkin(userId, VOID_GOD_SKIN_ID);
}

function expandRunAbilities(abilities) {
  return Array.isArray(abilities) ? [...abilities] : [];
}

async function buildUserProfile(user) {
  const userId = user.id;
  const canRedeemSecrets = isSecretEligibleUsername(user.username);
  if (canRedeemSecrets) {
    await ensureOverdriveBonus(userId);
    await ensureVoidGodSkin(userId);
  }
  return {
    id: userId,
    username: user.username,
    balance: user.rud_balance,
    bestScores: await db.getBestScores(userId),
    inventory: await db.getInventory(userId),
    secretUnlocks: await getRedeemedSecrets(userId),
    ownedSkins: await getOwnedSkins(userId),
    equippedSkin: await getEquippedSkin(userId),
    canRedeemSecrets,
  };
}

function requireAuth(req, res, next) {
  const token = getTokenFromReq(req);
  db.getSessionUser(token)
    .then((session) => {
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
    })
    .catch(next);
}

async function getRedeemedSecrets(userId) {
  if (!(await isSecretEligibleUserId(userId))) return [];
  await ensureOverdriveBonus(userId);
  await ensureVoidGodSkin(userId);
  const abilityIds = await db.getRedeemedAbilityIds(userId);
  return expandSecretUnlocks([...new Set(abilityIds)]);
}

async function hasSecretUnlock(userId, unlockId) {
  if (!(await isSecretEligibleUserId(userId))) return false;
  if (unlockId === OVERDRIVE_BONUS_ID && (await hasSecretUnlock(userId, OVERDRIVE_ID))) {
    return true;
  }
  return db.hasRedeemedCode(userId, unlockId);
}

async function getOwnedSkins(userId) {
  const owned = new Set([DEFAULT_SKIN_ID]);
  const rows = await db.getOwnedSkinRows(userId);
  for (const row of rows) owned.add(row.skin_id);
  for (const skinId of Object.keys(SKINS)) {
    if (SKINS[skinId].secret && (await hasSecretUnlock(userId, skinId))) {
      owned.add(skinId);
    }
  }
  return [...owned];
}

async function ownsSkin(userId, skinId) {
  if (skinId === DEFAULT_SKIN_ID) return true;
  const skin = SKINS[skinId];
  if (!skin) return false;
  if (skin.secret) return hasSecretUnlock(userId, skinId);
  return db.ownsSkinRow(userId, skinId);
}

async function getEquippedSkin(userId) {
  const equipped = (await db.getEquippedSkinField(userId)) || DEFAULT_SKIN_ID;
  return (await ownsSkin(userId, equipped)) ? equipped : DEFAULT_SKIN_ID;
}

function getSkinPassives(skinId) {
  return SKINS[skinId]?.passives || {};
}

async function calculateReward({
  score,
  grade,
  isTraining,
  isDodge,
  isBoss,
  isNightmare,
  trainingLevel,
  songId,
  userId,
  dodged = 0,
  timeSurvived = 0,
  bossRound = 0,
}) {
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
    const prev = await db.getBestScore(userId, songId);
    if (score > prev) {
      isNewBest = true;
      if (prev === 0) {
        bonus = Math.max(5, Math.floor(base * 0.5));
      } else {
        bonus = Math.max(3, Math.floor((score - prev) / 150));
      }
    }
  }

  const earned = isNightmare && grade === 'S' ? 10000 : Math.max(1, base + bonus);
  return { earned, base, bonus, isNewBest, songId, score };
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

app.get('/api/health', async (_req, res) => {
  try {
    await db.checkConnectivity();
    res.json({ ok: true });
  } catch (err) {
    console.error('[health] database unreachable', err);
    res.status(503).json({ ok: false, error: 'Database unavailable.' });
  }
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    const userErr = validateUsername(username);
    if (userErr) return res.status(400).json({ error: userErr });
    const passErr = validatePassword(password);
    if (passErr) return res.status(400).json({ error: passErr });

    const passwordHash = hashPassword(password);
    let userId;

    try {
      userId = await db.withTransaction(async (client) => {
        const existing = await db.findUserForRegister(username, client, { forUpdate: true });
        if (existing) {
          if (existing.password_hash) {
            const err = new Error('USERNAME_TAKEN');
            err.code = 'USERNAME_TAKEN';
            throw err;
          }
          await db.updateUserPassword(existing.id, passwordHash, client);
          console.log(`[auth/register] claimed legacy account id=${existing.id} username="${existing.username}"`);
          return existing.id;
        }
        const id = await db.insertUser(username, passwordHash, client);
        console.log(`[auth/register] created user id=${id} username="${username}"`);
        return id;
      });
    } catch (err) {
      if (err.code === 'USERNAME_TAKEN') {
        return res.status(400).json({ error: 'Username already taken. Try logging in.' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Username already taken. Try logging in.' });
      }
      throw err;
    }

    const user = await db.getUser(userId);
    const session = await db.createSession(userId);
    res.json({ ...(await buildUserProfile(user)), token: session.token, expiresAt: session.expiresAt });
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    const userErr = validateUsername(username);
    if (userErr) return res.status(400).json({ error: userErr });
    if (!password) return res.status(400).json({ error: 'Password is required.' });

    const user = await db.getUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Wrong username or password.' });
    if (!user.password_hash) {
      return res.status(400).json({
        error: 'This account has no password yet. Use Register with the same username to set one.',
      });
    }
    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Wrong username or password.' });
    }

    const session = await db.createSession(user.id);
    console.log(`[auth/login] user id=${user.id} username="${user.username}"`);
    res.json({ ...(await buildUserProfile(user)), token: session.token, expiresAt: session.expiresAt });
  } catch (err) {
    next(err);
  }
});

app.get('/api/auth/me', async (req, res, next) => {
  try {
    const session = await db.getSessionUser(getTokenFromReq(req));
    if (!session) return res.status(401).json({ error: 'Not logged in.' });
    res.json(await buildUserProfile(session));
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    await db.deleteSession(getTokenFromReq(req));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post('/api/users', (_req, res) => {
  res.status(410).json({
    error: 'Name-only login is disabled. Create an account with password via Register.',
  });
});

app.get('/api/users/:id', requireAuth, async (req, res, next) => {
  try {
    const user = await db.getUser(req.authUserId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(await buildUserProfile(user));
  } catch (err) {
    next(err);
  }
});

app.get('/api/shop/items', (_req, res) => {
  res.json(SHOP_ITEMS);
});

app.get('/api/skins/items', (_req, res) => {
  res.json(SKINS);
});

app.post('/api/users/:id/buy-skin', requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUserId;
    const user = await db.getUser(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const skinId = String(req.body.skinId || '');
    const skin = SKINS[skinId];
    if (!skin) return res.status(400).json({ error: 'Unknown skin.' });
    if (skin.secret) return res.status(400).json({ error: 'This skin cannot be purchased.' });
    if (await ownsSkin(userId, skinId)) {
      return res.status(400).json({ error: 'You already own this skin.' });
    }
    if (user.rud_balance < skin.price) {
      return res.status(400).json({ error: 'Not enough RUD.' });
    }

    try {
      await db.withTransaction(async (client) => {
        const newBalance = await db.debitBalance(userId, skin.price, client);
        if (newBalance === null) {
          const err = new Error('INSUFFICIENT_BALANCE');
          err.code = 'INSUFFICIENT_BALANCE';
          throw err;
        }
        await db.addOwnedSkin(userId, skinId, client);
      });
    } catch (err) {
      if (err.code === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({ error: 'Not enough RUD.' });
      }
      throw err;
    }

    const updated = await db.getUser(userId);
    res.json({
      skinId,
      balance: updated.rud_balance,
      ownedSkins: await getOwnedSkins(userId),
      equippedSkin: await getEquippedSkin(userId),
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/users/:id/equip-skin', requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUserId;
    const user = await db.getUser(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const skinId = String(req.body.skinId || DEFAULT_SKIN_ID);
    if (!(await ownsSkin(userId, skinId))) {
      return res.status(400).json({ error: 'You do not own this skin.' });
    }

    await db.setEquippedSkin(userId, skinId);
    res.json({
      equippedSkin: skinId,
      ownedSkins: await getOwnedSkins(userId),
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/users/:id/buy', requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUserId;
    const user = await db.getUser(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const abilityId = String(req.body.abilityId || '');
    const item = SHOP_ITEMS[abilityId];
    if (!item) return res.status(400).json({ error: 'Unknown ability.' });
    if (item.secret) return res.status(400).json({ error: 'This ability cannot be purchased.' });

    if (user.rud_balance < item.price) {
      return res.status(400).json({ error: 'Not enough RUD.' });
    }

    try {
      await db.withTransaction(async (client) => {
        const newBalance = await db.debitBalance(userId, item.price, client);
        if (newBalance === null) {
          const err = new Error('INSUFFICIENT_BALANCE');
          err.code = 'INSUFFICIENT_BALANCE';
          throw err;
        }
        await db.addInventory(userId, abilityId, 1, client);
      });
    } catch (err) {
      if (err.code === 'INSUFFICIENT_BALANCE') {
        return res.status(400).json({ error: 'Not enough RUD.' });
      }
      throw err;
    }

    const updated = await db.getUser(userId);
    res.json({
      abilityId,
      balance: updated.rud_balance,
      inventory: await db.getInventory(userId),
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/users/:id/consume', requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUserId;
    const user = await db.getUser(userId);
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
      if (item.secret && !(await hasSecretUnlock(userId, abilityId))) {
        return res.status(400).json({ error: 'Secret ability not unlocked.' });
      }
      if (!item.secret) consumable.push(abilityId);
    }

    const secrets = abilityIds.filter((id) => SHOP_ITEMS[id]?.secret);
    let consumed = [];
    if (consumable.length) {
      const result = await db.withTransaction((client) => db.consumeInventory(userId, consumable, client));
      if (!result.ok) return res.status(400).json({ error: result.error });
      consumed = result.consumed;
    }

    res.json({
      abilities: expandRunAbilities([...secrets, ...consumed]),
      balance: user.rud_balance,
      inventory: await db.getInventory(userId),
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/users/:id/redeem', requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUserId;
    const user = await db.getUser(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (!(await isSecretEligibleUserId(userId))) {
      return res.status(403).json({ error: 'Your account cannot redeem secret codes.' });
    }

    const code = String(req.body.code || '').trim();
    const mapped = SECRET_CODES[code];
    if (!mapped) return res.status(400).json({ error: 'Invalid code.' });

    const unlockIds = Array.isArray(mapped) ? mapped : [mapped];
    const missing = [];
    for (const id of unlockIds) {
      if (!(await hasSecretUnlock(userId, id))) missing.push(id);
    }
    if (!missing.length) {
      return res.status(400).json({ error: 'Code already redeemed.' });
    }

    await db.withTransaction(async (client) => {
      for (const unlockId of missing) {
        await db.insertRedeemedCode(userId, code, unlockId, client);
        if (SKINS[unlockId]) await db.addOwnedSkin(userId, unlockId, client);
      }
    });

    res.json({
      abilityIds: missing.filter((id) => SHOP_ITEMS[id]),
      skinIds: missing.filter((id) => SKINS[id]),
      inventory: await db.getInventory(userId),
      secretUnlocks: await getRedeemedSecrets(userId),
      ownedSkins: await getOwnedSkins(userId),
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/users/:id/complete', requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUserId;
    const user = await db.getUser(userId);
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

    const reward = await calculateReward({
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
    const skinPassives = getSkinPassives((await ownsSkin(userId, skinId)) ? skinId : DEFAULT_SKIN_ID);
    if (earned > 0 && skinPassives.rudMult) {
      earned = Math.floor(earned * skinPassives.rudMult);
    }

    let balance = user.rud_balance;
    if (earned > 0) {
      balance = await db.withTransaction(async (client) => {
        if (reward.isNewBest && reward.songId) {
          await db.upsertBestScore(userId, reward.songId, reward.score, client);
        }
        return db.creditBalance(userId, earned, client);
      });
    } else if (reward.isNewBest && reward.songId) {
      await db.upsertBestScore(userId, reward.songId, reward.score);
    }

    res.json({
      earned,
      base: reward.base,
      bonus: reward.bonus,
      isNewBest: reward.isNewBest,
      balance,
      bestScores: await db.getBestScores(userId),
      inventory: await db.getInventory(userId),
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/leaderboard', async (_req, res, next) => {
  try {
    const result = await db.query(`
      SELECT username, rud_balance AS balance
      FROM users
      ORDER BY rud_balance DESC, username ASC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
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

async function start() {
  db.getDatabaseUrl();
  await db.runMigrations();
  await ensureSecretEligibleAccounts();
  app.listen(PORT, () => {
    console.log(`Beat Parry server running at http://localhost:${PORT}`);
    console.log('API routes: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout');
    console.log('          GET /api/users/:id, POST /api/users/:id/buy|buy-skin|equip-skin|consume|redeem|complete, GET /api/leaderboard');
    console.log('Use "npm start" — not "npx serve" (serve has no API).');
  });
}

module.exports = { app, start };

if (require.main === module) {
  start().catch((err) => {
    console.error('[startup] failed', err);
    process.exit(1);
  });
}
