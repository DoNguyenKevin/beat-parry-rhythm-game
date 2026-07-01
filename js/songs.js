const SONGS = [
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
  return song.difficulty === 'easy' ? 1 : 2;
}

const TIMING_WINDOWS = {
  excellent: 18,
  good: 35,
  medium: 55,
};

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
  const rand = seededRandom(song.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0));

  for (let beat = 4; beat < totalBeats - 2; beat++) {
    const time = beat * beatInterval;
    const progress = beat / totalBeats;

    let density = 0.35;
    if (progress > 0.3) density = 0.5;
    if (progress > 0.5) density = 0.65;
    if (progress > 0.7) density = 0.8;
    if (progress > 0.85) density = 0.95;

    if (rand() > density) continue;

    const side = sides[Math.floor(rand() * sides.length)];
    const lane = lanes[Math.floor(rand() * lanes.length)];

    if (layers === 2 && progress > 0.6 && rand() < 0.3) {
      notes.push({ time, side, lane: 0 });
      notes.push({ time, side, lane: 1 });
      continue;
    }

    if (layers === 2 && progress > 0.75 && rand() < 0.25) {
      const otherSide = side === 'left' ? 'right' : 'left';
      notes.push({ time, side, lane });
      notes.push({ time, side: otherSide, lane: Math.floor(rand() * 2) });
      continue;
    }

    notes.push({ time, side, lane });

    if (layers === 2 && progress > 0.4 && rand() < 0.15 * progress) {
      const offset = beatInterval * 0.5;
      notes.push({
        time: time + offset,
        side: sides[Math.floor(rand() * 2)],
        lane: lanes[Math.floor(rand() * 2)],
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
  const eased = progress * progress;
  return song.baseSpeed + (song.maxSpeed - song.baseSpeed) * eased;
}
