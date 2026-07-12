const fs = require('fs');
const path = require('path');
const express = require('express');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'beat-parry.db');

const GRADE_RUD_MULT = { S: 2, A: 1.6, B: 1.3, C: 1, D: 0.7, F: 0.4 };

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
`);

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

function calculateReward({ score, grade, isTraining, isDodge, trainingLevel, songId, userId, dodged = 0 }) {
  if (score <= 0 && dodged <= 0) {
    return { earned: 0, base: 0, bonus: 0, isNewBest: false };
  }

  let base;
  if (isDodge) {
    base = Math.floor(score / 140) + (trainingLevel || 1) * 5 + Math.floor((dodged || 0) / 3);
  } else if (isTraining) {
    base = Math.floor(score / 200) + (trainingLevel || 1) * 2;
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

  const earned = Math.max(1, base + bonus);
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

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/users', (req, res) => {
  const username = String(req.body.username || '').trim();
  console.log(`[api/users] register/login username="${username}"`);

  if (!username || username.length < 2 || username.length > 20) {
    console.log(`[api/users] rejected: invalid length (${username.length})`);
    return res.status(400).json({ error: 'Username must be 2–20 characters.' });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    console.log(`[api/users] rejected: invalid characters`);
    return res.status(400).json({ error: 'Username may only use letters, numbers, _ and -.' });
  }

  let user = db.prepare('SELECT id, username, rud_balance FROM users WHERE username = ? COLLATE NOCASE')
    .get(username);

  if (!user) {
    const result = db.prepare('INSERT INTO users (username) VALUES (?)').run(username);
    user = getUser(result.lastInsertRowid);
    console.log(`[api/users] created user id=${user.id} username="${user.username}"`);
  } else {
    console.log(`[api/users] existing user id=${user.id} username="${user.username}" balance=${user.rud_balance}`);
  }

  res.json({
    id: user.id,
    username: user.username,
    balance: user.rud_balance,
    bestScores: getBestScores(user.id),
  });
});

app.get('/api/users/:id', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  res.json({
    id: user.id,
    username: user.username,
    balance: user.rud_balance,
    bestScores: getBestScores(user.id),
  });
});

app.post('/api/users/:id/complete', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const {
    score = 0,
    grade = null,
    songId = null,
    isTraining = false,
    isDodge = false,
    trainingLevel = 1,
    dodged = 0,
  } = req.body;

  const reward = calculateReward({
    score: Number(score) || 0,
    grade,
    isTraining: !!isTraining,
    isDodge: !!isDodge,
    trainingLevel: Number(trainingLevel) || 1,
    dodged: Number(dodged) || 0,
    songId: songId || null,
    userId,
  });

  let balance = user.rud_balance;
  if (reward.earned > 0) {
    db.prepare('UPDATE users SET rud_balance = rud_balance + ? WHERE id = ?')
      .run(reward.earned, userId);
    balance += reward.earned;
  }

  res.json({
    ...reward,
    balance,
    bestScores: getBestScores(userId),
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

app.listen(PORT, () => {
  console.log(`Beat Parry server running at http://localhost:${PORT}`);
  console.log(`API routes: POST /api/users, GET /api/users/:id, POST /api/users/:id/complete, GET /api/leaderboard`);
  console.log(`Use "npm start" — not "npx serve" (serve has no API).`);
});
