const DODGE_MAX_LEVEL = 60;
const DODGE_LEVEL_INTERVAL = 4;
const DODGE_WARNING_DURATION = 0.5;

const DODGE_MODE = {
  id: 'dodge-endless',
  name: 'Bullet Dodge',
  description: 'Move your cursor to dodge bullets. White warning lines show where each shot will travel.',
  isDodge: true,
  isTraining: true,
  endless: true,
  bpm: 110,
  duration: 3600,
  color: '#ff6b6b',
  bassFreq: 45,
  melodyScale: [0, 3, 7, 10],
  startLevel: 1,
};

function createDodgeMode() {
  return { ...DODGE_MODE };
}

function getDodgeLevel(elapsed, startLevel = 1) {
  return Math.min(DODGE_MAX_LEVEL, startLevel + Math.floor(elapsed / DODGE_LEVEL_INTERVAL));
}

function getDodgeWarningDuration(level) {
  if (level >= 45) return 0.38;
  if (level >= 30) return 0.42;
  if (level >= 15) return 0.46;
  return DODGE_WARNING_DURATION;
}

function getDodgeBulletSpeed(level) {
  const t = Math.min(1, (level - 1) / (DODGE_MAX_LEVEL - 1));
  return 1800 + t * 3400;
}

function getDodgeSpawnInterval(level) {
  let interval = 0.85 - level * 0.012;
  if (level >= 5) interval *= 0.88;
  if (level >= 10) interval *= 0.84;
  if (level >= 18) interval *= 0.78;
  if (level >= 26) interval *= 0.72;
  if (level >= 34) interval *= 0.66;
  if (level >= 42) interval *= 0.6;
  if (level >= 50) interval *= 0.55;
  return Math.max(0.07, interval);
}

function getDodgeBurstCount(level) {
  if (level >= 52) return 8;
  if (level >= 42) return 7;
  if (level >= 32) return 6;
  if (level >= 22) return 5;
  if (level >= 14) return 4;
  if (level >= 7) return 3;
  if (level >= 3) return 2;
  return 1;
}

function pickDodgeBullet(canvas, playerX, playerY, index = 0, level = 1) {
  const margin = 40;
  const w = canvas.width;
  const h = canvas.height;
  const edge = Math.floor(Math.random() * 4);

  let x;
  let y;
  if (edge === 0) {
    x = margin + Math.random() * (w - margin * 2);
    y = -12;
  } else if (edge === 1) {
    x = w + 12;
    y = margin + Math.random() * (h - margin * 2);
  } else if (edge === 2) {
    x = margin + Math.random() * (w - margin * 2);
    y = h + 12;
  } else {
    x = -12;
    y = margin + Math.random() * (h - margin * 2);
  }

  const aimSpread = Math.max(40, 140 - level * 2);
  const targetX = playerX + (Math.random() - 0.5) * aimSpread;
  const targetY = playerY + (Math.random() - 0.5) * aimSpread;
  const angle = Math.atan2(targetY - y, targetX - x);
  const spread = (index - 0.5) * (0.14 + Math.min(level, 30) * 0.004);
  const finalAngle = angle + spread;

  const diag = Math.hypot(w, h);
  return {
    x,
    y,
    angle: finalAngle,
    length: diag * 1.2,
    radius: 9,
  };
}

function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  if (a === 0) {
    return Math.hypot(fx, fy) <= r;
  }
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  let disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  disc = Math.sqrt(disc);
  const t1 = (-b - disc) / (2 * a);
  const t2 = (-b + disc) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}
