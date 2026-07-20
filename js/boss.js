const BOSS_MAX_ROUNDS = 99;
const BOSS_PLAYER_HEALTH = 100;
const BOSS_HIT_DAMAGE = 18;
const BOSS_STUN_MS = 2800;
const BOSS_ROUND_CLEAR_MS = 1400;

const BOSS_MODE = {
  id: 'boss-fight',
  name: 'Boss Fight',
  description: 'Cursor movement · auto-aim guns from your skin · beat the boss each round.',
  isBoss: true,
  endless: true,
  bpm: 100,
  duration: 3600,
  color: '#c77dff',
  bassFreq: 42,
  melodyScale: [0, 4, 7, 11],
  startLevel: 1,
};

const BOSS_WEAPONS = {
  default: {
    id: 'pulse-blaster',
    name: 'Pulse Blaster',
    damage: 9,
    fireRate: 0.24,
    projectileSpeed: 880,
    projectileSize: 5,
    color: '#ff6b9d',
    glow: '#ff9ec7',
    spread: 0,
    burst: 1,
  },
  'skin-neon': {
    id: 'neon-rifle',
    name: 'Neon Rifle',
    damage: 11,
    fireRate: 0.21,
    projectileSpeed: 940,
    projectileSize: 5,
    color: '#00e5ff',
    glow: '#00ffcc',
    spread: 0.04,
    burst: 1,
  },
  'skin-emerald': {
    id: 'emerald-cannon',
    name: 'Emerald Cannon',
    damage: 14,
    fireRate: 0.19,
    projectileSpeed: 980,
    projectileSize: 6,
    color: '#4dff88',
    glow: '#2dd4bf',
    spread: 0.03,
    burst: 1,
  },
  'skin-solar': {
    id: 'solar-lance',
    name: 'Solar Lance',
    damage: 17,
    fireRate: 0.17,
    projectileSpeed: 1020,
    projectileSize: 6,
    color: '#ffd700',
    glow: '#ff9900',
    spread: 0.05,
    burst: 2,
  },
  'skin-inferno': {
    id: 'inferno-shotgun',
    name: 'Inferno Shotgun',
    damage: 12,
    fireRate: 0.28,
    projectileSpeed: 860,
    projectileSize: 5,
    color: '#ff5533',
    glow: '#ff8800',
    spread: 0.22,
    burst: 4,
  },
  'skin-fortune-crown': {
    id: 'golden-reaper',
    name: 'Golden Reaper',
    damage: 24,
    fireRate: 0.13,
    projectileSpeed: 1100,
    projectileSize: 6,
    color: '#ffd700',
    glow: '#ff9900',
    spread: 0.08,
    burst: 2,
    fortune: true,
  },
  'skin-void-god': {
    id: 'cosmic-pistol',
    name: 'Cosmic Pistol',
    damage: 38,
    fireRate: 0.11,
    projectileSpeed: 1280,
    projectileSize: 7,
    color: '#e040fb',
    glow: '#b8f0ff',
    spread: 0.06,
    burst: 2,
    cosmic: true,
    pierce: true,
  },
  'skin-juggernaut': {
    id: 'siege-breaker',
    name: 'Siege Breaker',
    damage: 23,
    fireRate: 0.14,
    projectileSpeed: 1040,
    projectileSize: 7,
    color: '#ff5500',
    glow: '#ffcc44',
    spread: 0.04,
    burst: 2,
    juggernaut: true,
  },
  'skin-electric': {
    id: 'volt-lance',
    name: 'Volt Lance',
    damage: 18,
    fireRate: 0.16,
    projectileSpeed: 980,
    projectileSize: 6,
    color: '#44ddff',
    glow: '#cc88ff',
    spread: 0.05,
    burst: 2,
    electric: true,
  },
};

const JUGGERNAUT_BOSS = {
  name: 'THE JUGGERNAUT',
  color: '#ff2200',
  glow: '#ff8800',
  accent: '#ffd700',
  radius: 78,
  health: 8200,
  signature: 'Armageddon Protocol',
  attackInterval: 0.42,
  projectileSpeedMult: 1.35,
  minionBurstEvery: 2.8,
};

const ELECTRIC_RAID_BOSS = {
  name: 'STORM COLOSSUS',
  color: '#22ccff',
  glow: '#aa66ff',
  accent: '#e8f8ff',
  radius: 86,
  health: 12800,
  signature: 'Hyperion Cascade',
  attackInterval: 0.32,
  projectileSpeedMult: 1.55,
  minionBurstEvery: 1.9,
};

function createBossMode() {
  return { ...BOSS_MODE };
}

function getBossWeapon(skinId) {
  return BOSS_WEAPONS[skinId] || BOSS_WEAPONS.default;
}

function createJuggernautBossState(centerX, canvasHeight) {
  return {
    x: centerX,
    y: canvasHeight * 0.26,
    radius: JUGGERNAUT_BOSS.radius,
    health: JUGGERNAUT_BOSS.health,
    maxHealth: JUGGERNAUT_BOSS.health,
    name: JUGGERNAUT_BOSS.name,
    color: JUGGERNAUT_BOSS.color,
    glow: JUGGERNAUT_BOSS.glow,
    accent: JUGGERNAUT_BOSS.accent,
    round: 99,
    signature: JUGGERNAUT_BOSS.signature,
    wobblePhase: 0,
    eyeCloseT: 0,
    juggernaut: true,
    platePhase: 0,
    ragePulse: 0,
  };
}

function getJuggernautRoundKit() {
  return {
    round: 99,
    signature: JUGGERNAUT_BOSS.signature,
    signatureType: 'summon',
    attacks: [
      { type: 'barrage', weight: 4 },
      { type: 'spiral', weight: 4 },
      { type: 'crossfire', weight: 4 },
      { type: 'ring', weight: 3 },
      { type: 'summon', weight: 6, minionType: 'brute', count: 3 },
      { type: 'summon', weight: 5, minionType: 'hunter', count: 4 },
      { type: 'summon', weight: 5, minionType: 'swarm', count: 10 },
    ],
  };
}

function createElectricRaidBossState(centerX, canvasHeight) {
  return {
    x: centerX,
    y: canvasHeight * 0.24,
    radius: ELECTRIC_RAID_BOSS.radius,
    health: ELECTRIC_RAID_BOSS.health,
    maxHealth: ELECTRIC_RAID_BOSS.health,
    name: ELECTRIC_RAID_BOSS.name,
    color: ELECTRIC_RAID_BOSS.color,
    glow: ELECTRIC_RAID_BOSS.glow,
    accent: ELECTRIC_RAID_BOSS.accent,
    round: 100,
    signature: ELECTRIC_RAID_BOSS.signature,
    wobblePhase: 0,
    eyeCloseT: 0,
    electricRaid: true,
    arcPhase: 0,
  };
}

function getElectricRaidRoundKit() {
  return {
    round: 100,
    signature: ELECTRIC_RAID_BOSS.signature,
    signatureType: 'spiral',
    attacks: [
      { type: 'spiral', weight: 5 },
      { type: 'barrage', weight: 5 },
      { type: 'crossfire', weight: 5 },
      { type: 'ring', weight: 4 },
      { type: 'summon', weight: 7, minionType: 'hunter', count: 5 },
      { type: 'summon', weight: 6, minionType: 'brute', count: 4 },
      { type: 'summon', weight: 6, minionType: 'swarm', count: 12 },
    ],
  };
}

function getBossRoundHealth(round) {
  return Math.floor(420 + round * 280 + Math.pow(round, 1.35) * 90);
}

function getBossAttackInterval(round) {
  return Math.max(0.55, 1.35 - round * 0.045);
}

function getBossProjectileSpeed(round) {
  return 520 + round * 42;
}

function getBossName(round) {
  const names = ['Void Warden', 'Nebula Tyrant', 'Star Reaver', 'Cosmic Devourer', 'Abyss Sovereign'];
  if (round <= names.length) return names[round - 1];
  return `Void Emperor ${round}`;
}

function getBossColor(round) {
  const palette = ['#c77dff', '#ff6bcb', '#40c4ff', '#ff5533', '#7b2cbf'];
  return palette[(round - 1) % palette.length];
}

function getBossRadius(round) {
  return 46 + Math.min(24, round * 2);
}

const BOSS_MINION_TYPES = {
  drone: {
    name: 'Void Drone',
    health: 26,
    size: 14,
    speed: 150,
    touchDamage: 12,
    color: '#ff6bcb',
    glow: '#ff9ed6',
    chase: true,
  },
  striker: {
    name: 'Star Striker',
    health: 34,
    size: 16,
    speed: 72,
    touchDamage: 10,
    color: '#40c4ff',
    glow: '#9de8ff',
    shooter: true,
    fireRate: 1.7,
    projectileSpeed: 480,
  },
  brute: {
    name: 'Nebula Brute',
    health: 52,
    size: 20,
    speed: 105,
    touchDamage: 16,
    color: '#ff5533',
    glow: '#ff9977',
    chase: true,
  },
  swarm: {
    name: 'Cosmic Mote',
    health: 12,
    size: 10,
    speed: 195,
    touchDamage: 8,
    color: '#c77dff',
    glow: '#e8c4ff',
    chase: true,
  },
  hunter: {
    name: 'Void Hunter',
    health: 40,
    size: 15,
    speed: 130,
    touchDamage: 14,
    color: '#7b2cbf',
    glow: '#e040fb',
    chase: true,
    shooter: true,
    fireRate: 2.4,
    projectileSpeed: 520,
  },
};

const BOSS_ROUND_KITS = [
  { round: 1, signature: 'Void Snipe', signatureType: 'aimed', attacks: [{ type: 'aimed', weight: 5 }] },
  { round: 2, signature: 'Shard Burst', signatureType: 'spread', attacks: [{ type: 'aimed', weight: 2 }, { type: 'spread', weight: 4 }] },
  {
    round: 3,
    signature: 'Minion Call',
    signatureType: 'summon',
    attacks: [{ type: 'aimed', weight: 2 }, { type: 'summon', weight: 4, minionType: 'drone', count: 2 }],
  },
  {
    round: 4,
    signature: 'Prism Ring',
    signatureType: 'ring',
    attacks: [{ type: 'aimed', weight: 2 }, { type: 'ring', weight: 4 }, { type: 'summon', weight: 1, minionType: 'swarm', count: 3 }],
  },
  {
    round: 5,
    signature: 'Swarm Gate',
    signatureType: 'summon',
    attacks: [
      { type: 'spread', weight: 2 },
      { type: 'summon', weight: 5, minionType: 'drone', count: 4 },
      { type: 'summon', weight: 2, minionType: 'swarm', count: 5 },
    ],
  },
  {
    round: 6,
    signature: 'Arc Sweep',
    signatureType: 'sweep',
    attacks: [{ type: 'sweep', weight: 4 }, { type: 'summon', weight: 3, minionType: 'striker', count: 2 }, { type: 'aimed', weight: 2 }],
  },
  {
    round: 7,
    signature: 'Star Barrage',
    signatureType: 'barrage',
    attacks: [{ type: 'barrage', weight: 4 }, { type: 'crossfire', weight: 2 }, { type: 'summon', weight: 2, minionType: 'drone', count: 3 }],
  },
  {
    round: 8,
    signature: 'Legion Spawn',
    signatureType: 'summon',
    attacks: [
      { type: 'summon', weight: 5, minionType: 'drone', count: 3 },
      { type: 'summon', weight: 4, minionType: 'striker', count: 2 },
      { type: 'summon', weight: 3, minionType: 'brute', count: 1 },
      { type: 'spread', weight: 2 },
    ],
  },
  {
    round: 9,
    signature: 'Crossfire',
    signatureType: 'crossfire',
    attacks: [{ type: 'crossfire', weight: 5 }, { type: 'summon', weight: 3, minionType: 'swarm', count: 6 }, { type: 'aimed', weight: 2 }],
  },
  {
    round: 10,
    signature: 'Spiral Crush',
    signatureType: 'spiral',
    attacks: [{ type: 'spiral', weight: 4 }, { type: 'summon', weight: 4, minionType: 'hunter', count: 2 }, { type: 'ring', weight: 2 }],
  },
  {
    round: 11,
    signature: 'Twin Legion',
    signatureType: 'summon',
    attacks: [
      { type: 'summon', weight: 4, minionType: 'brute', count: 2 },
      { type: 'summon', weight: 4, minionType: 'striker', count: 3 },
      { type: 'barrage', weight: 2 },
      { type: 'crossfire', weight: 2 },
    ],
  },
  {
    round: 12,
    signature: 'Apocalypse Swarm',
    signatureType: 'summon',
    attacks: [
      { type: 'summon', weight: 5, minionType: 'swarm', count: 8 },
      { type: 'summon', weight: 4, minionType: 'hunter', count: 3 },
      { type: 'spiral', weight: 3 },
      { type: 'barrage', weight: 2 },
    ],
  },
];

const BOSS_LATE_SIGNATURES = [
  { signature: 'Void Legion', signatureType: 'summon', minionType: 'brute', count: 3, extra: { type: 'striker', count: 4 } },
  { signature: 'Cosmic Storm', signatureType: 'spiral', minionType: 'swarm', count: 6 },
  { signature: 'Nebula Hunt', signatureType: 'crossfire', minionType: 'hunter', count: 4 },
  { signature: 'Starfall', signatureType: 'barrage', minionType: 'drone', count: 5 },
  { signature: 'Omega Swarm', signatureType: 'summon', minionType: 'swarm', count: 10 },
];

function scaleSummonAttack(attack, round, kitRound) {
  if (attack.type !== 'summon') return attack;
  const extra = Math.floor((round - kitRound) / 2);
  return { ...attack, count: attack.count + extra };
}

function getBossRoundKit(round) {
  const kit = BOSS_ROUND_KITS.find((entry) => entry.round === round);
  if (kit) {
    return {
      ...kit,
      attacks: kit.attacks.map((attack) => scaleSummonAttack(attack, round, kit.round)),
    };
  }

  const late = BOSS_LATE_SIGNATURES[(round - 13) % BOSS_LATE_SIGNATURES.length];
  const tier = round - 12;
  const attacks = [
    { type: 'aimed', weight: 2 },
    { type: 'spread', weight: 2 },
    { type: 'ring', weight: 2 },
    { type: late.signatureType, weight: 4 },
    { type: 'summon', weight: 5, minionType: late.minionType, count: late.count + Math.floor(tier / 2) },
  ];
  if (late.extra) {
    attacks.push({
      type: 'summon',
      weight: 3,
      minionType: late.extra.type,
      count: late.extra.count + Math.floor(tier / 3),
    });
  }
  if (tier >= 3) {
    attacks.push({ type: 'spiral', weight: 3 });
    attacks.push({ type: 'crossfire', weight: 3 });
  }
  if (tier >= 5) {
    attacks.push({ type: 'summon', weight: 4, minionType: 'brute', count: 2 + Math.floor(tier / 4) });
  }

  return {
    round,
    signature: `${late.signature} ${round}`,
    signatureType: late.signatureType,
    attacks,
  };
}

function pickBossAttack(kit, attackIndex) {
  const attacks = kit.attacks || [];
  if (!attacks.length) return { type: 'aimed', weight: 1 };

  if (kit.signatureType && attackIndex % 3 === 0) {
    const signature = attacks.find((entry) => entry.type === kit.signatureType);
    if (signature) return signature;
  }

  const total = attacks.reduce((sum, entry) => sum + (entry.weight || 1), 0);
  let roll = Math.random() * total;
  for (const entry of attacks) {
    roll -= entry.weight || 1;
    if (roll <= 0) return entry;
  }
  return attacks[attacks.length - 1];
}

function getBossMinionStats(type, round) {
  const base = BOSS_MINION_TYPES[type] || BOSS_MINION_TYPES.drone;
  const scale = 1 + (round - 1) * 0.08;
  return {
    ...base,
    health: Math.floor(base.health * scale),
    speed: base.speed + round * 4,
    touchDamage: Math.floor(base.touchDamage * (1 + (round - 1) * 0.06)),
    projectileSpeed: (base.projectileSpeed || 0) + round * 12,
  };
}

function getBossAttackTypes(round) {
  return getBossRoundKit(round).attacks.map((entry) => entry.type);
}
