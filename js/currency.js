const USER_ID_KEY = 'beatParryUserId';
const USERNAME_KEY = 'beatParryUsername';
const TOKEN_KEY = 'beatParryAuthToken';

const GRADE_RUD_MULT = { S: 2, A: 1.6, B: 1.3, C: 1, D: 0.7, F: 0.4 };

const RUD_SHORT_SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

function formatRudShort(value) {
  const num = Number(value) || 0;
  if (!Number.isFinite(num)) return '0';
  const abs = Math.abs(num);
  if (abs < 10_000) return num.toLocaleString();

  const tier = Math.min(
    RUD_SHORT_SUFFIXES.length - 1,
    Math.floor(Math.log10(abs) / 3)
  );
  const scaled = num / 10 ** (tier * 3);
  const decimals = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
  const text = scaled.toFixed(decimals).replace(/\.?0+$/, '');
  return `${text}${RUD_SHORT_SUFFIXES[tier]}`;
}

const RUDWallet = {
  userId: null,
  username: '',
  balance: 0,
  bestScores: {},
  token: null,
  ready: false,
  canRedeemSecrets: false,
  isAdmin: false,

  getStoredUserId() {
    const raw = localStorage.getItem(USER_ID_KEY);
    return raw ? parseInt(raw, 10) : null;
  },

  getStoredUsername() {
    return localStorage.getItem(USERNAME_KEY) || '';
  },

  getStoredToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  },

  storeSession(id, username, token) {
    localStorage.setItem(USER_ID_KEY, String(id));
    localStorage.setItem(USERNAME_KEY, username);
    if (token) localStorage.setItem(TOKEN_KEY, token);
    this.userId = id;
    this.username = username;
    this.token = token || null;
  },

  clearSession() {
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USERNAME_KEY);
    localStorage.removeItem(TOKEN_KEY);
    this.userId = null;
    this.username = '';
    this.token = null;
    this.balance = 0;
    this.bestScores = {};
    this.ready = false;
    this.canRedeemSecrets = false;
    this.isAdmin = false;
    if (typeof Shop !== 'undefined') {
      Shop.setSecretUnlocks([]);
    }
  },

  authHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    return headers;
  },

  async api(path, options = {}) {
    const method = options.method || 'GET';
    console.log(`[RUDWallet] ${method} ${path}`, options.body ? JSON.parse(options.body) : '');

    const res = await fetch(path, {
      cache: 'no-store',
      ...options,
      headers: {
        ...this.authHeaders(),
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`[RUDWallet] ${method} ${path} failed: ${res.status}`, data);
      if (res.status === 401 && this.token) {
        this.clearSession();
      }
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
    this.canRedeemSecrets = !!data.canRedeemSecrets;
    this.isAdmin = !!data.isAdmin;
    this.storeSession(data.id, data.username, data.token || this.token);
    this.ready = true;
    if (typeof Shop !== 'undefined') {
      Shop.setInventory(data.inventory || {});
      if (this.canRedeemSecrets) {
        Shop.setSecretUnlocks(data.secretUnlocks || []);
      } else {
        Shop.setSecretUnlocks([]);
      }
    }
    if (typeof Skins !== 'undefined') {
      if (data.ownedSkins) Skins.setOwned(data.ownedSkins);
      if (data.equippedSkin && SKINS[data.equippedSkin]) {
        Skins.equipped = data.equippedSkin;
        Skins.saveEquipped();
      }
    }
    if (typeof PrizeWheel !== 'undefined') {
      PrizeWheel.setWheelState({
        freeSpinAvailable: data.freeSpinAvailable,
        wheelBonusSpins: data.wheelBonusSpins,
        nextFreeSpinAt: data.nextFreeSpinAt,
        spinCost: data.spinCost,
      });
    }
    if (typeof AdminPanel !== 'undefined') {
      AdminPanel.setVisible(!!data.isAdmin);
    }
  },

  async init() {
    const storedToken = this.getStoredToken();
    if (storedToken) {
      this.token = storedToken;
      try {
        const data = await this.api('/api/auth/me');
        this.applyProfile(data);
        return { needsAuth: false };
      } catch {
        this.clearSession();
      }
    }

    return { needsAuth: true };
  },

  async register(username, password) {
    const data = await this.api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username: username.trim(), password }),
    });
    this.applyProfile(data);
    return data;
  },

  async login(username, password) {
    const data = await this.api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: username.trim(), password }),
    });
    this.applyProfile(data);
    return data;
  },

  async logout() {
    try {
      if (this.token) {
        await this.api('/api/auth/logout', { method: 'POST' });
      }
    } catch {
      // still clear locally
    }
    this.clearSession();
  },

  getBestScore(songId) {
    return this.bestScores[songId] || 0;
  },

  previewReward({ score, grade, isTraining, isDodge, isBoss, isNightmare, trainingLevel, bossRound = 0, songId, dodged = 0, timeSurvived = 0, activeAbilities = [], skinId = 'default' }) {
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
      base = typeof NIGHTMARE_S_RUD !== 'undefined' ? NIGHTMARE_S_RUD : 10000;
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

    let earned = isNightmare && grade === 'S' ? 10000 : Math.max(1, base + bonus);
    if (earned > 0 && Array.isArray(activeAbilities) && activeAbilities.includes('rud-magnet')) {
      earned = Math.floor(earned * 1.2);
    }
    if (earned > 0 && typeof Skins !== 'undefined') {
      const passives = Skins.getSkin(skinId)?.passives || {};
      if (passives.rudMult) earned = Math.floor(earned * passives.rudMult);
    }
    return { earned, base, bonus, isNewBest };
  },

  async completeGame(payload) {
    if (!this.userId || !this.token) {
      throw new Error('Log in to save RUD.');
    }

    const data = await this.api(`/api/users/${this.userId}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    this.balance = data.balance;
    this.bestScores = data.bestScores || this.bestScores;
    if (typeof Shop !== 'undefined' && data.inventory) {
      Shop.setInventory(data.inventory);
    }
    return data;
  },
};
