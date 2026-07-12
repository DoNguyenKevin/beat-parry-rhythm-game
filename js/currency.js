const USER_ID_KEY = 'beatParryUserId';
const USERNAME_KEY = 'beatParryUsername';

const GRADE_RUD_MULT = { S: 2, A: 1.6, B: 1.3, C: 1, D: 0.7, F: 0.4 };

const RUDWallet = {
  userId: null,
  username: '',
  balance: 0,
  bestScores: {},
  ready: false,

  getStoredUserId() {
    const raw = localStorage.getItem(USER_ID_KEY);
    return raw ? parseInt(raw, 10) : null;
  },

  getStoredUsername() {
    return localStorage.getItem(USERNAME_KEY) || '';
  },

  storeUser(id, username) {
    localStorage.setItem(USER_ID_KEY, String(id));
    localStorage.setItem(USERNAME_KEY, username);
    this.userId = id;
    this.username = username;
  },

  async api(path, options = {}) {
    const method = options.method || 'GET';
    console.log(`[RUDWallet] ${method} ${path}`, options.body ? JSON.parse(options.body) : '');

    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`[RUDWallet] ${method} ${path} failed: ${res.status}`, data);
      throw new Error(data.error || `Request failed (${res.status})`);
    }

    console.log(`[RUDWallet] ${method} ${path} ok`, data);
    return data;
  },

  applyProfile(data) {
    this.userId = data.id;
    this.username = data.username;
    this.balance = data.balance;
    this.bestScores = data.bestScores || {};
    this.storeUser(data.id, data.username);
    this.ready = true;
  },

  async init() {
    const storedId = this.getStoredUserId();
    const storedName = this.getStoredUsername();

    if (storedId && storedName) {
      try {
        const data = await this.api(`/api/users/${storedId}`);
        this.applyProfile(data);
        return { needsUsername: false };
      } catch {
        localStorage.removeItem(USER_ID_KEY);
      }
    }

    if (storedName) {
      try {
        const data = await this.api('/api/users', {
          method: 'POST',
          body: JSON.stringify({ username: storedName }),
        });
        this.applyProfile(data);
        return { needsUsername: false };
      } catch {
        localStorage.removeItem(USERNAME_KEY);
      }
    }

    return { needsUsername: true };
  },

  async register(username) {
    const data = await this.api('/api/users', {
      method: 'POST',
      body: JSON.stringify({ username: username.trim() }),
    });
    this.applyProfile(data);
    return data;
  },

  getBestScore(songId) {
    return this.bestScores[songId] || 0;
  },

  previewReward({ score, grade, isTraining, isDodge, trainingLevel, songId, dodged = 0 }) {
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

    if (songId) {
      const prev = this.getBestScore(songId);
      if (score > prev) {
        isNewBest = true;
        if (prev === 0) {
          bonus = Math.max(5, Math.floor(base * 0.5));
        } else {
          bonus = Math.max(3, Math.floor((score - prev) / 150));
        }
      }
    }

    const earned = Math.max(1, base + bonus);
    return { earned, base, bonus, isNewBest };
  },

  async completeGame(payload) {
    if (!this.userId) {
      throw new Error('No user loaded.');
    }

    const data = await this.api(`/api/users/${this.userId}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    this.balance = data.balance;
    this.bestScores = data.bestScores || this.bestScores;
    return data;
  },
};
