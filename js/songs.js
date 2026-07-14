const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'expert'];

const DIFFICULTY_META = {
  easy: {
    label: 'Easy',
    ballColor: '#ffffff',
    layers: 1,
    densityBase: 0.35,
    densityMax: 0.85,
  },
  medium: {
    label: 'Medium',
    ballColor: '#ffee00',
    layers: 2,
    densityBase: 0.4,
    densityMax: 0.9,
  },
  hard: {
    label: 'Hard',
    ballColor: '#ff2222',
    layers: 2,
    densityBase: 0.45,
    densityMax: 0.95,
  },
  expert: {
    label: 'Expert',
    ballColor: '#cc44ff',
    layers: 2,
    densityBase: 0.55,
    densityMax: 0.98,
  },
  nightmare: {
    label: 'Nightmare',
    ballColor: '#ff0044',
    layers: 2,
    densityBase: 0.72,
    densityMax: 0.99,
  },
};

const SONGS = [
  // Easy
  {
    id: 'neon-pulse',
    name: 'Neon Pulse',
    bpm: 120,
    duration: 45,
    difficulty: 'easy',
    color: '#ff6b9d',
    bassFreq: 55,
    melodyScale: [0, 3, 5, 7, 10],
    baseSpeed: 280,
    maxSpeed: 420,
  },
  {
    id: 'soft-glow',
    name: 'Soft Glow',
    bpm: 110,
    duration: 40,
    difficulty: 'easy',
    color: '#88ccff',
    bassFreq: 50,
    melodyScale: [0, 4, 7, 11],
    baseSpeed: 260,
    maxSpeed: 380,
  },
  // Medium
  {
    id: 'midnight-drive',
    name: 'Midnight Drive',
    bpm: 140,
    duration: 55,
    difficulty: 'medium',
    color: '#4d9fff',
    bassFreq: 65,
    melodyScale: [0, 2, 4, 7, 9, 11],
    baseSpeed: 320,
    maxSpeed: 500,
  },
  {
    id: 'starfall',
    name: 'Starfall',
    bpm: 128,
    duration: 50,
    difficulty: 'medium',
    color: '#ffd44d',
    bassFreq: 60,
    melodyScale: [0, 4, 7, 11],
    baseSpeed: 300,
    maxSpeed: 480,
  },
  // Hard
  {
    id: 'chaos-engine',
    name: 'Chaos Engine',
    bpm: 165,
    duration: 60,
    difficulty: 'hard',
    color: '#c44dff',
    bassFreq: 75,
    melodyScale: [0, 1, 3, 6, 8, 10],
    baseSpeed: 380,
    maxSpeed: 600,
  },
  {
    id: 'iron-rush',
    name: 'Iron Rush',
    bpm: 158,
    duration: 55,
    difficulty: 'hard',
    color: '#ff6644',
    bassFreq: 70,
    melodyScale: [0, 2, 5, 7, 10],
    baseSpeed: 360,
    maxSpeed: 580,
  },
  // Expert
  {
    id: 'void-breaker',
    name: 'Void Breaker',
    bpm: 185,
    duration: 70,
    difficulty: 'expert',
    color: '#aa44ff',
    bassFreq: 80,
    melodyScale: [0, 1, 3, 5, 8, 10, 11],
    baseSpeed: 420,
    maxSpeed: 700,
  },
];

const NIGHTMARE_S_RUD = 10000;

const NIGHTMARE_SONGS = [
  {
    id: 'nightmare-oblivion',
    name: 'Oblivion',
    bpm: 198,
    duration: 80,
    difficulty: 'nightmare',
    color: '#ff1144',
    bassFreq: 85,
    melodyScale: [0, 1, 2, 4, 6, 8, 10, 11],
    baseSpeed: 520,
    maxSpeed: 820,
    speedMult: 1.2,
  },
  {
    id: 'nightmare-cataclysm',
    name: 'Cataclysm',
    bpm: 210,
    duration: 70,
    difficulty: 'nightmare',
    color: '#ff3300',
    bassFreq: 90,
    melodyScale: [0, 1, 3, 4, 7, 8, 10, 11],
    baseSpeed: 540,
    maxSpeed: 860,
    speedMult: 1.25,
  },
  {
    id: 'nightmare-annihilation',
    name: 'Annihilation',
    bpm: 220,
    duration: 90,
    difficulty: 'nightmare',
    color: '#cc0022',
    bassFreq: 95,
    melodyScale: [0, 1, 2, 3, 5, 7, 9, 10, 11],
    baseSpeed: 560,
    maxSpeed: 900,
    speedMult: 1.3,
  },
];

const KEY_MAP = {
  f: { side: 'left', lane: 0 },
  g: { side: 'left', lane: 1 },
  j: { side: 'right', lane: 0 },
  k: { side: 'right', lane: 1 },
};

const RATING = {
  EXCELLENT: 'excellent',
  GOOD: 'good',
  MEDIUM: 'medium',
  BAD: 'bad',
  MISS: 'miss',
};

const RATING_SCORE = {
  excellent: 300,
  good: 200,
  medium: 100,
  bad: -150,
  miss: -50,
};

function getSongLayers(song) {
  if (song.trainingLayers != null) return song.trainingLayers;
  return DIFFICULTY_META[song.difficulty]?.layers ?? 2;
}

function getBallColor(song) {
  if (!song) return DIFFICULTY_META.easy.ballColor;
  return DIFFICULTY_META[song.difficulty]?.ballColor ?? DIFFICULTY_META.easy.ballColor;
}

function getSongsByLevel() {
  const grouped = {};
  for (const level of DIFFICULTY_ORDER) {
    grouped[level] = SONGS.filter((s) => s.difficulty === level);
  }
  return grouped;
}

const TIMING_WINDOWS = {
  excellent: 18,
  good: 35,
  medium: 55,
};

const EXPERT_TIMING_WINDOWS = {
  excellent: 14,
  good: 28,
  medium: 45,
};

const NIGHTMARE_TIMING_WINDOWS = {
  excellent: 8,
  good: 18,
  medium: 32,
};

const TRAINING_TIMING_WINDOWS = {
  excellent: 28,
  good: 50,
  medium: 75,
};

function getTimingWindows(song) {
  if (song?.isTraining) return TRAINING_TIMING_WINDOWS;
  if (song?.difficulty === 'nightmare') return NIGHTMARE_TIMING_WINDOWS;
  return song?.difficulty === 'expert' ? EXPERT_TIMING_WINDOWS : TIMING_WINDOWS;
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateBeatMap(song) {
  const notes = [];
  const beatInterval = 60 / song.bpm;
  const totalBeats = Math.floor(song.duration / beatInterval);
  const sides = ['left', 'right'];
  const layers = getSongLayers(song);
  const lanes = layers === 1 ? [0] : [0, 1];
  const meta = DIFFICULTY_META[song.difficulty] || DIFFICULTY_META.medium;
  const isExpert = song.difficulty === 'expert';
  const isNightmare = song.difficulty === 'nightmare';
  const rand = seededRandom(song.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0));

  for (let beat = 4; beat < totalBeats - 2; beat++) {
    const time = beat * beatInterval;
    const progress = beat / totalBeats;

    let density = meta.densityBase;
    if (progress > 0.25) density = meta.densityBase + 0.15;
    if (progress > 0.45) density = meta.densityBase + 0.3;
    if (progress > 0.65) density = meta.densityBase + 0.45;
    if (progress > 0.8) density = meta.densityMax;

    if (rand() > density) continue;

    const side = sides[Math.floor(rand() * sides.length)];
    const lane = lanes[Math.floor(rand() * lanes.length)];

    const doubleLaneChance = isNightmare ? 0.62 : isExpert ? 0.45 : 0.3;
    const crossSideChance = isNightmare ? 0.52 : isExpert ? 0.35 : 0.25;
    const offBeatChance = isNightmare ? 0.42 : isExpert ? 0.25 : 0.15;

    if (layers === 2 && progress > 0.5 && rand() < doubleLaneChance) {
      notes.push({ time, side, lane: 0 });
      notes.push({ time, side, lane: 1 });
      continue;
    }

    if (layers === 2 && progress > 0.6 && rand() < crossSideChance) {
      const otherSide = side === 'left' ? 'right' : 'left';
      notes.push({ time, side, lane });
      notes.push({ time, side: otherSide, lane: Math.floor(rand() * 2) });
      continue;
    }

    notes.push({ time, side, lane });

    if (layers === 2 && progress > 0.35 && rand() < offBeatChance * progress) {
      const offset = beatInterval * (isExpert && rand() < 0.5 ? 0.25 : 0.5);
      notes.push({
        time: time + offset,
        side: sides[Math.floor(rand() * 2)],
        lane: lanes[Math.floor(rand() * lanes.length)],
      });
    }

    if (isExpert && progress > 0.7 && rand() < 0.2) {
      notes.push({
        time: time + beatInterval * 0.75,
        side: sides[Math.floor(rand() * 2)],
        lane: lanes[Math.floor(rand() * lanes.length)],
      });
    }

    if (isNightmare && progress > 0.55 && rand() < 0.28) {
      notes.push({
        time: time + beatInterval * (rand() < 0.5 ? 0.33 : 0.66),
        side: sides[Math.floor(rand() * 2)],
        lane: lanes[Math.floor(rand() * lanes.length)],
      });
    }
  }

  notes.sort((a, b) => a.time - b.time);
  return notes;
}

function getGrade(accuracy) {
  if (accuracy >= 95) return 'S';
  if (accuracy >= 90) return 'A';
  if (accuracy >= 80) return 'B';
  if (accuracy >= 70) return 'C';
  if (accuracy >= 60) return 'D';
  return 'F';
}

function getSpeedForProgress(song, progress) {
  if (song.difficulty === 'nightmare') {
    const eased = progress * progress * progress * progress;
    return song.baseSpeed + (song.maxSpeed - song.baseSpeed) * eased;
  }
  const eased = song.difficulty === 'expert' ? progress * progress * progress : progress * progress;
  return song.baseSpeed + (song.maxSpeed - song.baseSpeed) * eased;
}
