require('dotenv').config();

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

const ADMIN_ACCOUNTS = {
  kevin: true,
  keios: true,
};

const { DEFAULT_ADMIN_CONFIG } = db;

const SKINS = {
  default: { price: 0, passives: {} },
  'skin-neon': { price: 350, passives: { scoreMult: 1.08 } },
  'skin-emerald': { price: 600, passives: { windowMult: 1.12 } },
  'skin-solar': { price: 900, passives: { rudMult: 1.15 } },
  'skin-inferno': { price: 1400, passives: { scoreMult: 1.2, comboCapBonus: 10 } },
  'skin-fortune-crown': {
    price: 0,
    spinOnly: true,
    passives: {
      scoreMult: 1.25,
      rudMult: 1.2,
      windowMult: 1.15,
      comboCapBonus: 15,
      dodgeHealthBonus: 15,
      trail: true,
    },
  },
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

const WHEEL_SPIN_COST = 150;
const FREE_SPIN_HOURS = 24;

const WHEEL_PRIZES = [
  { id: 'rud-75', type: 'rud', amount: 75, weight: 20, label: '75 RUD', color: '#c9a227', icon: '🪙' },
  { id: 'rud-150', type: 'rud', amount: 150, weight: 16, label: '150 RUD', color: '#d4af37', icon: '🪙' },
  { id: 'rud-350', type: 'rud', amount: 350, weight: 9, label: '350 RUD', color: '#e6b422', icon: '💰' },
  { id: 'rud-750', type: 'rud', amount: 750, weight: 4, label: '750 RUD', color: '#f0a500', icon: '💎' },
  { id: 'skill-wide-window', type: 'ability', abilityId: 'wide-window', weight: 8, label: 'Steady Hands', color: '#4a7fd4', icon: '🎯' },
  { id: 'skill-combo-shield', type: 'ability', abilityId: 'combo-shield', weight: 7, label: 'Combo Shield', color: '#5b6fd6', icon: '🛡️' },
  { id: 'skill-score-boost', type: 'ability', abilityId: 'score-boost', weight: 6, label: 'Score Boost', color: '#7b5fd8', icon: '⚡' },
  { id: 'skill-rud-magnet', type: 'ability', abilityId: 'rud-magnet', weight: 5, label: 'RUD Magnet', color: '#3da8d4', icon: '🧲' },
  { id: 'skill-second-chance', type: 'ability', abilityId: 'second-chance', weight: 7, label: 'Second Chance', color: '#3db88a', icon: '♻️' },
  { id: 'skill-ghost-phase', type: 'ability', abilityId: 'ghost-phase', weight: 6, label: 'Ghost Phase', color: '#8b6fd4', icon: '👻' },
  { id: 'skill-long-warning', type: 'ability', abilityId: 'long-warning', weight: 6, label: 'Early Warning', color: '#d4883a', icon: '⚠️' },
  { id: 'skill-slow-start', type: 'ability', abilityId: 'slow-start', weight: 5, label: 'Calm Start', color: '#4db87a', icon: '🐢' },
  { id: 'bonus-spin', type: 'freeSpin', weight: 3, label: 'Bonus Spin', color: '#d44a9a', icon: '🔄' },
  { id: 'skin-neon', type: 'skin', skinId: 'skin-neon', fallbackRud: 350, weight: 2, label: 'Neon Pulse', color: '#0099bb', icon: '💠' },
  { id: 'skin-emerald', type: 'skin', skinId: 'skin-emerald', fallbackRud: 600, weight: 1, label: 'Emerald Guard', color: '#22aa66', icon: '💚' },
  { id: 'skin-solar', type: 'skin', skinId: 'skin-solar', fallbackRud: 900, weight: 1, label: 'Solar Crown', color: '#ffd700', icon: '👑' },
  { id: 'skin-inferno', type: 'skin', skinId: 'skin-inferno', fallbackRud: 1400, weight: 1, label: 'Inferno Core', color: '#ff5533', icon: '🔥' },
  { id: 'skin-fortune-crown', type: 'skin', skinId: 'skin-fortune-crown', fallbackRud: 1200, weight: 1, label: 'Fortune Crown', color: '#b8860b', icon: '🎰' },
];

async function getEffectiveWheelPrizes() {
  const luck = (await db.getAdminConfig()).wheelLuckMult || 1;
  if (luck === 1) return WHEEL_PRIZES;
  return WHEEL_PRIZES.map((p) => {
    let weight = p.weight;
    const isRare = p.weight <= 4 || p.type === 'skin' || p.type === 'freeSpin';
    if (isRare) weight *= luck;
    else if (luck > 1) weight /= Math.sqrt(luck);
    else if (luck < 1) weight *= Math.sqrt(luck);
    return { ...p, weight: Math.max(0.05, weight) };
  });
}

async function pickWheelPrize() {
  const effective = await getEffectiveWheelPrizes();
  const total = effective.reduce((sum, prize) => sum + prize.weight, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < effective.length; i++) {
    roll -= effective[i].weight;
    if (roll <= 0) return { prize: WHEEL_PRIZES[i], index: i };
  }
  const last = WHEEL_PRIZES.length - 1;
  return { prize: WHEEL_PRIZES[last], index: last };
}

async function getSpinCost() {
  return (await db.getAdminConfig()).wheelSpinCost || WHEEL_SPIN_COST;
}

async function getFreeSpinHours() {
  return (await db.getAdminConfig()).freeSpinHours || FREE_SPIN_HOURS;
}

async function getWheelState(userId) {
  const freeSpinHours = await getFreeSpinHours();
  const row = await db.getWheelUserRow(userId);
  const bonus = row?.wheel_bonus_spins || 0;
  let freeSpinAvailable = bonus > 0;
  let nextFreeSpinAt = null;

  if (!freeSpinAvailable) {
    if (!row?.last_free_spin_at) {
      freeSpinAvailable = true;
    } else {
      const last = new Date(row.last_free_spin_at);
      const next = new Date(last.getTime() + freeSpinHours * 60 * 60 * 1000);
      if (Date.now() >= next.getTime()) freeSpinAvailable = true;
      else nextFreeSpinAt = next.toISOString();
    }
  }

  return {
    wheelBonusSpins: bonus,
    freeSpinAvailable,
    nextFreeSpinAt,
    spinCost: await getSpinCost(),
    freeSpinHours,
    wheelLuckMult: (await db.getAdminConfig()).wheelLuckMult || 1,
  };
}

async function grantWheelPrize(userId, prize, client) {
  if (prize.type === 'rud') {
    await db.creditBalance(userId, prize.amount, client);
    return { id: prize.id, type: 'rud', label: prize.label, amount: prize.amount, icon: prize.icon };
  }

  if (prize.type === 'ability') {
    const item = SHOP_ITEMS[prize.abilityId];
    if (!item || item.secret) {
      const amount = 120;
      await db.creditBalance(userId, amount, client);
      return { id: prize.id, type: 'rud', label: `${amount} RUD`, amount, icon: '🪙', fallback: true };
    }
    await db.addInventory(userId, prize.abilityId, 1, client);
    return {
      id: prize.id,
      type: 'ability',
      label: prize.label,
      abilityId: prize.abilityId,
      icon: prize.icon,
    };
  }

  if (prize.type === 'skin') {
    if (await ownsSkin(userId, prize.skinId)) {
      await db.creditBalance(userId, prize.fallbackRud, client);
      return {
        id: prize.id,
        type: 'rud',
        label: `${prize.fallbackRud} RUD`,
        amount: prize.fallbackRud,
        icon: '🪙',
        duplicate: true,
      };
    }
    await db.addOwnedSkin(userId, prize.skinId, client);
    return { id: prize.id, type: 'skin', label: prize.label, skinId: prize.skinId, icon: prize.icon };
  }

  if (prize.type === 'freeSpin') {
    await db.addBonusSpins(userId, 1, client);
    return { id: prize.id, type: 'freeSpin', label: prize.label, icon: prize.icon };
  }

  return { id: prize.id, type: 'rud', label: '50 RUD', amount: 50, icon: '🪙' };
}

function getPublicConfig(cfg) {
  return {
    wheelLuckMult: cfg.wheelLuckMult,
    speedPlay: cfg.speedPlay,
    speedTraining: cfg.speedTraining,
    speedDodge: cfg.speedDodge,
    speedBoss: cfg.speedBoss,
    rudMultGlobal: cfg.rudMultGlobal,
    wheelSpinCost: cfg.wheelSpinCost,
    freeSpinHours: cfg.freeSpinHours,
    trainingLevelInterval: cfg.trainingLevelInterval,
    dodgeLevelInterval: cfg.dodgeLevelInterval,
    maintenanceMode: cfg.maintenanceMode,
    announcement: cfg.announcement || '',
  };
}

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
    isAdmin: await db.isAdminUserId(userId),
    ...(await getWheelState(userId)),
  };
}

function requireAdmin(req, res, next) {
  const token = getTokenFromReq(req);
  db.getSessionUser(token)
    .then(async (session) => {
      if (!session) {
        return res.status(401).json({ error: 'Not logged in. Please sign in again.' });
      }
      if (!(await db.isAdminUserId(session.user_id))) {
        return res.status(403).json({ error: 'Admin access only.' });
      }
      req.authUserId = Number(session.user_id);
      req.authToken = token;
      next();
    })
    .catch(next);
}

function requireAuth(req, res, next) {
  const token = getTokenFromReq(req);
  db.getSessionUser(token)
    .then((session) => {
      if (!session) {
        return res.status(401).json({ error: 'Not logged in. Please sign in again.' });
      }
      const routeUserId = parseInt(req.params.id, 10);
      const sessionUserId = Number(session.user_id);
      if (routeUserId !== sessionUserId) {
        return res.status(403).json({ error: 'You can only access your own account.' });
      }
      req.authUserId = sessionUserId;
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
  const rudMult = (await db.getAdminConfig()).rudMultGlobal || 1;
  const finalEarned = rudMult !== 1 ? Math.max(1, Math.floor(earned * rudMult)) : earned;
  return { earned: finalEarned, base, bonus, isNewBest, songId, score };
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

app.get('/api/auth/check-username', async (req, res, next) => {
  try {
    const username = String(req.query.username || '').trim();
    const userErr = validateUsername(username);
    if (userErr) return res.json({ available: false, error: userErr });
    res.json({ available: !(await db.usernameTaken(username)) });
  } catch (err) {
    next(err);
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

app.get('/api/config', async (_req, res, next) => {
  try {
    res.json(getPublicConfig(await db.getAdminConfig()));
  } catch (err) {
    next(err);
  }
});

app.get('/api/wheel/prizes', async (_req, res, next) => {
  try {
    const cfg = await db.getAdminConfig();
    res.json({
      prizes: WHEEL_PRIZES,
      effectivePrizes: await getEffectiveWheelPrizes(),
      spinCost: await getSpinCost(),
      freeSpinHours: await getFreeSpinHours(),
      wheelLuckMult: cfg.wheelLuckMult || 1,
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/users/:id/spin', requireAuth, async (req, res, next) => {
  try {
    const userId = req.authUserId;
    const user = await db.getWheelUserRow(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const spinCost = await getSpinCost();
    const useFree = !!req.body.useFree;
    const wheelBefore = await getWheelState(userId);

    const { prize, index } = await pickWheelPrize();
    let granted;

    await db.withTransaction(async (client) => {
      if (useFree) {
        if (!wheelBefore.freeSpinAvailable) {
          const err = new Error('NO_FREE_SPIN');
          err.code = 'NO_FREE_SPIN';
          throw err;
        }
        if (user.wheel_bonus_spins > 0) {
          await db.decrementBonusSpin(userId, client);
        } else {
          await db.setLastFreeSpinNow(userId, client);
        }
      } else if (user.rud_balance < spinCost) {
        const err = new Error('INSUFFICIENT_BALANCE');
        err.code = 'INSUFFICIENT_BALANCE';
        throw err;
      } else {
        const newBalance = await db.debitBalance(userId, spinCost, client);
        if (newBalance === null) {
          const err = new Error('INSUFFICIENT_BALANCE');
          err.code = 'INSUFFICIENT_BALANCE';
          throw err;
        }
      }

      granted = await grantWheelPrize(userId, prize, client);
    });

    const updated = await db.getUser(userId);
    res.json({
      prizeIndex: index,
      prize: granted,
      balance: updated.rud_balance,
      inventory: await db.getInventory(userId),
      ownedSkins: await getOwnedSkins(userId),
      wheelState: await getWheelState(userId),
      paid: !useFree,
      cost: useFree ? 0 : spinCost,
    });
  } catch (err) {
    if (err.code === 'NO_FREE_SPIN') {
      return res.status(400).json({ error: 'No free spin available right now.' });
    }
    if (err.code === 'INSUFFICIENT_BALANCE') {
      return res.status(400).json({ error: 'Not enough RUD for a spin.' });
    }
    next(err);
  }
});

app.get('/api/admin/config', requireAdmin, async (_req, res, next) => {
  try {
    const config = await db.getAdminConfig();
    res.json({
      config,
      prizes: WHEEL_PRIZES,
      effectivePrizes: await getEffectiveWheelPrizes(),
    });
  } catch (err) {
    next(err);
  }
});

app.patch('/api/admin/config', requireAdmin, async (req, res, next) => {
  try {
    const body = req.body || {};
    const allowed = {};
    for (const key of Object.keys(DEFAULT_ADMIN_CONFIG)) {
      if (body[key] !== undefined) allowed[key] = body[key];
    }
    if (allowed.wheelLuckMult != null) {
      allowed.wheelLuckMult = Math.min(5, Math.max(0.25, Number(allowed.wheelLuckMult) || 1));
    }
    for (const k of ['speedPlay', 'speedTraining', 'speedDodge', 'speedBoss', 'rudMultGlobal']) {
      if (allowed[k] != null) allowed[k] = Math.min(3, Math.max(0.25, Number(allowed[k]) || 1));
    }
    if (allowed.wheelSpinCost != null) {
      allowed.wheelSpinCost = Math.min(5000, Math.max(0, Math.floor(Number(allowed.wheelSpinCost) || 0)));
    }
    if (allowed.freeSpinHours != null) {
      allowed.freeSpinHours = Math.min(168, Math.max(1, Number(allowed.freeSpinHours) || 24));
    }
    if (allowed.trainingLevelInterval != null) {
      allowed.trainingLevelInterval = Math.min(60, Math.max(3, Number(allowed.trainingLevelInterval) || 9));
    }
    if (allowed.dodgeLevelInterval != null) {
      allowed.dodgeLevelInterval = Math.min(30, Math.max(2, Number(allowed.dodgeLevelInterval) || 4));
    }
    if (allowed.announcement != null) {
      allowed.announcement = String(allowed.announcement).slice(0, 280);
    }
    if (allowed.maintenanceMode != null) {
      allowed.maintenanceMode = !!allowed.maintenanceMode;
    }
    const config = await db.setAdminConfig(allowed);
    res.json({ config, effectivePrizes: await getEffectiveWheelPrizes() });
  } catch (err) {
    next(err);
  }
});

app.get('/api/admin/stats', requireAdmin, async (_req, res, next) => {
  try {
    const stats = await db.getAdminStats();
    res.json({ ...stats, config: await db.getAdminConfig() });
  } catch (err) {
    next(err);
  }
});

app.get('/api/admin/users', requireAdmin, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const rows = await db.searchUsers(q);
    res.json({ users: rows.map((u) => ({ ...u, isAdmin: !!u.is_admin })) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/users/:targetId/admin', requireAdmin, async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.targetId, 10);
    const grant = req.body.grant !== false;
    const target = await db.getUserAdminRow(targetId);
    if (!target) return res.status(404).json({ error: 'User not found.' });

    if (!grant) {
      const adminCount = await db.countAdmins();
      if (adminCount <= 1 && target.is_admin) {
        return res.status(400).json({ error: 'Cannot remove the last admin.' });
      }
      if (targetId === req.authUserId) {
        return res.status(400).json({ error: 'You cannot remove your own admin access.' });
      }
    }

    await db.setUserAdmin(targetId, grant);
    res.json({ userId: targetId, username: target.username, isAdmin: grant });
  } catch (err) {
    next(err);
  }
});

app.get('/api/admin/admins', requireAdmin, async (_req, res, next) => {
  try {
    res.json({ admins: await db.listAdmins() });
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/users/:targetId/rud', requireAdmin, async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.targetId, 10);
    const user = await db.getUser(targetId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (req.body.balance != null) {
      const balance = Math.max(0, Math.floor(Number(req.body.balance) || 0));
      await db.setUserBalance(targetId, balance);
    } else if (req.body.amount != null) {
      const amount = Math.floor(Number(req.body.amount) || 0);
      await db.adjustUserBalance(targetId, amount);
    } else {
      return res.status(400).json({ error: 'Provide amount or balance.' });
    }

    const updated = await db.getUser(targetId);
    res.json({ userId: targetId, balance: updated.rud_balance });
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/users/:targetId/grant', requireAdmin, async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.targetId, 10);
    if (!(await db.getUser(targetId))) return res.status(404).json({ error: 'User not found.' });

    const abilityId = String(req.body.abilityId || '');
    const skinId = String(req.body.skinId || '');

    if (abilityId) {
      if (!SHOP_ITEMS[abilityId] || SHOP_ITEMS[abilityId].secret) {
        return res.status(400).json({ error: 'Invalid ability.' });
      }
      const qty = Math.max(1, Math.floor(Number(req.body.quantity) || 1));
      await db.addInventory(targetId, abilityId, qty);
    } else if (skinId) {
      if (!SKINS[skinId] || SKINS[skinId].secret) {
        return res.status(400).json({ error: 'Invalid skin.' });
      }
      await db.addOwnedSkin(targetId, skinId);
    } else if (req.body.bonusSpins != null) {
      const n = Math.max(0, Math.floor(Number(req.body.bonusSpins) || 0));
      await db.addBonusSpins(targetId, n);
    } else {
      return res.status(400).json({ error: 'Provide abilityId, skinId, or bonusSpins.' });
    }

    res.json({
      userId: targetId,
      inventory: await db.getInventory(targetId),
      ownedSkins: await getOwnedSkins(targetId),
      wheelState: await getWheelState(targetId),
    });
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/users/:targetId/reset-spin', requireAdmin, async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.targetId, 10);
    if (!(await db.getUser(targetId))) return res.status(404).json({ error: 'User not found.' });
    await db.resetFreeSpin(targetId);
    res.json({ userId: targetId, wheelState: await getWheelState(targetId) });
  } catch (err) {
    next(err);
  }
});

app.post('/api/users/:id/buy-skin', requireAuth, (_req, res) => {
  res.status(403).json({ error: 'Purchases are disabled. Earn skins from the Spin tab.' });
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

app.post('/api/users/:id/buy', requireAuth, (_req, res) => {
  res.status(403).json({ error: 'Purchases are disabled. Earn skills from the Spin tab.' });
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

async function prepareServer() {
  db.getDatabaseUrl();
  await db.runMigrations();
  await ensureSecretEligibleAccounts();
  await db.seedAdminAccounts(Object.keys(ADMIN_ACCOUNTS));
}

async function start() {
  await prepareServer();
  app.listen(PORT, () => {
    console.log(`Beat Parry server running at http://localhost:${PORT}`);
    console.log('API routes: POST /api/auth/register, POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout');
    console.log('          GET /api/config, GET /api/wheel/prizes, GET /api/admin/*');
    console.log('          GET /api/users/:id, POST /api/users/:id/buy|buy-skin|equip-skin|consume|redeem|complete|spin, GET /api/leaderboard');
    console.log('Use "npm start" — not "npx serve" (serve has no API).');
  });
}

module.exports = { app, start, prepareServer };

if (require.main === module) {
  start().catch((err) => {
    console.error('[startup] failed', err);
    process.exit(1);
  });
}
