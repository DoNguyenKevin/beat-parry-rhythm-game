const SHOP_ITEMS = {
  'wide-window': {
    id: 'wide-window',
    name: 'Steady Hands',
    description: 'Wider parry timing windows for one run.',
    price: 120,
    modes: ['play', 'training'],
    icon: '🎯',
  },
  'combo-shield': {
    id: 'combo-shield',
    name: 'Combo Shield',
    description: 'First miss or bad hit in a song ignores score loss and keeps combo.',
    price: 180,
    modes: ['play'],
    icon: '🛡️',
  },
  'score-boost': {
    id: 'score-boost',
    name: 'Score Boost',
    description: '+25% score from all hits for one song.',
    price: 200,
    modes: ['play'],
    icon: '⚡',
  },
  'slow-start': {
    id: 'slow-start',
    name: 'Calm Start',
    description: 'Training notes move 20% slower for the first 45 seconds.',
    price: 100,
    modes: ['training'],
    icon: '🐢',
  },
  'second-chance': {
    id: 'second-chance',
    name: 'Second Chance',
    description: 'Your first miss counts as a medium hit instead.',
    price: 150,
    modes: ['play', 'training'],
    icon: '♻️',
  },
  'rud-magnet': {
    id: 'rud-magnet',
    name: 'RUD Magnet',
    description: '+20% RUD earned from the run. Works in Play, Training, and Dodge.',
    price: 250,
    modes: ['play', 'training', 'dodge', 'boss'],
    icon: '🧲',
  },
  'ghost-phase': {
    id: 'ghost-phase',
    name: 'Ghost Phase',
    description: 'First bullet hit in Dodge is ignored.',
    price: 180,
    modes: ['dodge', 'boss'],
    icon: '👻',
  },
  'long-warning': {
    id: 'long-warning',
    name: 'Early Warning',
    description: 'Dodge warning lines last 40% longer.',
    price: 140,
    modes: ['dodge', 'boss'],
    icon: '⚠️',
  },
  'op-overdrive': {
    id: 'op-overdrive',
    name: 'Overdrive',
    description: 'Press SPACE — Dodge: shock wave destroys all bullets. Parry: every note on screen becomes Excellent.',
    price: 0,
    secret: true,
    modes: ['play', 'training', 'dodge', 'boss'],
    icon: '💥',
  },
  'op-void-dash': {
    id: 'op-void-dash',
    name: 'Void Dash',
    description: 'Press V — Dodge: teleport randomly (invincible while dashing). Parry: skip ahead — all skipped notes count as Excellent.',
    price: 0,
    secret: true,
    modes: ['play', 'training', 'dodge', 'boss'],
    icon: '🌀',
  },
};

const SECRET_CODES = {
  '0968127380': ['op-overdrive', 'op-void-dash', 'skin-void-god'],
};

const OVERDRIVE_ID = 'op-overdrive';
const OVERDRIVE_BONUS_ID = 'op-void-dash';

function expandSecretUnlocks(ids) {
  const set = new Set(Array.isArray(ids) ? ids : []);
  if (set.has(OVERDRIVE_ID)) set.add(OVERDRIVE_BONUS_ID);
  return [...set];
}

function expandRunAbilities(abilities) {
  return Array.isArray(abilities) ? [...abilities] : [];
}

const UNLOCK_KEY = 'beatParrySecretUnlocks';
const LOADOUT_KEY = 'beatParryLoadout';
const MAX_EQUIPPED = 2;

const Shop = {
  inventory: {},
  equipped: [],
  secretUnlocks: [],

  getItems() {
    return Object.values(SHOP_ITEMS);
  },

  getItem(id) {
    return SHOP_ITEMS[id] || null;
  },

  loadSecrets() {
    try {
      const raw = localStorage.getItem(UNLOCK_KEY);
      this.secretUnlocks = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(this.secretUnlocks)) this.secretUnlocks = [];
      this.secretUnlocks = expandSecretUnlocks(this.secretUnlocks);
      this.saveSecrets();
    } catch {
      this.secretUnlocks = [];
    }
  },

  saveSecrets() {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify(this.secretUnlocks));
  },

  setSecretUnlocks(ids) {
    this.secretUnlocks = expandSecretUnlocks(ids);
    this.saveSecrets();
    this.ensureSecretLoadout();
  },

  isSecretUnlocked(abilityId) {
    if (abilityId === OVERDRIVE_BONUS_ID && this.secretUnlocks.includes(OVERDRIVE_ID)) return true;
    return this.secretUnlocks.includes(abilityId);
  },

  isCodeRewardOwned(id) {
    if (typeof SKINS !== 'undefined' && SKINS[id]?.secret && typeof Skins !== 'undefined') {
      return Skins.owns(id);
    }
    return this.isSecretUnlocked(id);
  },

  loadLoadout() {
    try {
      const raw = localStorage.getItem(LOADOUT_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      this.equipped = Array.isArray(parsed) ? parsed : [];
    } catch {
      this.equipped = [];
    }
    this.ensureSecretLoadout();
  },

  ensureSecretLoadout() {
    const secrets = [OVERDRIVE_ID, OVERDRIVE_BONUS_ID];
    const unlocked = secrets.filter((id) => this.isSecretUnlocked(id));
    if (!unlocked.length) return;

    const hasAnyEquipped = unlocked.some((id) => this.equipped.includes(id));
    if (!hasAnyEquipped) return;

    let changed = false;
    for (const id of unlocked) {
      if (!this.equipped.includes(id)) {
        this.equipped.push(id);
        changed = true;
      }
    }
    if (changed) this.saveLoadout();
  },

  equipUnlockedSecrets(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    let changed = false;
    for (const id of list) {
      const item = SHOP_ITEMS[id];
      if (!item?.secret || this.getQuantity(id) <= 0) continue;
      if (!this.equipped.includes(id)) {
        this.equipped.push(id);
        changed = true;
      }
    }
    if (changed) this.saveLoadout();
  },

  saveLoadout() {
    localStorage.setItem(LOADOUT_KEY, JSON.stringify(this.equipped));
  },

  setInventory(inventory) {
    this.inventory = inventory || {};
  },

  getQuantity(abilityId) {
    const item = SHOP_ITEMS[abilityId];
    if (item?.secret && this.isSecretUnlocked(abilityId)) return 1;
    return this.inventory[abilityId] || 0;
  },

  isEquipped(abilityId) {
    return this.equipped.includes(abilityId);
  },

  toggleEquip(abilityId) {
    if (this.isEquipped(abilityId)) {
      this.equipped = this.equipped.filter((id) => id !== abilityId);
    } else {
      const item = SHOP_ITEMS[abilityId];
      if (!item?.secret) {
        const consumableCount = this.equipped.filter((id) => !SHOP_ITEMS[id]?.secret).length;
        if (consumableCount >= MAX_EQUIPPED) return false;
      }
      if (this.getQuantity(abilityId) <= 0) return false;
      this.equipped.push(abilityId);
    }
    this.saveLoadout();
    return true;
  },

  countConsumableEquipped() {
    return this.equipped.filter((id) => !SHOP_ITEMS[id]?.secret).length;
  },

  canEquip(abilityId) {
    if (this.getQuantity(abilityId) <= 0) return false;
    if (this.isEquipped(abilityId)) return true;
    const item = SHOP_ITEMS[abilityId];
    if (item?.secret) return true;
    return this.countConsumableEquipped() < MAX_EQUIPPED;
  },

  getEquippedForMode(mode) {
    return this.equipped.filter((id) => {
      const item = SHOP_ITEMS[id];
      return item && item.modes.includes(mode) && this.getQuantity(id) > 0;
    });
  },

  async buy(abilityId) {
    if (!RUDWallet.userId) throw new Error('Log in first.');
    const item = SHOP_ITEMS[abilityId];
    if (!item || item.secret) throw new Error('This ability cannot be purchased.');
    const data = await RUDWallet.api(`/api/users/${RUDWallet.userId}/buy`, {
      method: 'POST',
      body: JSON.stringify({ abilityId }),
    });
    RUDWallet.balance = data.balance;
    this.setInventory(data.inventory);
    return data;
  },

  async redeemCode(code) {
    const trimmed = String(code || '').trim();
    const mapped = SECRET_CODES[trimmed];
    if (!mapped) throw new Error('Invalid code.');
    if (!RUDWallet.userId || !RUDWallet.token) {
      throw new Error('Log in to redeem secret codes.');
    }
    if (!RUDWallet.canRedeemSecrets) {
      throw new Error('Your account cannot redeem secret codes.');
    }
    const rewardIds = Array.isArray(mapped) ? mapped : [mapped];
    const missing = rewardIds.filter((id) => !this.isCodeRewardOwned(id));
    if (!missing.length) throw new Error('Code already redeemed.');

    try {
      const data = await RUDWallet.api(`/api/users/${RUDWallet.userId}/redeem`, {
        method: 'POST',
        body: JSON.stringify({ code: trimmed }),
      });
      if (data.secretUnlocks) {
        this.setSecretUnlocks(data.secretUnlocks);
      } else {
        for (const id of missing) {
          if (!this.isSecretUnlocked(id)) {
            this.secretUnlocks.push(id);
          }
        }
        this.saveSecrets();
      }
      if (data.inventory) this.setInventory(data.inventory);
      if (data.ownedSkins && typeof Skins !== 'undefined') {
        Skins.setOwned(data.ownedSkins);
      }
      const unlocked = [...(data.abilityIds || []), ...(data.skinIds || [])];
      this.equipUnlockedSecrets(unlocked.filter((id) => SHOP_ITEMS[id]));
      return unlocked.length ? unlocked : missing;
    } catch (err) {
      if (err.message.includes('Code already redeemed')) {
        const profile = await RUDWallet.api(`/api/users/${RUDWallet.userId}`);
        RUDWallet.applyProfile(profile);
        const stillMissing = rewardIds.filter((id) => !this.isCodeRewardOwned(id));
        if (!stillMissing.length) {
          return rewardIds.filter((id) => SHOP_ITEMS[id] || SKINS[id]);
        }
      }
      throw err;
    }
  },

  async consumeForRun(mode) {
    const equipped = this.getEquippedForMode(mode);
    const secrets = equipped.filter((id) => SHOP_ITEMS[id]?.secret && this.isSecretUnlocked(id));
    const consumable = equipped.filter((id) => !secrets.includes(id));

    let abilities = [...secrets];
    if (consumable.length) {
      const data = await RUDWallet.api(`/api/users/${RUDWallet.userId}/consume`, {
        method: 'POST',
        body: JSON.stringify({ abilityIds: consumable, mode }),
      });
      RUDWallet.balance = data.balance;
      this.setInventory(data.inventory);
      this.equipped = this.equipped.filter((id) => (data.inventory[id] || 0) > 0 || this.isSecretUnlocked(id));
      this.saveLoadout();
      abilities = [...abilities, ...(data.abilities || [])];
    }

    return { abilities: expandRunAbilities(abilities), inventory: this.inventory };
  },
};

Shop.loadSecrets();
Shop.loadLoadout();
