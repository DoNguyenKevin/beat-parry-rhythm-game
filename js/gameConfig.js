const GameConfig = {
  wheelLuckMult: 1,
  speedPlay: 1,
  speedTraining: 1,
  speedDodge: 1,
  speedBoss: 1,
  rudMultGlobal: 1,
  wheelSpinCost: 150,
  freeSpinHours: 24,
  trainingLevelInterval: 9,
  dodgeLevelInterval: 4,
  maintenanceMode: false,
  announcement: '',

  apply(data) {
    if (!data) return;
    for (const key of Object.keys(this)) {
      if (key === 'apply' || key === 'fetch' || key === 'getSpeedMult') continue;
      if (data[key] !== undefined) this[key] = data[key];
    }
  },

  getSpeedMult(playMode, opts = {}) {
    if (playMode === 'dodge') return this.speedDodge || 1;
    if (playMode === 'boss') return this.speedBoss || 1;
    if (opts.training || opts.endless) return this.speedTraining || 1;
    return this.speedPlay || 1;
  },

  getTrainingLevel(elapsed, startLevel = 3) {
    const interval = this.trainingLevelInterval || 9;
    return Math.min(30, startLevel + Math.floor(elapsed / interval));
  },

  getDodgeLevel(elapsed, startLevel = 1) {
    const interval = this.dodgeLevelInterval || 4;
    const max = typeof DODGE_MAX_LEVEL !== 'undefined' ? DODGE_MAX_LEVEL : 60;
    return Math.min(max, startLevel + Math.floor(elapsed / interval));
  },

  async fetch() {
    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      this.apply(data);
    } catch {
      // offline / static host
    }
  },
};
