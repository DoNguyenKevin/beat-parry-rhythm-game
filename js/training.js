const TRAINING_MODES = {
  oneLayer: {
    id: 'train-endless-1',
    name: '1 Layer Training',
    description: 'F & J on the center line — survive as difficulty ramps up',
    trainingLayers: 1,
    difficulty: 'easy',
    endless: true,
    bpm: 128,
    duration: 3600,
    color: '#4dff88',
    bassFreq: 50,
    melodyScale: [0, 4, 7, 11],
    baseSpeed: 300,
    maxSpeed: 620,
    speedMult: 1,
    startLevel: 3,
  },
  twoLayer: {
    id: 'train-endless-2',
    name: '2 Layer Training',
    description: 'F/G/J/K on both lanes — survive as difficulty ramps up',
    trainingLayers: 2,
    difficulty: 'medium',
    endless: true,
    bpm: 138,
    duration: 3600,
    color: '#ffd44d',
    bassFreq: 55,
    melodyScale: [0, 3, 5, 7, 10],
    baseSpeed: 320,
    maxSpeed: 680,
    speedMult: 1,
    startLevel: 3,
  },
};

function createEndlessTraining(layers) {
  const mode = layers === 1 ? TRAINING_MODES.oneLayer : TRAINING_MODES.twoLayer;
  return { ...mode, isTraining: true };
}

function getKeyForNote(side, lane) {
  if (side === 'left') return lane === 0 ? 'F' : 'G';
  return lane === 0 ? 'J' : 'K';
}

function getTrainingLevel(elapsed, startLevel = 3) {
  return Math.min(30, startLevel + Math.floor(elapsed / 9));
}

function pickEndlessNotes(level, layers, beatIndex) {
  const notes = [];
  const side = beatIndex % 2 === 0 ? 'left' : 'right';
  const randSide = beatIndex % 3 === 0 ? 'left' : beatIndex % 3 === 1 ? 'right' : side;

  if (layers === 1) {
    if (level >= 5 && beatIndex % 4 === 0) {
      notes.push({ side: 'left', lane: 0 }, { side: 'right', lane: 0 });
      return notes;
    }
    notes.push({ side: randSide, lane: 0 });
    return notes;
  }

  if (level >= 8 && beatIndex % 3 === 0) {
    const lane = beatIndex % 2;
    notes.push({ side: 'left', lane }, { side: 'right', lane: 1 - lane });
    return notes;
  }
  if (level >= 5 && beatIndex % 4 === 0) {
    const s = beatIndex % 2 === 0 ? 'left' : 'right';
    notes.push({ side: s, lane: 0 }, { side: s, lane: 1 });
    return notes;
  }
  notes.push({ side: randSide, lane: Math.floor(beatIndex / 2) % 2 });
  return notes;
}

function getEndlessSpawnInterval(level, baseBpm) {
  const bpm = baseBpm + level * 7;
  let interval = 60 / bpm;
  if (level >= 3) interval *= 0.9;
  if (level >= 6) interval *= 0.85;
  if (level >= 10) interval *= 0.8;
  if (level >= 15) interval *= 0.75;
  return Math.max(0.18, interval);
}

function getEndlessSpeed(song, level) {
  const t = Math.min(1, level / 20);
  const speed = song.baseSpeed + (song.maxSpeed - song.baseSpeed) * t;
  return speed * (song.speedMult || 1);
}
