const DEFAULT_SKIN_ID = 'default';

const SKINS = {
  default: {
    id: 'default',
    name: 'Classic',
    description: 'The original Beat Parry look. Boss weapon: Pulse Blaster.',
    price: 0,
    tier: 0,
    icon: '⚪',
    colors: { primary: '#ff6b9d', glow: '#ff6b9d', accent: '#ffffff' },
    passives: {},
  },
  'skin-neon': {
    id: 'skin-neon',
    name: 'Neon Pulse',
    description: 'Passive: +8% score. Boss weapon: Neon Rifle.',
    price: 350,
    tier: 1,
    icon: '💠',
    colors: { primary: '#00e5ff', glow: '#00ffcc', accent: '#b3ffff' },
    passives: { scoreMult: 1.08 },
  },
  'skin-emerald': {
    id: 'skin-emerald',
    name: 'Emerald Guard',
    description: 'Passive: +12% timing. Boss weapon: Emerald Cannon.',
    price: 600,
    tier: 2,
    icon: '💚',
    colors: { primary: '#4dff88', glow: '#2dd4bf', accent: '#c8ffe0' },
    passives: { windowMult: 1.12 },
  },
  'skin-solar': {
    id: 'skin-solar',
    name: 'Solar Crown',
    description: 'Passive: +15% RUD. Boss weapon: Solar Lance.',
    price: 900,
    tier: 3,
    icon: '👑',
    colors: { primary: '#ffd700', glow: '#ff9900', accent: '#fff4b8' },
    passives: { rudMult: 1.15 },
  },
  'skin-inferno': {
    id: 'skin-inferno',
    name: 'Inferno Core',
    description: 'Passive: +20% score, +10 combo cap. Boss weapon: Inferno Shotgun.',
    price: 1400,
    tier: 4,
    icon: '🔥',
    colors: { primary: '#ff5533', glow: '#ff8800', accent: '#ffcc99' },
    passives: { scoreMult: 1.2, comboCapBonus: 10 },
  },
  'skin-fortune-crown': {
    id: 'skin-fortune-crown',
    name: 'Fortune Crown',
    description: 'Spin exclusive — +25% score, +20% RUD, +15% timing, +15 combo cap, +15 dodge HP, golden trail. Boss weapon: Golden Reaper. (Only Void God is stronger.)',
    price: 0,
    tier: 5,
    spinOnly: true,
    effect: 'fortune',
    icon: '👑',
    colors: {
      primary: '#ffd700',
      glow: '#ff9900',
      accent: '#fff8dc',
      ring: '#daa520',
      crown: '#ffec8b',
      shimmer: '#fffacd',
      coin: '#f0c040',
    },
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
    id: 'skin-void-god',
    name: 'Void God',
    description: 'MEGA OP — +30% score/RUD, +20% timing, +30 dodge HP, cosmic trail. Boss weapon: Cosmic Pistol.',
    price: 0,
    tier: 5,
    secret: true,
    effect: 'cosmic',
    icon: '🌌',
    colors: {
      primary: '#10002b',
      glow: '#e040fb',
      accent: '#b8f0ff',
      ring: '#40c4ff',
      nebula: '#7b2cbf',
      core: '#e8f4ff',
    },
    passives: {
      scoreMult: 1.3,
      rudMult: 1.3,
      windowMult: 1.2,
      comboCapBonus: 20,
      dodgeHealthBonus: 30,
      trail: true,
    },
  },
};

const SKIN_EQUIPPED_KEY = 'beatParryEquippedSkin';

function getSkin(id) {
  return SKINS[id] || SKINS[DEFAULT_SKIN_ID];
}

function getSkinList() {
  return Object.values(SKINS).sort((a, b) => a.tier - b.tier || a.price - b.price);
}

function formatSkinPassives(passives = {}, options = {}) {
  const parts = [];
  if (passives.scoreMult) parts.push(`+${Math.round((passives.scoreMult - 1) * 100)}% score`);
  if (passives.windowMult) parts.push(`+${Math.round((passives.windowMult - 1) * 100)}% timing`);
  if (passives.rudMult) parts.push(`+${Math.round((passives.rudMult - 1) * 100)}% RUD`);
  if (passives.comboCapBonus) parts.push(`+${passives.comboCapBonus} combo cap`);
  if (passives.dodgeHealthBonus) parts.push(`+${passives.dodgeHealthBonus} dodge HP`);
  if (passives.trail) parts.push(options.effect === 'fortune' ? 'golden trail' : 'void trail');
  return parts.length ? parts.join(' · ') : 'No bonus';
}

const Skins = {
  owned: [DEFAULT_SKIN_ID],
  equipped: DEFAULT_SKIN_ID,

  getSkin,
  getList: getSkinList,

  loadEquipped() {
    try {
      const raw = localStorage.getItem(SKIN_EQUIPPED_KEY);
      this.equipped = raw && SKINS[raw] ? raw : DEFAULT_SKIN_ID;
    } catch {
      this.equipped = DEFAULT_SKIN_ID;
    }
  },

  saveEquipped() {
    localStorage.setItem(SKIN_EQUIPPED_KEY, this.equipped);
  },

  setOwned(ids) {
    const set = new Set([DEFAULT_SKIN_ID, ...(Array.isArray(ids) ? ids : [])]);
    this.owned = [...set];
  },

  setEquipped(id) {
    if (!this.owns(id)) return false;
    this.equipped = id;
    this.saveEquipped();
    return true;
  },

  owns(skinId) {
    if (skinId === DEFAULT_SKIN_ID) return true;
    const skin = SKINS[skinId];
    if (!skin) return false;
    if (skinId === 'skin-void-god' && typeof Shop !== 'undefined' && Shop.isSecretUnlocked('op-overdrive')) {
      return true;
    }
    if (skin.secret && typeof Shop !== 'undefined' && Shop.isSecretUnlocked(skinId)) return true;
    return this.owned.includes(skinId);
  },

  isEquipped(skinId) {
    return this.equipped === skinId;
  },

  getEquipped() {
    return this.owns(this.equipped) ? this.equipped : DEFAULT_SKIN_ID;
  },

  getEquippedData() {
    return getSkin(this.getEquipped());
  },

  async buy() {
    throw new Error('Purchases are disabled. Earn skins from the Spin tab.');
  },

  async equip(skinId) {
    if (!this.owns(skinId)) throw new Error('You do not own this skin.');
    if (RUDWallet.userId) {
      try {
        const data = await RUDWallet.api(`/api/users/${RUDWallet.userId}/equip-skin`, {
          method: 'POST',
          body: JSON.stringify({ skinId }),
        });
        this.equipped = data.equippedSkin || skinId;
      } catch (err) {
        if (!err.message.includes('No route')) throw err;
        this.equipped = skinId;
      }
    } else {
      this.equipped = skinId;
    }
    this.saveEquipped();
    return this.equipped;
  },
};

Skins.loadEquipped();
