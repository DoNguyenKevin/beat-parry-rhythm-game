class BeatParryGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.state = 'idle';
    this.song = null;
    this.beatMap = [];
    this.noteIndex = 0;

    this.notes = [];
    this.particles = [];
    this.keyFlash = { f: 0, g: 0, j: 0, k: 0 };

    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.stats = { excellent: 0, good: 0, medium: 0, bad: 0, miss: 0 };
    this.totalNotes = 0;

    this.centerX = 0;
    this.centerY = 0;
    this.lineLength = 0;
    this.laneOffset = 28;
    this.ballRadius = 16;
    this.hitZone = 40;

    this.screenShake = 0;
    this.lastTime = 0;
    this.renderLoopId = null;

    this.trainingMode = false;
    this.dodgeMode = false;
    this.playMode = 'idle';
    this.speedMult = 1;

    this.playerX = 0;
    this.playerY = 0;
    this.dodgeBullets = [];
    this.dodgeNextSpawn = 0.8;
    this.dodgeInvincibleUntil = 0;
    this.dodgeClockStart = 0;
    this.dodgeNextSpawnMs = 0;
    this.dodgeInvincibleUntilMs = 0;
    this.dodgeHealth = DODGE_MAX_HEALTH;
    this.dodgeMaxHealth = DODGE_MAX_HEALTH;

    this.onComplete = null;
    this.onScoreUpdate = null;
    this.onTrainingExit = null;
    this.onTrainingRestart = null;
    this.onDodgeDefeat = null;
    this.onAbilityUpdate = null;

    this.activeAbilities = [];
    this.abilityState = {};
    this.activeSkin = getSkin(DEFAULT_SKIN_ID);
    this.skinPassives = {};
    this.skinTrail = [];
    this._skinTrailTick = 0;
    this.cosmicOrbitals = [];
    this.overdriveWave = null;
    this.overdriveWave2 = null;
    this.overdriveConstellation = null;
    this.voidDashEffect = null;
    this.voidDashUntilMs = 0;

    this.bossMode = false;
    this.bossRound = 1;
    this.boss = null;
    this.bossWeapon = null;
    this.bossProjectiles = [];
    this.bossAttacks = [];
    this.bossMinions = [];
    this.bossNextAttackMs = 0;
    this.bossAttackIndex = 0;
    this.bossRoundKit = null;
    this.bossStunnedUntilMs = 0;
    this.bossClockStart = 0;
    this.bossRoundCleared = false;
    this.bossClearUntilMs = 0;
    this.playerNextFireMs = 0;

    this.resize();
    this._lastPointer = { x: null, y: null };
    this._onPointerMove = (e) => {
      this._lastPointer.x = e.clientX;
      this._lastPointer.y = e.clientY;
      this.handlePointerMove(e);
    };
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('pointermove', this._onPointerMove);
    this.beginRenderLoop();
  }

  beginRenderLoop() {
    const frame = () => {
      this.renderLoopId = requestAnimationFrame(frame);
      if (this.state === 'idle') {
        this.drawIdlePreview();
      } else if (this.state === 'playing') {
        this.tickPlaying();
      }
    };
    this.renderLoopId = requestAnimationFrame(frame);
  }

  clearModeState() {
    this.playMode = 'idle';
    this.dodgeMode = false;
    this.bossMode = false;
    this.trainingMode = false;
    this.nightmareMode = false;
    this.endlessMode = false;
    this.dodgeBullets = [];
    this.notes = [];
    this.particles = [];
    this.dodgeInvincibleUntilMs = 0;
    this._lastDodgeScoreTick = undefined;
  }

  resetRoundState() {
    this.dodgeBullets = [];
    this.notes = [];
    this.particles = [];
    this.dodgeInvincibleUntilMs = 0;
    this._lastDodgeScoreTick = undefined;
    this._dodgeScoreFrac = 0;
    this.dodgeHealth = DODGE_MAX_HEALTH;
    this.dodgeMaxHealth = DODGE_MAX_HEALTH;
    this.noteIndex = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.stats = { excellent: 0, good: 0, medium: 0, bad: 0, miss: 0 };
    this.spawnBeatCounter = 0;
    this.nextSpawnTime = 0.8;
    this.dodgeNextSpawn = 0.8;
    this.dodgeInvincibleUntil = 0;
    this.activeAbilities = [];
    this.abilityState = {
      comboShieldUsed: false,
      secondChanceUsed: false,
      slowStartUntilMs: 0,
      ghostPhaseUsed: false,
      lastOverdriveMs: 0,
    };
    this.overdriveWave = null;
    this.overdriveWave2 = null;
    this.overdriveConstellation = null;
    this.voidDashEffect = null;
    this.voidDashUntilMs = 0;
    this.bossRound = 1;
    this.boss = null;
    this.bossWeapon = null;
    this.bossProjectiles = [];
    this.bossAttacks = [];
    this.bossMinions = [];
    this.bossNextAttackMs = 0;
    this.bossAttackIndex = 0;
    this.bossRoundKit = null;
    this.bossStunnedUntilMs = 0;
    this.bossRoundCleared = false;
    this.bossClearUntilMs = 0;
    this.playerNextFireMs = 0;
    this.skinTrail = [];
    this._skinTrailTick = 0;
  }

  isVoidDashing() {
    return performance.now() < (this.voidDashUntilMs || 0);
  }

  drawIdlePreview() {
    if (!SONGS || !SONGS.length) return;
    this.renderParryScene(SONGS[0]);
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
    this.lineLength = Math.min(this.canvas.width * 0.85, 900);
    if (this.playerX === 0 && this.playerY === 0) {
      this.playerX = this.centerX;
      this.playerY = this.centerY;
    }
  }

  updatePlayerFromClient(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.playerX = (clientX - rect.left) * scaleX;
    this.playerY = (clientY - rect.top) * scaleY;
  }

  handlePointerMove(e) {
    if (this.state !== 'playing' || (this.playMode !== 'dodge' && this.playMode !== 'boss')) return;
    this.updatePlayerFromClient(e.clientX, e.clientY);
  }

  start(song, options = {}) {
    audioEngine.stop();

    const isDodge = !!options.dodge;
    const isBoss = !!options.boss;
    const isTraining = !!options.training && !isDodge && !isBoss;
    const isNightmare = !!options.nightmare && !isDodge && !isTraining && !isBoss;
    this.playMode = isBoss ? 'boss' : (isDodge ? 'dodge' : 'parry');
    this.dodgeMode = isDodge;
    this.bossMode = isBoss;
    this.trainingMode = isTraining;
    this.nightmareMode = isNightmare;
    this.endlessMode = isDodge || isBoss || (isTraining && !!song.endless);
    this.song = song;
    this.speedMult = song.speedMult || 1;
    this.trainingLevel = isBoss ? 1 : (isDodge ? (song.startLevel || 1) : (song.startLevel || 3));

    this.resetRoundState();

    this.activeAbilities = options.abilities || [];
    this.activeSkin = getSkin(options.skinId || DEFAULT_SKIN_ID);
    this.skinPassives = this.activeSkin.passives || {};
    this.initCosmicOrbitals();
    if (isDodge) {
      this.dodgeMaxHealth = DODGE_MAX_HEALTH + (this.skinPassives.dodgeHealthBonus || 0);
      this.dodgeHealth = this.dodgeMaxHealth;
    }
    if (isBoss) {
      this.dodgeMaxHealth = BOSS_PLAYER_HEALTH + (this.skinPassives.dodgeHealthBonus || 0);
      this.dodgeHealth = this.dodgeMaxHealth;
      this.bossWeapon = getBossWeapon(this.activeSkin?.id || DEFAULT_SKIN_ID);
      this.bossRound = 1;
      this.initBossRound(1);
    }
    if (this.activeAbilities.includes('slow-start') && isTraining) {
      this.abilityState.slowStartUntilMs = performance.now() + 45000;
    }

    if (this.endlessMode) {
      this.beatMap = [];
      this.totalNotes = 0;
    } else {
      this.beatMap = generateBeatMap(song);
      this.totalNotes = this.beatMap.length;
    }

    this.playerX = this.centerX;
    this.playerY = this.centerY;
    if (isDodge || isBoss) {
      this.dodgeClockStart = performance.now();
      this.dodgeNextSpawnMs = this.dodgeClockStart + 800;
      if (isBoss) {
        this.bossClockStart = this.dodgeClockStart;
        this.bossNextAttackMs = this.bossClockStart + 1200;
        this.playerNextFireMs = this.bossClockStart;
      }
      if (this._lastPointer.x != null) {
        this.updatePlayerFromClient(this._lastPointer.x, this._lastPointer.y);
      }
    }

    this.state = 'playing';
    this.lastTime = performance.now();
    this.canvas.classList.toggle('dodge-cursor', isDodge || isBoss);
    this.canvas.dataset.playMode = this.playMode;

    audioEngine.playSong(song);
  }

  stop() {
    this.state = 'idle';
    this.canvas.classList.remove('dodge-cursor');
    delete this.canvas.dataset.playMode;
    audioEngine.stop();
    this.clearModeState();
  }

  getBossElapsed() {
    return (performance.now() - this.bossClockStart) / 1000;
  }

  getDodgeElapsed() {
    return (performance.now() - this.dodgeClockStart) / 1000;
  }

  getProgress() {
    if (!this.song) return 0;
    if (this.endlessMode) {
      if (this.playMode === 'dodge' || this.playMode === 'boss') {
        return (this.getDodgeElapsed() % 12) / 12;
      }
      return ((audioEngine.getCurrentTime() % 12) / 12);
    }
    const t = audioEngine.getCurrentTime();
    return Math.min(t / this.song.duration, 1);
  }

  getTrainingLevel() {
    if (!this.endlessMode) return 1;
    const startLevel = this.song.startLevel || (this.dodgeMode ? 1 : 3);
    if (this.playMode === 'boss') return this.bossRound;
    if (this.playMode === 'dodge') return getDodgeLevel(this.getDodgeElapsed(), startLevel);
    return getTrainingLevel(audioEngine.getCurrentTime(), startLevel);
  }

  spawnNotes(currentTime) {
    if (this.playMode === 'boss') {
      this.spawnBossGameplay();
      return;
    }
    if (this.playMode === 'dodge') {
      this.spawnDodgeBullets();
      return;
    }
    if (this.endlessMode) {
      this.spawnEndlessNotes(currentTime);
      return;
    }

    const progress = this.getProgress();
    const speed = this.getNoteSpeed(progress);
    const spawnLead = (this.lineLength / 2) / speed;

    while (this.noteIndex < this.beatMap.length) {
      const beat = this.beatMap[this.noteIndex];
      if (beat.time > currentTime + spawnLead) break;

      this.notes.push({
        side: beat.side,
        lane: beat.lane,
        spawnTime: beat.time,
        x: beat.side === 'left'
          ? this.centerX - this.lineLength / 2
          : this.centerX + this.lineLength / 2,
        hit: false,
        missed: false,
        rating: null,
      });
      this.noteIndex++;
    }
  }

  spawnEndlessNotes(currentTime) {
    const startLevel = this.song.startLevel || 3;
    this.trainingLevel = getTrainingLevel(currentTime, startLevel);
    const level = this.trainingLevel;
    const layers = getSongLayers(this.song);
    const speed = getEndlessSpeed(this.song, level);
    const spawnLead = (this.lineLength / 2) / speed;
    const interval = getEndlessSpawnInterval(level, this.song.bpm);

    while (this.nextSpawnTime <= currentTime + spawnLead) {
      const pattern = pickEndlessNotes(level, layers, this.spawnBeatCounter);
      for (const { side, lane } of pattern) {
        this.notes.push({
          side,
          lane,
          spawnTime: this.nextSpawnTime,
          x: side === 'left'
            ? this.centerX - this.lineLength / 2
            : this.centerX + this.lineLength / 2,
          hit: false,
          missed: false,
          rating: null,
        });
        this.totalNotes++;
      }
      this.spawnBeatCounter++;
      this.nextSpawnTime += interval;
    }
  }

  spawnDodgeBullets() {
    const nowMs = performance.now();
    const elapsed = this.getDodgeElapsed();
    const startLevel = this.song.startLevel || 1;
    this.trainingLevel = getDodgeLevel(elapsed, startLevel);
    const level = this.trainingLevel;
    const interval = getDodgeSpawnInterval(level);
    const warningMs = getDodgeWarningDuration(level) * 1000
      * (this.hasAbility('long-warning') ? 1.4 : 1);
    const speed = getDodgeBulletSpeed(level);
    const burst = getDodgeBurstCount(level);

    while (this.dodgeNextSpawnMs <= nowMs + warningMs + 50) {
      for (let i = 0; i < burst; i++) {
        const spawn = pickDodgeBullet(this.canvas, this.playerX, this.playerY, i, level);
        this.dodgeBullets.push({
          x: spawn.x,
          y: spawn.y,
          angle: spawn.angle,
          length: spawn.length,
          radius: spawn.radius,
          speed,
          warningStartMs: this.dodgeNextSpawnMs,
          warningDurationMs: warningMs,
          fireTimeMs: this.dodgeNextSpawnMs + warningMs,
          state: 'warning',
          hit: false,
        });
        this.totalNotes++;
      }
      this.dodgeNextSpawnMs += interval * 1000;
    }
  }

  hasAbility(id) {
    return this.activeAbilities.includes(id);
  }

  consumeActiveAbility(id) {
    if (!this.hasAbility(id)) return false;
    if (id === 'op-overdrive' || id === 'op-void-dash') return false;
    const item = typeof Shop !== 'undefined' ? Shop.getItem(id) : null;
    if (item?.secret) return false;
    this.activeAbilities = this.activeAbilities.filter((abilityId) => abilityId !== id);
    if (this.onAbilityUpdate) {
      this.refreshAbilityHud();
    }
    return true;
  }

  refreshAbilityHud() {
    if (!this.onAbilityUpdate) return;
    const list = typeof expandRunAbilities === 'function'
      ? expandRunAbilities([...this.activeAbilities])
      : [...this.activeAbilities];
    this.onAbilityUpdate(list);
  }

  getParryTimingWindows() {
    const windows = { ...getTimingWindows(this.song) };
    if (this.hasAbility('wide-window')) {
      windows.excellent = Math.round(windows.excellent * 1.3);
      windows.good = Math.round(windows.good * 1.3);
      windows.medium = Math.round(windows.medium * 1.3);
    }
    if (this.skinPassives.windowMult) {
      windows.excellent = Math.round(windows.excellent * this.skinPassives.windowMult);
      windows.good = Math.round(windows.good * this.skinPassives.windowMult);
      windows.medium = Math.round(windows.medium * this.skinPassives.windowMult);
    }
    return windows;
  }

  getNoteSpeed(progress) {
    let speed;
    if (this.endlessMode) {
      speed = getEndlessSpeed(this.song, this.trainingLevel || 1);
    } else {
      speed = getSpeedForProgress(this.song, progress) * this.speedMult;
    }
    if (
      this.hasAbility('slow-start') &&
      this.trainingMode &&
      performance.now() < this.abilityState.slowStartUntilMs
    ) {
      speed *= 0.8;
    }
    return speed;
  }

  getTrainingSummary() {
    const elapsed = this.playMode === 'dodge' || this.playMode === 'boss'
      ? this.getDodgeElapsed()
      : audioEngine.getCurrentTime();
    const hitCount = this.playMode === 'dodge'
      ? this.stats.excellent
      : this.playMode === 'boss'
        ? this.stats.excellent + this.stats.good
        : this.stats.excellent + this.stats.good + this.stats.medium + this.stats.bad;
    const weighted = this.playMode === 'dodge'
      ? this.stats.excellent * 100
      : this.playMode === 'boss'
        ? this.stats.excellent * 100 + this.stats.good * 60
        : this.stats.excellent * 100 +
          this.stats.good * 75 +
          this.stats.medium * 50;
    const divisor = this.playMode === 'dodge'
      ? Math.max(1, this.stats.excellent + this.stats.miss)
      : this.playMode === 'boss'
        ? Math.max(1, hitCount + this.stats.miss)
        : Math.max(1, hitCount);
    const accuracy = Math.max(0, Math.min(100, Math.round(weighted / divisor)));

    return {
      score: this.score,
      accuracy,
      grade: null,
      stats: { ...this.stats },
      maxCombo: this.maxCombo,
      training: this.playMode === 'dodge' || this.playMode === 'boss' || this.trainingMode,
      dodge: this.playMode === 'dodge',
      boss: this.playMode === 'boss',
      bossRound: this.bossRound,
      defeated: this.dodgeHealth <= 0,
      health: this.dodgeHealth,
      maxHealth: this.dodgeMaxHealth,
      trainingLevel: this.trainingLevel,
      timeSurvived: Math.floor(this.playMode === 'boss' ? this.getBossElapsed() : elapsed),
      notesHit: hitCount,
      songId: this.song?.id || null,
      activeAbilities: [...this.activeAbilities],
    };
  }

  updateNotes(dt, currentTime) {
    if (this.playMode === 'boss') {
      this.updateBossGameplay(dt, performance.now());
      return;
    }
    if (this.playMode === 'dodge') {
      this.updateDodgeBullets(dt, performance.now());
      return;
    }

    const progress = this.getProgress();
    const speed = this.getNoteSpeed(progress);

    for (const note of this.notes) {
      if (note.hit || note.missed) continue;

      const elapsed = currentTime - note.spawnTime;
      const travel = elapsed * speed;
      const halfLine = this.lineLength / 2;

      if (note.side === 'left') {
        note.x = this.centerX - halfLine + travel;
      } else {
        note.x = this.centerX + halfLine - travel;
      }

      const passedCenter =
        (note.side === 'left' && note.x > this.centerX + this.hitZone) ||
        (note.side === 'right' && note.x < this.centerX - this.hitZone);

      if (passedCenter) {
        note.missed = true;
        note.rating = RATING.MISS;
        note.missTime = performance.now();
        this.registerHit(RATING.MISS, note);
      }
    }

    this.notes = this.notes.filter((n) => {
      if (n.hit) return performance.now() - (n.hitTime || 0) < 300;
      if (n.missed) return performance.now() - (n.missTime || 0) < 500;
      return true;
    });
  }

  notifyDodgeScoreUpdate() {
    if (this.onScoreUpdate) {
      this.onScoreUpdate({
        score: this.score,
        combo: this.combo,
        rating: null,
        side: null,
        lane: null,
      });
    }
  }

  updateDodgeBullets(dt, nowMs) {
    const level = this.trainingLevel || 1;

    this._dodgeScoreFrac = (this._dodgeScoreFrac || 0) + dt * (12 + level * 2);
    const passive = Math.floor(this._dodgeScoreFrac);
    if (passive > 0) {
      this.score += passive;
      this._dodgeScoreFrac -= passive;
      this.notifyDodgeScoreUpdate();
    }

    for (const bullet of this.dodgeBullets) {
      if (bullet.hit) continue;

      if (bullet.state === 'warning' && nowMs >= bullet.fireTimeMs) {
        bullet.state = 'firing';
      }

      if (bullet.state === 'firing') {
        const prevX = bullet.x;
        const prevY = bullet.y;
        const move = bullet.speed * dt;
        bullet.x += Math.cos(bullet.angle) * move;
        bullet.y += Math.sin(bullet.angle) * move;
        bullet.traveled = (bullet.traveled || 0) + move;

        const offScreen =
          bullet.x < -60 || bullet.x > this.canvas.width + 60 ||
          bullet.y < -60 || bullet.y > this.canvas.height + 60 ||
          (bullet.traveled || 0) > bullet.length;

        if (offScreen) {
          bullet.state = 'done';
          this.stats.excellent++;
          this.combo++;
          this.maxCombo = Math.max(this.maxCombo, this.combo);
          this.score += 20 + level * 3;
          this.notifyDodgeScoreUpdate();
          continue;
        }

        if (nowMs >= this.dodgeInvincibleUntilMs && !this.isVoidDashing()) {
          const hitR = bullet.radius + this.ballRadius;
          if (segmentHitsCircle(prevX, prevY, bullet.x, bullet.y, this.playerX, this.playerY, hitR)) {
            bullet.hit = true;
            bullet.hitTime = nowMs;
            bullet.state = 'done';
            this.registerDodgeHit();
          }
        }
      }
    }

    this.dodgeBullets = this.dodgeBullets.filter((b) => {
      if (b.hit) return nowMs - (b.hitTime || 0) < 400;
      return b.state !== 'done';
    });
  }

  spawnDodgeHitParticles() {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
      const speed = 100 + Math.random() * 150;
      this.particles.push({
        x: this.playerX,
        y: this.playerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: '#ff4444',
        size: 4 + Math.random() * 4,
      });
    }
  }

  registerDodgeHit() {
    if (this.hasAbility('ghost-phase') && !this.abilityState.ghostPhaseUsed) {
      this.abilityState.ghostPhaseUsed = true;
      this.dodgeInvincibleUntilMs = performance.now() + 800;
      audioEngine.playParrySound('good');
      this.consumeActiveAbility('ghost-phase');
      this.notifyDodgeHealthUpdate();
      return;
    }

    this.stats.miss++;
    this.combo = 0;
    this.score = Math.max(0, this.score - 25);
    this.dodgeHealth = Math.max(0, this.dodgeHealth - DODGE_HIT_DAMAGE);
    this.dodgeInvincibleUntilMs = performance.now() + 600;
    audioEngine.playParrySound('miss');
    this.screenShake = 8;
    this.spawnDodgeHitParticles();

    if (this.onScoreUpdate) {
      this.onScoreUpdate({
        score: this.score,
        combo: this.combo,
        rating: RATING.MISS,
        side: null,
        lane: null,
        health: this.dodgeHealth,
        maxHealth: this.dodgeMaxHealth,
      });
    }

    if (this.dodgeHealth <= 0) {
      this.handleDodgeDefeat();
    }
  }

  notifyDodgeHealthUpdate() {
    if (!this.onScoreUpdate || this.playMode !== 'dodge') return;
    this.onScoreUpdate({
      score: this.score,
      combo: this.combo,
      rating: null,
      side: null,
      lane: null,
      health: this.dodgeHealth,
      maxHealth: this.dodgeMaxHealth,
    });
  }

  handleBossDefeat() {
    if (this.state !== 'playing' || this.playMode !== 'boss') return;
    const data = this.getTrainingSummary();
    data.defeated = true;
    this.state = 'complete';
    this.stop();
    if (this.onDodgeDefeat) this.onDodgeDefeat(data);
  }

  handleDodgeDefeat() {
    if (this.state !== 'playing' || this.playMode !== 'dodge') return;
    const data = this.getTrainingSummary();
    data.defeated = true;
    this.state = 'complete';
    this.stop();
    if (this.onDodgeDefeat) this.onDodgeDefeat(data);
  }

  handleKeyDown(e) {
    if (this.state !== 'playing') return;

    const key = e.key.toLowerCase();
    if (key === 'escape') {
      e.preventDefault();
      if ((this.trainingMode || this.playMode === 'dodge' || this.playMode === 'boss') && this.onTrainingExit) {
        this.onTrainingExit();
      }
      return;
    }
    if (key === 'r' && (this.trainingMode || this.playMode === 'dodge' || this.playMode === 'boss')) {
      e.preventDefault();
      if (this.onTrainingRestart) this.onTrainingRestart();
      return;
    }
    if (e.key === ' ' || e.code === 'Space') {
      if (this.hasAbility('op-overdrive')) {
        e.preventDefault();
        this.triggerOverdrive();
      }
      return;
    }
    if (key === 'v') {
      if (this.hasAbility('op-void-dash')) {
        e.preventDefault();
        this.triggerVoidDash();
      }
      return;
    }
    if (this.playMode === 'dodge' || this.playMode === 'boss') return;

    if (!KEY_MAP[key]) return;

    const layers = getSongLayers(this.song);
    if (layers === 1 && (key === 'g' || key === 'k')) return;

    e.preventDefault();

    this.keyFlash[key] = 1;
    const { side, lane } = KEY_MAP[key];
    const currentTime = audioEngine.getCurrentTime();

    let bestNote = null;
    let bestDist = Infinity;

    for (const note of this.notes) {
      if (note.hit || note.missed) continue;
      if (note.side !== side || note.lane !== lane) continue;

      const dist = Math.abs(note.x - this.centerX);
      if (dist < bestDist) {
        bestDist = dist;
        bestNote = note;
      }
    }

    if (!bestNote) {
      this.registerHit(RATING.BAD, null, side, lane);
      return;
    }

    const windows = this.getParryTimingWindows();
    let rating;
    if (bestDist <= windows.excellent) rating = RATING.EXCELLENT;
    else if (bestDist <= windows.good) rating = RATING.GOOD;
    else if (bestDist <= windows.medium) rating = RATING.MEDIUM;
    else rating = RATING.BAD;

    bestNote.hit = true;
    bestNote.hitTime = performance.now();
    bestNote.rating = rating;
    this.registerHit(rating, bestNote, side, lane);
  }

  triggerOverdrive() {
    if (!this.hasAbility('op-overdrive')) return;
    const now = performance.now();
    if (this.overdriveWave && now - this.overdriveWave.startMs < this.overdriveWave.durationMs) return;
    if (now - (this.abilityState.lastOverdriveMs || 0) < 750) return;

    const cosmic = this.isCosmicSkin();
    this.abilityState.lastOverdriveMs = now;

    const cx = this.playMode === 'dodge' || this.playMode === 'boss' ? this.playerX : this.centerX;
    const cy = this.playMode === 'dodge' || this.playMode === 'boss' ? this.playerY : this.centerY;
    const maxR = Math.max(this.canvas.width, this.canvas.height) * (cosmic ? 0.62 : 0.55);
    const durationMs = cosmic ? 900 : 550;

    this.overdriveWave = { startMs: now, durationMs, maxRadius: maxR, cx, cy, cosmic };
    if (cosmic) {
      this.overdriveWave2 = {
        startMs: now + 140,
        durationMs: 720,
        maxRadius: maxR * 0.72,
        cx,
        cy,
        cosmic: true,
      };
      this.spawnCosmicConstellation(cx, cy, maxR, now);
    } else {
      this.overdriveWave2 = null;
      this.overdriveConstellation = null;
    }

    this.screenShake = cosmic ? 22 : 14;
    audioEngine.playParrySound('excellent');

    const burstColors = cosmic
      ? ['#e040fb', '#40c4ff', '#b8f0ff', '#7b2cbf', '#ffffff']
      : ['#ffd700', '#ffee88', '#ffffff'];
    const burstCount = cosmic ? 48 : 28;

    if (this.playMode === 'dodge' || this.playMode === 'boss') {
      let cleared = 0;
      const attackList = this.playMode === 'boss' ? this.bossAttacks : this.dodgeBullets;
      for (const bullet of attackList) {
        if (bullet.hit || bullet.state === 'done') continue;
        bullet.hit = true;
        bullet.hitTime = now;
        bullet.state = 'done';
        cleared++;
      }
      if (this.playMode === 'boss') {
        const minionCleared = this.bossMinions.length;
        if (minionCleared > 0) {
          this.bossMinions = [];
          cleared += minionCleared;
        }
      }
      if (this.playMode === 'boss' && this.boss) {
        this.stunBoss(BOSS_STUN_MS, now);
        const shockDamage = Math.floor(this.boss.maxHealth * (cosmic ? 0.18 : 0.1));
        this.damageBoss(shockDamage, now);
      }
      if (cleared > 0) {
        this.stats.excellent += cleared;
        this.combo += cleared;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
      }
      if (cosmic || this.playMode === 'boss') {
        this.dodgeInvincibleUntilMs = now + (cosmic ? 900 : 700);
      }
      for (let i = 0; i < burstCount; i++) {
        const angle = (Math.PI * 2 * i) / burstCount + Math.random() * 0.4;
        const speed = (cosmic ? 220 : 180) + Math.random() * (cosmic ? 280 : 220);
        this.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: burstColors[i % burstColors.length],
          size: cosmic ? 4 + Math.random() * 6 : 5 + Math.random() * 5,
        });
      }
      if (this.onScoreUpdate) {
        this.onScoreUpdate({
          score: this.score,
          combo: this.combo,
          rating: cleared > 0 || this.playMode === 'boss' ? RATING.EXCELLENT : null,
          side: null,
          lane: null,
          bossHealth: this.boss?.health,
          bossMaxHealth: this.boss?.maxHealth,
          bossStunned: this.playMode === 'boss' && now < this.bossStunnedUntilMs,
        });
      }
      this.refreshAbilityHud();
      return;
    }

    const pending = this.notes.filter((n) => !n.hit && !n.missed);
    for (const note of pending) {
      note.hit = true;
      note.hitTime = now;
      note.rating = RATING.EXCELLENT;
      this.registerHit(RATING.EXCELLENT, note, note.side, note.lane);
    }

    for (let i = 0; i < (cosmic ? 36 : 0); i++) {
      const angle = (Math.PI * 2 * i) / 36;
      const speed = 140 + Math.random() * 200;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: burstColors[i % burstColors.length],
        size: 4 + Math.random() * 5,
      });
    }

    this.refreshAbilityHud();
  }

  applyVoidDashParrySkip(current, newTime) {
    const now = performance.now();
    let skipped = 0;

    const markExcellent = (side, lane) => {
      this.registerHit(RATING.EXCELLENT, null, side, lane, { silent: true });
      skipped++;
    };

    for (const note of this.notes) {
      if (note.hit || note.missed) continue;
      note.hit = true;
      note.hitTime = now;
      note.rating = RATING.EXCELLENT;
      markExcellent(note.side, note.lane);
    }

    if (this.endlessMode) {
      const startLevel = this.song.startLevel || 3;
      const layers = getSongLayers(this.song);
      let simTime = this.nextSpawnTime;
      let simCounter = this.spawnBeatCounter;

      while (simTime <= newTime) {
        if (simTime > current) {
          const level = getTrainingLevel(simTime, startLevel);
          const pattern = pickEndlessNotes(level, layers, simCounter);
          for (const { side, lane } of pattern) {
            markExcellent(side, lane);
            this.totalNotes++;
          }
        }
        const level = getTrainingLevel(simTime, startLevel);
        simTime += getEndlessSpawnInterval(level, this.song.bpm);
        simCounter++;
      }

      this.spawnBeatCounter = simCounter;
      this.nextSpawnTime = simTime;
    } else if (this.beatMap.length) {
      for (let i = this.noteIndex; i < this.beatMap.length; i++) {
        const beat = this.beatMap[i];
        if (beat.time <= current) continue;
        if (beat.time > newTime) break;
        markExcellent(beat.side, beat.lane);
      }
    }

    if (skipped > 0) {
      audioEngine.playParrySound('excellent');
      for (let i = 0; i < Math.min(skipped, 20); i++) {
        const angle = (Math.PI * 2 * i) / Math.min(skipped, 20);
        const speed = 90 + Math.random() * 120;
        this.particles.push({
          x: this.centerX,
          y: this.centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: '#ffd700',
          size: 4 + Math.random() * 4,
        });
      }
      if (this.onScoreUpdate) {
        this.onScoreUpdate({
          score: this.score,
          combo: this.combo,
          rating: RATING.EXCELLENT,
          side: null,
          lane: null,
          ability: 'op-void-dash',
        });
      }
    }

    return skipped;
  }

  triggerVoidDash() {
    if (!this.hasAbility('op-void-dash')) return;
    const now = performance.now();
    const cosmic = this.isCosmicSkin();
    const DASH_MS = cosmic ? 460 : 380;

    if (this.playMode === 'dodge' || this.playMode === 'boss') {
      const margin = this.ballRadius + 28;
      const fromX = this.playerX;
      const fromY = this.playerY;
      this.playerX = margin + Math.random() * (this.canvas.width - margin * 2);
      this.playerY = margin + Math.random() * (this.canvas.height - margin * 2);
      this.voidDashUntilMs = now + DASH_MS;
      this.dodgeInvincibleUntilMs = now + DASH_MS;
      this.voidDashEffect = {
        fromX,
        fromY,
        toX: this.playerX,
        toY: this.playerY,
        startMs: now,
        durationMs: DASH_MS,
        cosmic,
      };
      this.screenShake = cosmic ? 8 : 5;
      audioEngine.playParrySound(cosmic ? 'excellent' : 'good');

      const burstColors = cosmic
        ? ['#e8f4ff', '#b8f0ff', '#e040fb', '#40c4ff', '#ffffff']
        : ['#aa66ff'];
      const burstCount = cosmic ? 36 : 20;
      for (let i = 0; i < burstCount; i++) {
        const t = i / burstCount;
        const angle = Math.random() * Math.PI * 2;
        const speed = cosmic ? 140 + Math.random() * 200 : 120 + Math.random() * 160;
        this.particles.push({
          x: fromX + (this.playerX - fromX) * t,
          y: fromY + (this.playerY - fromY) * t,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: burstColors[i % burstColors.length],
          size: cosmic ? 2 + Math.random() * 5 : 3 + Math.random() * 4,
        });
      }

      if (this.onScoreUpdate) {
        this.onScoreUpdate({
          score: this.score,
          combo: this.combo,
          rating: null,
          side: null,
          lane: null,
          ability: 'op-void-dash',
        });
      }
      return;
    }

    const skipSec = this.endlessMode ? 4 : 6;
    const current = audioEngine.getCurrentTime();
    const maxTime = this.song.duration ? this.song.duration - 1.5 : current + skipSec;
    const newTime = Math.min(current + skipSec, maxTime);

    const skippedCount = this.applyVoidDashParrySkip(current, newTime);

    audioEngine.seekTo(newTime);
    this.notes = [];

    if (!this.endlessMode && this.beatMap.length) {
      while (this.noteIndex < this.beatMap.length && this.beatMap[this.noteIndex].time <= newTime) {
        this.noteIndex++;
      }
    }

    this.voidDashEffect = {
      fromX: this.centerX,
      fromY: this.centerY,
      toX: this.centerX,
      toY: this.centerY,
      startMs: now,
      durationMs: DASH_MS,
      parry: true,
      cosmic,
    };
    this.voidDashUntilMs = now + DASH_MS;
    this.screenShake = cosmic ? 14 : 10;
    if (!skippedCount) audioEngine.playParrySound(cosmic ? 'excellent' : 'medium');

    if (!skippedCount) {
      const burstColors = cosmic
        ? ['#e8f4ff', '#b8f0ff', '#e040fb', '#40c4ff', '#ffffff']
        : ['#cc44ff'];
      const burstCount = cosmic ? 40 : 24;
      for (let i = 0; i < burstCount; i++) {
        const angle = (Math.PI * 2 * i) / burstCount + (cosmic ? Math.random() * 0.4 : 0);
        const speed = cosmic ? 120 + Math.random() * 180 : 100 + Math.random() * 140;
        this.particles.push({
          x: this.centerX,
          y: this.centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: burstColors[i % burstColors.length],
          size: cosmic ? 3 + Math.random() * 5 : 4 + Math.random() * 3,
        });
      }

      if (this.onScoreUpdate) {
        this.onScoreUpdate({
          score: this.score,
          combo: this.combo,
          rating: null,
          side: null,
          lane: null,
          ability: 'op-void-dash',
        });
      }
    }
  }

  getAbilityHints() {
    const hints = [];
    if (this.hasAbility('op-overdrive')) hints.push('SPACE');
    if (this.hasAbility('op-void-dash')) hints.push('V');
    return hints;
  }

  getLaneY(lane) {
    const layers = getSongLayers(this.song);
    if (layers === 1) return this.centerY;
    return this.centerY + (lane === 0 ? -this.laneOffset : this.laneOffset);
  }

  registerHit(rating, note, side, lane, opts = {}) {
    const silent = !!opts.silent;
    if (
      rating === RATING.MISS &&
      this.hasAbility('second-chance') &&
      !this.abilityState.secondChanceUsed
    ) {
      this.abilityState.secondChanceUsed = true;
      this.consumeActiveAbility('second-chance');
      if (note) {
        note.missed = false;
        note.hit = true;
        note.hitTime = performance.now();
        note.rating = RATING.MEDIUM;
      }
      rating = RATING.MEDIUM;
    }

    if (
      !this.trainingMode &&
      this.hasAbility('combo-shield') &&
      !this.abilityState.comboShieldUsed &&
      (rating === RATING.MISS || rating === RATING.BAD)
    ) {
      this.abilityState.comboShieldUsed = true;
      this.consumeActiveAbility('combo-shield');
      this.stats[rating]++;
      if (!silent) audioEngine.playParrySound(rating);
      this.screenShake = rating === RATING.MISS ? 3 : 4;
      if (note && rating === RATING.MISS) note.missTime = performance.now();
      if (this.onScoreUpdate) {
        this.onScoreUpdate({
          score: this.score,
          combo: this.combo,
          rating,
          side,
          lane,
          ability: 'combo-shield',
        });
      }
      return;
    }

    this.stats[rating]++;

    if (rating === RATING.MISS) {
      if (!this.trainingMode) this.combo = 0;
      if (note) note.missTime = performance.now();
      if (!this.trainingMode) {
        this.score = Math.max(0, this.score + RATING_SCORE.miss);
      }
      if (!silent) audioEngine.playParrySound('miss');
      this.screenShake = this.trainingMode ? 2 : 6;
    } else if (rating === RATING.BAD) {
      if (!this.trainingMode) {
        this.combo = 0;
        this.score = Math.max(0, this.score + RATING_SCORE.bad);
      }
      if (!silent) audioEngine.playParrySound(rating);
      this.screenShake = this.trainingMode ? 2 : 5;
      if (!silent) this.spawnParticles(side, lane, rating);
    } else {
      let points = RATING_SCORE[rating];
      const comboCap = 50 + (this.skinPassives.comboCapBonus || 0);
      const comboBonus = this.trainingMode ? 0 : Math.min(this.combo * 2, comboCap);
      const scoreMult = this.skinPassives.scoreMult || 1;
      if (!this.trainingMode && this.hasAbility('score-boost')) {
        points = Math.floor((points + comboBonus) * 1.25 * scoreMult);
        this.score += points;
      } else {
        this.score += Math.floor((points + comboBonus) * scoreMult);
      }
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      if (!silent) audioEngine.playParrySound(rating);
      this.screenShake = rating === RATING.EXCELLENT ? 6 : rating === RATING.GOOD ? 4 : 2;
      if (!silent) this.spawnParticles(side, lane, rating);
    }

    if (!silent || opts.forceScoreUpdate) {
      if (this.onScoreUpdate) {
        this.onScoreUpdate({
          score: this.score,
          combo: this.combo,
          rating,
          side,
          lane,
        });
      }
    }
  }

  spawnParticles(side, lane, rating) {
    const y = this.getLaneY(lane);
    const x = this.centerX + (side === 'left' ? -30 : 30);
    const colors = {
      excellent: '#ffd700',
      good: '#4dff88',
      medium: '#4d9fff',
      bad: '#ff9944',
      miss: '#ff4d4d',
    };
    const count = rating === RATING.EXCELLENT ? 16 : 8;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 80 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: colors[rating] || '#ffffff',
        size: 3 + Math.random() * 4,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 2;
      p.vy += 200 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  updateKeyFlash(dt) {
    for (const key of ['f', 'g', 'j', 'k']) {
      if (this.keyFlash[key] > 0) {
        this.keyFlash[key] = Math.max(0, this.keyFlash[key] - dt * 4);
      }
    }
  }

  checkComplete(currentTime) {
    if (this.endlessMode) return;

    if (currentTime >= this.song.duration + 1) {
      const activeAbilities = [...this.activeAbilities];
      const wasTraining = this.trainingMode;
      const wasNightmare = this.nightmareMode;
      const songId = this.song?.id || null;
      const finalStats = { ...this.stats };

      const weighted =
        finalStats.excellent * 100 +
        finalStats.good * 75 +
        finalStats.medium * 50 +
        finalStats.bad * (wasTraining ? 0 : -25) +
        finalStats.miss * (wasTraining ? 0 : -50);
      const accuracy = this.totalNotes > 0
        ? Math.max(0, Math.min(100, Math.round(weighted / this.totalNotes)))
        : 0;

      this.state = 'complete';
      this.stop();

      if (this.onComplete) {
        this.onComplete({
          score: this.score,
          accuracy,
          grade: wasTraining ? null : getGrade(accuracy),
          stats: finalStats,
          maxCombo: this.maxCombo,
          training: wasTraining,
          nightmare: wasNightmare,
          songId,
          activeAbilities,
        });
      }
    }
  }

  tickPlaying() {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    try {
      const currentTime = audioEngine.getCurrentTime();
      this.spawnNotes(currentTime);
      this.updateNotes(dt, currentTime);
      this.updateParticles(dt);
      this.updateKeyFlash(dt);

      if (this.screenShake > 0) {
        this.screenShake = Math.max(0, this.screenShake - dt * 20);
      }

      if (this.overdriveWave && now - this.overdriveWave.startMs > this.overdriveWave.durationMs) {
        this.overdriveWave = null;
      }
      if (this.overdriveWave2 && now - this.overdriveWave2.startMs > this.overdriveWave2.durationMs) {
        this.overdriveWave2 = null;
      }
      if (this.overdriveConstellation && now - this.overdriveConstellation.startMs > this.overdriveConstellation.durationMs) {
        this.overdriveConstellation = null;
      }
      if (this.voidDashEffect && now - this.voidDashEffect.startMs > this.voidDashEffect.durationMs) {
        this.voidDashEffect = null;
      }

      this.checkComplete(currentTime);

      if (this.playMode === 'dodge' && this.onScoreUpdate) {
        const tick = Math.floor(this.getDodgeElapsed());
        if (tick !== this._lastDodgeScoreTick) {
          this._lastDodgeScoreTick = tick;
          this.onScoreUpdate({
            score: this.score,
            combo: this.combo,
            rating: null,
            side: null,
            lane: null,
          });
        }
      }

      if (this.playMode === 'boss' && this.onScoreUpdate && this.boss) {
        this.onScoreUpdate({
          score: this.score,
          combo: this.combo,
          rating: null,
          side: null,
          lane: null,
          health: this.dodgeHealth,
          maxHealth: this.dodgeMaxHealth,
          bossHealth: this.boss.health,
          bossMaxHealth: this.boss.maxHealth,
          bossRound: this.bossRound,
          bossStunned: performance.now() < this.bossStunnedUntilMs,
        });
      }
    } catch (err) {
      console.error('[BeatParryGame] update failed:', err);
    }

    try {
      this.draw();
    } catch (err) {
      console.error('[BeatParryGame] draw failed:', err);
    }
  }

  draw() {
    if (this.playMode === 'boss') {
      this.renderBossScene();
      return;
    }
    if (this.playMode === 'dodge') {
      this.renderDodgeScene();
      return;
    }
    this.renderParryScene(this.song);
  }

  renderParryScene(song) {
    if (!song) return;
    const ctx = this.ctx;
    const shakeX = (Math.random() - 0.5) * this.screenShake;
    const shakeY = (Math.random() - 0.5) * this.screenShake;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.clearRect(-50, -50, this.canvas.width + 100, this.canvas.height + 100);

    const prevSong = this.song;
    this.song = song;
    this.drawBackground(ctx);
    this.drawLine(ctx);
    this.drawLaneGuides(ctx);
    this.drawPlayerBall(ctx);
    this.drawNotes(ctx);
    this.drawParticles(ctx);
    this.drawOverdriveWave(ctx);
    this.drawVoidDashEffect(ctx);
    this.drawKeyIndicators(ctx);
    if (this.trainingMode) this.drawTrainingHints(ctx);
    this.song = prevSong;

    ctx.restore();
  }

  renderDodgeScene() {
    const ctx = this.ctx;
    const shakeX = (Math.random() - 0.5) * this.screenShake;
    const shakeY = (Math.random() - 0.5) * this.screenShake;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.clearRect(-50, -50, this.canvas.width + 100, this.canvas.height + 100);

    this.drawDodgeBackground(ctx);
    this.drawDodgeWarnings(ctx);
    this.drawDodgeBullets(ctx);
    this.drawDodgePlayer(ctx);
    this.drawDodgePlayerHealth(ctx);
    this.drawParticles(ctx);
    this.drawOverdriveWave(ctx);
    this.drawVoidDashEffect(ctx);
    this.drawDodgeHints(ctx);

    ctx.restore();
  }

  drawTrainingHints(ctx) {
    ctx.font = 'bold 16px Segoe UI, sans-serif';
    ctx.textAlign = 'center';

    for (const note of this.notes) {
      if (note.hit || note.missed) continue;
      const dist = Math.abs(note.x - this.centerX);
      if (dist > this.lineLength * 0.45) continue;

      const y = this.getLaneY(note.lane);
      const key = getKeyForNote(note.side, note.lane);
      const alpha = 0.4 + (1 - dist / (this.lineLength * 0.45)) * 0.6;

      ctx.fillStyle = `rgba(77, 255, 136, ${alpha})`;
      ctx.fillText(key, note.x, y - 22);
    }

    ctx.font = '600 11px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(136, 136, 170, 0.7)';
    ctx.textAlign = 'left';
    const levelText = `Level ${this.trainingLevel} · ESC quit · R restart`;
    ctx.fillText(levelText, 16, this.canvas.height - 16);
  }

  drawBackground(ctx) {
    const progress = this.getProgress();
    const intensity = 0.1 + progress * 0.15;
    const gradient = ctx.createRadialGradient(
      this.centerX, this.centerY, 0,
      this.centerX, this.centerY, this.lineLength * 0.6
    );
    const c = this.trainingMode ? '#4dff88' : (this.song?.color || '#ff6b9d');
    gradient.addColorStop(0, this.hexToRgba(c, intensity));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  ballColorToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  drawLine(ctx) {
    const half = this.lineLength / 2;
    ctx.beginPath();
    ctx.moveTo(this.centerX - half, this.centerY);
    ctx.lineTo(this.centerX + half, this.centerY);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, this.hitZone, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawLaneGuides(ctx) {
    const half = this.lineLength / 2;
    const layers = getSongLayers(this.song);
    const offsets = layers === 1
      ? [
          { lane: 0, key: 'f', side: 'left' },
          { lane: 0, key: 'j', side: 'right' },
        ]
      : [
          { lane: 0, key: 'f', side: 'left' },
          { lane: 1, key: 'g', side: 'left' },
          { lane: 0, key: 'j', side: 'right' },
          { lane: 1, key: 'k', side: 'right' },
        ];

    for (const { lane, key, side } of offsets) {
      const y = this.getLaneY(lane);
      const startX = side === 'left' ? this.centerX - half : this.centerX;
      const endX = side === 'left' ? this.centerX : this.centerX + half;

      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.strokeStyle = `rgba(255,255,255,${0.06 + this.keyFlash[key] * 0.2})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  getPlayerBallColor() {
    if (this.activeSkin?.colors?.primary) return this.activeSkin.colors.primary;
    if (this.playMode === 'dodge') return this.song?.color || '#ff6b6b';
    return getBallColor(this.song);
  }

  getPlayerGlowColor() {
    return this.activeSkin?.colors?.glow || this.getPlayerBallColor();
  }

  isCosmicSkin() {
    return this.activeSkin?.effect === 'cosmic' || this.activeSkin?.id === 'skin-void-god';
  }

  initCosmicOrbitals() {
    if (!this.isCosmicSkin()) {
      this.cosmicOrbitals = [];
      return;
    }
    this.cosmicOrbitals = Array.from({ length: 14 }, () => ({
      angle: Math.random() * Math.PI * 2,
      dist: 0.5 + Math.random() * 0.5,
      speed: 0.6 + Math.random() * 1.4,
      size: 0.8 + Math.random() * 2.2,
      twinkle: Math.random() * Math.PI * 2,
    }));
  }

  updateSkinTrail(x, y) {
    if (!this.skinPassives.trail) return;
    this._skinTrailTick = (this._skinTrailTick || 0) + 1;
    if (this._skinTrailTick % 2 !== 0) return;

    if (this.isCosmicSkin()) {
      const palette = ['#e040fb', '#40c4ff', '#b8f0ff', '#7b2cbf', '#ffffff', '#3a0ca3'];
      this.skinTrail.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        life: 1,
        color: palette[Math.floor(Math.random() * palette.length)],
        size: 1.5 + Math.random() * 4,
        star: Math.random() > 0.55,
      });
      if (this.skinTrail.length > 36) this.skinTrail.shift();
    } else {
      this.skinTrail.push({
        x,
        y,
        life: 1,
        color: this.activeSkin?.colors?.glow || '#cc44ff',
        size: 6,
        star: false,
      });
      if (this.skinTrail.length > 24) this.skinTrail.shift();
    }

    for (const point of this.skinTrail) {
      point.life -= this.isCosmicSkin() ? 0.035 : 0.06;
    }
    this.skinTrail = this.skinTrail.filter((point) => point.life > 0);
  }

  drawSkinTrail(ctx) {
    if (!this.skinTrail.length) return;
    for (const point of this.skinTrail) {
      ctx.save();
      if (point.star) {
        const s = point.size * point.life;
        ctx.globalAlpha = point.life * 0.9;
        ctx.fillStyle = point.color;
        ctx.shadowColor = point.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(point.x, point.y, s, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = point.life * 0.4;
        ctx.beginPath();
        ctx.arc(point.x, point.y, (point.size || 6) + point.life * 8, 0, Math.PI * 2);
        ctx.fillStyle = point.color;
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawCosmicPlayer(ctx, x, y, r) {
    const t = performance.now() * 0.001;
    const colors = this.activeSkin?.colors || {};

    const nebulaR = r + 32;
    const nebula = ctx.createRadialGradient(x, y, r * 0.05, x, y, nebulaR);
    nebula.addColorStop(0, 'rgba(224, 64, 251, 0.42)');
    nebula.addColorStop(0.3, 'rgba(123, 44, 191, 0.3)');
    nebula.addColorStop(0.55, 'rgba(58, 12, 163, 0.22)');
    nebula.addColorStop(0.78, 'rgba(0, 80, 180, 0.1)');
    nebula.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebula;
    ctx.beginPath();
    ctx.arc(x, y, nebulaR, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.65);
    ctx.scale(1.4, 0.42);
    const disk = ctx.createLinearGradient(-r * 2.2, 0, r * 2.2, 0);
    disk.addColorStop(0, 'rgba(0,0,0,0)');
    disk.addColorStop(0.15, 'rgba(64, 196, 255, 0.35)');
    disk.addColorStop(0.45, 'rgba(224, 64, 251, 0.9)');
    disk.addColorStop(0.55, 'rgba(255,255,255,0.75)');
    disk.addColorStop(0.75, 'rgba(64, 196, 255, 0.35)');
    disk.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.strokeStyle = disk;
    ctx.lineWidth = 3.5;
    ctx.shadowColor = 'rgba(224, 64, 251, 0.85)';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(0, 0, r + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    for (const star of this.cosmicOrbitals) {
      star.angle += star.speed * 0.018;
      const wobble = Math.sin(t * 2 + star.twinkle) * 0.08;
      const sx = x + Math.cos(star.angle) * r * (star.dist * 1.75 + wobble);
      const sy = y + Math.sin(star.angle) * r * (star.dist * 0.85 + wobble);
      const alpha = 0.45 + Math.sin(t * 4 + star.twinkle) * 0.35;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = star.size > 2 ? colors.core || '#e8f4ff' : colors.accent || '#b8f0ff';
      ctx.shadowColor = colors.glow || '#e040fb';
      ctx.shadowBlur = star.size > 2 ? 8 : 4;
      ctx.beginPath();
      ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const body = ctx.createRadialGradient(x - r * 0.28, y - r * 0.28, 0, x, y, r);
    body.addColorStop(0, colors.core || '#e8f4ff');
    body.addColorStop(0.12, '#c77dff');
    body.addColorStop(0.35, colors.nebula || '#7b2cbf');
    body.addColorStop(0.62, '#3a0ca3');
    body.addColorStop(0.85, colors.primary || '#10002b');
    body.addColorStop(1, '#030109');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();

    ctx.save();
    ctx.globalAlpha = 0.85 + Math.sin(t * 5) * 0.15;
    ctx.beginPath();
    ctx.arc(x - r * 0.14, y - r * 0.14, r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = colors.core || '#e8f4ff';
    ctx.shadowColor = colors.core || '#b8f0ff';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.restore();

    const horizonPulse = 1 + Math.sin(t * 3) * 0.04;
    ctx.strokeStyle = this.ballColorToRgba(colors.ring || '#40c4ff', 0.65);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r * horizonPulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = this.ballColorToRgba(colors.glow || '#e040fb', 0.35);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r + 4 + Math.sin(t * 2) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawSkinAura(ctx, x, y, r) {
    if (this.isCosmicSkin()) return;
    const ring = this.activeSkin?.colors?.ring;
    if (!ring && this.activeSkin?.tier < 4) return;
    const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.08;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, (r + 10) * pulse, 0, Math.PI * 2);
    ctx.strokeStyle = this.ballColorToRgba(ring || this.getPlayerGlowColor(), 0.55);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  drawPlayerBall(ctx) {
    const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.05;
    const r = this.ballRadius * pulse;
    const ballColor = this.getPlayerBallColor();
    const glowColor = this.getPlayerGlowColor();

    this.updateSkinTrail(this.centerX, this.centerY);
    this.drawSkinTrail(ctx);

    if (this.isCosmicSkin()) {
      this.drawCosmicPlayer(ctx, this.centerX, this.centerY, r);
      return;
    }

    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, r + 12, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(
      this.centerX, this.centerY, r * 0.3,
      this.centerX, this.centerY, r + 12
    );
    glow.addColorStop(0, this.ballColorToRgba(glowColor, 0.7));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, r, 0, Math.PI * 2);
    ctx.fillStyle = ballColor;
    ctx.fill();

    ctx.strokeStyle = this.activeSkin?.colors?.accent
      ? this.ballColorToRgba(this.activeSkin.colors.accent, 0.75)
      : 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    this.drawSkinAura(ctx, this.centerX, this.centerY, r);
  }

  drawNotes(ctx) {
    for (const note of this.notes) {
      const y = this.getLaneY(note.lane);
      const dist = Math.abs(note.x - this.centerX);
      const alpha = note.hit ? 0.3 : note.missed ? 0.2 : 1;

      if (note.hit) {
        const scale = 1 + (1 - (performance.now() - note.hitTime) / 300) * 0.5;
        this.drawBall(ctx, note.x, y, this.ballRadius * scale, alpha);
      } else {
        this.drawBall(ctx, note.x, y, this.ballRadius, alpha);

        if (!note.missed && dist < this.hitZone + 20) {
          const glow = 1 - dist / (this.hitZone + 20);
          const ballColor = getBallColor(this.song);
          ctx.beginPath();
          ctx.arc(note.x, y, this.ballRadius + 8 * glow, 0, Math.PI * 2);
          ctx.fillStyle = this.ballColorToRgba(ballColor, glow * 0.35);
          ctx.fill();
        }
      }
    }
  }

  drawBall(ctx, x, y, r, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const ballColor = getBallColor(this.song);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = ballColor;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawKeyIndicators(ctx) {
    const layers = getSongLayers(this.song);
    const keys = layers === 1
      ? [
          { key: 'f', x: this.centerX - 80, y: this.centerY - 30 },
          { key: 'j', x: this.centerX + 80, y: this.centerY - 30 },
        ]
      : [
          { key: 'f', x: this.centerX - 80, y: this.centerY - this.laneOffset - 30 },
          { key: 'g', x: this.centerX - 80, y: this.centerY + this.laneOffset + 30 },
          { key: 'j', x: this.centerX + 80, y: this.centerY - this.laneOffset - 30 },
          { key: 'k', x: this.centerX + 80, y: this.centerY + this.laneOffset + 30 },
        ];

    ctx.font = '600 14px Segoe UI, sans-serif';
    ctx.textAlign = 'center';

    for (const { key, x, y } of keys) {
      const flash = this.keyFlash[key];
      ctx.fillStyle = `rgba(255,255,255,${0.3 + flash * 0.7})`;
      ctx.fillText(key.toUpperCase(), x, y);
    }
  }

  drawDodgeBackground(ctx) {
    const level = this.trainingLevel || 1;
    const intensity = 0.08 + Math.min(level / DODGE_MAX_LEVEL, 1) * 0.12;
    const gradient = ctx.createRadialGradient(
      this.playerX, this.playerY, 0,
      this.playerX, this.playerY, Math.min(this.canvas.width, this.canvas.height) * 0.5
    );
    const c = this.song?.color || '#ff6b6b';
    gradient.addColorStop(0, this.hexToRgba(c, intensity));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawDodgeWarnings(ctx) {
    const nowMs = performance.now();

    for (const bullet of this.dodgeBullets) {
      if (bullet.state !== 'warning') continue;

      const elapsed = nowMs - bullet.warningStartMs;
      if (elapsed < 0) continue;

      const t = Math.min(1, elapsed / bullet.warningDurationMs);
      const glow = t * t;
      const alpha = 0.2 + glow * 0.8;
      const lineWidth = 1.5 + glow * 4.5;

      const endX = bullet.x + Math.cos(bullet.angle) * bullet.length;
      const endY = bullet.y + Math.sin(bullet.angle) * bullet.length;

      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.lineWidth = lineWidth;
      ctx.shadowColor = `rgba(255, 255, 255, ${0.3 + glow * 0.7})`;
      ctx.shadowBlur = 4 + glow * 20;
      ctx.beginPath();
      ctx.moveTo(bullet.x, bullet.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawDodgeBullets(ctx) {
    for (const bullet of this.dodgeBullets) {
      if (bullet.state !== 'firing' || bullet.hit) continue;

      const trailX = bullet.x - Math.cos(bullet.angle) * 18;
      const trailY = bullet.y - Math.sin(bullet.angle) * 18;

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.5)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(trailX, trailY);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ff4444';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawDodgePlayerHealth(ctx) {
    const barW = 64;
    const barH = 7;
    const x = this.playerX - barW / 2;
    const y = this.playerY - this.ballRadius - 24;
    const pct = Math.max(0, Math.min(1, this.dodgeHealth / this.dodgeMaxHealth));

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(x - 1, y - 1, barW + 2, barH + 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 1, y - 1, barW + 2, barH + 2);

    const fillColor = pct > 0.5
      ? 'rgba(77, 255, 136, 0.85)'
      : pct > 0.25
        ? 'rgba(255, 200, 80, 0.9)'
        : 'rgba(255, 77, 77, 0.95)';
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, barW * pct, barH);
    ctx.restore();
  }

  drawDodgePlayer(ctx) {
    const invincible = performance.now() < this.dodgeInvincibleUntilMs || this.isVoidDashing();
    const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.06;
    const r = this.ballRadius * pulse;
    const color = this.getPlayerBallColor();
    const glowColor = this.getPlayerGlowColor();

    this.updateSkinTrail(this.playerX, this.playerY);
    this.drawSkinTrail(ctx);

    if (invincible) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.02) * 0.3;
    }

    if (this.isCosmicSkin()) {
      this.drawCosmicPlayer(ctx, this.playerX, this.playerY, r);
      if (invincible) ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.arc(this.playerX, this.playerY, r + 14, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(
      this.playerX, this.playerY, r * 0.2,
      this.playerX, this.playerY, r + 14
    );
    glow.addColorStop(0, this.ballColorToRgba(glowColor, 0.65));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.playerX, this.playerY, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = this.activeSkin?.colors?.accent
      ? this.ballColorToRgba(this.activeSkin.colors.accent, 0.8)
      : 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    this.drawSkinAura(ctx, this.playerX, this.playerY, r);

    if (invincible) ctx.restore();
  }

  spawnCosmicConstellation(cx, cy, maxR, startMs = performance.now()) {
    const pattern = [
      { ax: 0, ay: -0.36 },
      { ax: 0.4, ay: -0.1 },
      { ax: 0.26, ay: 0.4 },
      { ax: -0.34, ay: 0.3 },
      { ax: -0.46, ay: -0.2 },
    ];
    const stars = pattern.map((p, i) => {
      const normR = Math.hypot(p.ax, p.ay) * 0.55;
      const angle = Math.atan2(p.ay, p.ax);
      return {
        angle,
        normR,
        size: 9 + (i % 2) * 6,
        spin: (Math.random() - 0.5) * 0.5,
        dust: Array.from({ length: 22 }, () => {
          const dist = 6 + Math.random() * 26;
          const dAngle = Math.random() * Math.PI * 2;
          return {
            dist,
            dAngle,
            s: 0.4 + Math.random() * 1.6,
          };
        }),
      };
    });
    this.overdriveConstellation = {
      startMs,
      durationMs: 900,
      cx,
      cy,
      maxRadius: maxR,
      stars,
      links: [[0, 1], [1, 2], [2, 3], [3, 4], [0, 2], [1, 4], [0, 3]],
      spinSpeed: 0.85,
    };
  }

  drawSparkStar(ctx, x, y, size, alpha, rotation = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.globalAlpha = alpha;
    const arm = size * 1.1;
    const thick = Math.max(1.2, size * 0.14);

    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.8);
    halo.addColorStop(0, 'rgba(255,255,255,0.95)');
    halo.addColorStop(0.35, 'rgba(200,230,255,0.35)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(184, 240, 255, 0.95)';
    ctx.shadowBlur = size * 0.9;
    ctx.fillRect(-thick / 2, -arm, thick, arm * 2);
    ctx.fillRect(-arm, -thick / 2, arm * 2, thick);

    ctx.beginPath();
    ctx.arc(0, 0, size * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawOverdriveConstellation(ctx) {
    const constellation = this.overdriveConstellation;
    const wave = this.overdriveWave;
    if (!constellation || !wave) return;

    const now = performance.now();
    const t = Math.min(1, (now - constellation.startMs) / constellation.durationMs);
    const waveT = Math.min(1, Math.max(0, (now - wave.startMs) / wave.durationMs));
    if (waveT <= 0 || waveT >= 1) return;

    const waveRadius = wave.maxRadius * waveT;
    const spin = t * constellation.spinSpeed;
    const alpha = waveT < 0.06 ? waveT / 0.06 : (t > 0.7 ? (1 - t) / 0.3 : 1);
    if (alpha <= 0) return;

    const placed = constellation.stars.map((star) => {
      const a = star.angle + spin;
      const r = star.normR * waveRadius;
      return {
        x: constellation.cx + Math.cos(a) * r,
        y: constellation.cy + Math.sin(a) * r,
        size: star.size,
        dust: star.dust,
        starSpin: star.spin + t * Math.PI * 1.6,
        baseAngle: a,
      };
    });

    ctx.save();
    ctx.globalAlpha = alpha * 0.55;
    for (const dot of placed) {
      for (const d of dot.dust) {
        const dustAngle = d.dAngle + spin;
        const px = dot.x + Math.cos(dustAngle) * d.dist;
        const py = dot.y + Math.sin(dustAngle) * d.dist;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(px, py, d.s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    if (waveT > 0.2) {
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.2;
      ctx.shadowColor = 'rgba(184, 240, 255, 0.8)';
      ctx.shadowBlur = 6;
      for (const [a, b] of constellation.links) {
        const s1 = placed[a];
        const s2 = placed[b];
        if (!s1 || !s2) continue;
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    for (const star of placed) {
      const sizeScale = 0.65 + waveT * 0.35;
      this.drawSparkStar(ctx, star.x, star.y, star.size * sizeScale, alpha, star.starSpin);
    }
  }

  drawOverdriveRing(ctx, wave, opts = {}) {
    const now = performance.now();
    const { startMs, durationMs, maxRadius, cx, cy, cosmic } = wave;
    const t = Math.min(1, (now - startMs) / durationMs);
    if (t <= 0 || t >= 1) return;

    const radius = maxRadius * t;
    const alpha = (1 - t) * (opts.alphaScale || 0.9);

    ctx.save();
    if (cosmic) {
      const nebula = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
      nebula.addColorStop(0, `rgba(232, 244, 255, ${alpha * 0.35})`);
      nebula.addColorStop(0.35, `rgba(224, 64, 251, ${alpha * 0.28})`);
      nebula.addColorStop(0.65, `rgba(64, 196, 255, ${alpha * 0.18})`);
      nebula.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nebula;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(224, 64, 251, ${alpha * 0.95})`;
      ctx.lineWidth = 4 + (1 - t) * 12;
      ctx.shadowColor = `rgba(64, 196, 255, ${alpha})`;
      ctx.shadowBlur = 20 + (1 - t) * 30;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(184, 240, 255, ${alpha * 0.7})`;
      ctx.lineWidth = 1.5 + (1 - t) * 4;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.82, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = `rgba(255, 220, 80, ${alpha})`;
      ctx.lineWidth = 3 + (1 - t) * 10;
      ctx.shadowColor = `rgba(255, 200, 50, ${alpha})`;
      ctx.shadowBlur = 16 + (1 - t) * 24;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 220, 80, ${alpha * 0.12})`;
      ctx.fill();
    }
    ctx.restore();
  }

  drawOverdriveWave(ctx) {
    if (this.overdriveWave2) {
      this.drawOverdriveRing(ctx, this.overdriveWave2, { alphaScale: 0.75 });
    }
    if (this.overdriveWave) {
      this.drawOverdriveRing(ctx, this.overdriveWave);
    }
    if (this.overdriveConstellation) {
      this.drawOverdriveConstellation(ctx);
    }
  }

  drawVoidDashEffect(ctx) {
    if (!this.voidDashEffect) return;
    const now = performance.now();
    const { fromX, fromY, toX, toY, startMs, durationMs, parry, cosmic } = this.voidDashEffect;
    const t = Math.min(1, (now - startMs) / durationMs);
    const alpha = (1 - t) * 0.9;
    const cx = fromX + (toX - fromX) * t;
    const cy = fromY + (toY - fromY) * t;

    if (cosmic) {
      this.drawCosmicVoidDash(ctx, fromX, fromY, toX, toY, cx, cy, t, alpha, parry);
      return;
    }

    const color = parry ? '170, 68, 255' : '136, 102, 255';

    ctx.save();
    ctx.strokeStyle = `rgba(${color}, ${alpha})`;
    ctx.lineWidth = 2 + (1 - t) * 6;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(cx, cy, 18 + (1 - t) * 28, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${color}, ${alpha * 0.9})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = `rgba(${color}, ${alpha * 0.15})`;
    ctx.fill();
    ctx.restore();
  }

  drawCosmicVoidDash(ctx, fromX, fromY, toX, toY, cx, cy, t, alpha, parry) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    ctx.save();

    const trailSteps = parry ? 10 : Math.max(8, Math.floor(dist / 28));
    for (let i = 0; i <= trailSteps; i++) {
      const stepT = (i / trailSteps) * t;
      const px = fromX + dx * stepT;
      const py = fromY + dy * stepT;
      const stepAlpha = alpha * (0.25 + (1 - stepT) * 0.55);

      const ringR = parry ? 34 + (1 - stepT) * 52 : 14 + (1 - stepT) * 22;
      const nebula = ctx.createRadialGradient(px, py, 0, px, py, ringR);
      nebula.addColorStop(0, `rgba(232, 244, 255, ${stepAlpha * 0.45})`);
      nebula.addColorStop(0.4, `rgba(224, 64, 251, ${stepAlpha * 0.28})`);
      nebula.addColorStop(0.75, `rgba(64, 196, 255, ${stepAlpha * 0.12})`);
      nebula.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nebula;
      ctx.beginPath();
      ctx.arc(px, py, ringR, 0, Math.PI * 2);
      ctx.fill();

      if (i % 2 === 0) {
        this.drawSparkStar(ctx, px, py, 5 + (1 - stepT) * 4, stepAlpha * 0.85, stepT * Math.PI * 3);
      }
    }

    if (!parry || dist > 4) {
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.4;
      ctx.shadowColor = 'rgba(184, 240, 255, 0.9)';
      ctx.shadowBlur = 10;
      ctx.setLineDash([5, 9]);
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.setLineDash([]);

      const perpX = -ny;
      const perpY = nx;
      const linkCount = parry ? 5 : Math.max(3, Math.floor(dist / 60));
      for (let i = 1; i < linkCount; i++) {
        const lt = i / linkCount;
        const lx = fromX + dx * lt * t;
        const ly = fromY + dy * lt * t;
        const spread = parry ? 48 + (1 - lt) * 36 : 22 + (1 - lt) * 18;
        ctx.beginPath();
        ctx.moveTo(lx - perpX * spread, ly - perpY * spread);
        ctx.lineTo(lx + perpX * spread, ly + perpY * spread);
        ctx.stroke();
      }
    }

    const headR = parry ? 56 + (1 - t) * 44 : 24 + (1 - t) * 20;
    const headGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, headR);
    headGlow.addColorStop(0, `rgba(255,255,255,${alpha * 0.55})`);
    headGlow.addColorStop(0.35, `rgba(224, 64, 251, ${alpha * 0.35})`);
    headGlow.addColorStop(0.7, `rgba(64, 196, 255, ${alpha * 0.15})`);
    headGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = headGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, headR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(184, 240, 255, ${alpha * 0.95})`;
    ctx.lineWidth = 2.5 + (1 - t) * 4;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, headR * 0.55, 0, Math.PI * 2);
    ctx.stroke();

    this.drawSparkStar(ctx, cx, cy, 10 + (1 - t) * 8, alpha, t * Math.PI * 4);

    if (parry) {
      const ringCount = 3;
      for (let i = 0; i < ringCount; i++) {
        const ringT = Math.min(1, t * 1.2 + i * 0.08);
        const ringR = 40 + ringT * (120 + i * 30);
        const ringAlpha = alpha * (0.7 - i * 0.18) * (1 - ringT * 0.5);
        ctx.strokeStyle = i % 2 === 0
          ? `rgba(224, 64, 251, ${ringAlpha})`
          : `rgba(64, 196, 255, ${ringAlpha})`;
        ctx.lineWidth = 2 + (1 - ringT) * 3;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  initBossRound(round) {
    const maxHealth = getBossRoundHealth(round);
    const kit = getBossRoundKit(round);
    this.bossRoundKit = kit;
    this.boss = {
      x: this.centerX,
      y: this.canvas.height * 0.28,
      radius: getBossRadius(round),
      health: maxHealth,
      maxHealth,
      name: getBossName(round),
      color: getBossColor(round),
      round,
      signature: kit.signature,
      wobblePhase: Math.random() * Math.PI * 2,
    };
    this.bossRound = round;
    this.trainingLevel = round;
    this.bossAttacks = [];
    this.bossMinions = [];
    this.bossProjectiles = [];
    this.bossRoundCleared = false;
    this.bossClearUntilMs = 0;
    this.bossAttackIndex = 0;
    const now = performance.now();
    this.bossNextAttackMs = now + 900;
    this.playerNextFireMs = now;
    if (this.onScoreUpdate) {
      this.onScoreUpdate({
        score: this.score,
        combo: this.combo,
        rating: null,
        side: null,
        lane: null,
        health: this.dodgeHealth,
        maxHealth: this.dodgeMaxHealth,
        bossHealth: maxHealth,
        bossMaxHealth: maxHealth,
        bossRound: round,
        bossSkill: kit.signature,
        minionCount: 0,
      });
    }
  }

  isBossStunned(nowMs = performance.now()) {
    return nowMs < (this.bossStunnedUntilMs || 0);
  }

  stunBoss(durationMs, nowMs = performance.now()) {
    this.bossStunnedUntilMs = Math.max(this.bossStunnedUntilMs || 0, nowMs + durationMs);
    if (this.boss) {
      this.boss.stunPulse = 1;
    }
  }

  damageBoss(amount, nowMs = performance.now()) {
    if (!this.boss || this.bossRoundCleared) return;
    const mult = this.skinPassives.scoreMult || 1;
    const dmg = Math.max(1, Math.floor(amount * (mult > 1 ? 1 + (mult - 1) * 0.35 : 1)));
    this.boss.health = Math.max(0, this.boss.health - dmg);
    this.score += Math.floor(dmg * 1.4);
    this.stats.good++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.boss.hitFlash = 1;
    if (this.boss.health <= 0) {
      this.bossRoundCleared = true;
      this.bossClearUntilMs = nowMs + BOSS_ROUND_CLEAR_MS;
      this.score += 250 + this.bossRound * 120;
      this.stats.excellent++;
      this.screenShake = 18;
      audioEngine.playParrySound('excellent');
      for (let i = 0; i < 36; i++) {
        const angle = (Math.PI * 2 * i) / 36;
        const speed = 160 + Math.random() * 220;
        this.particles.push({
          x: this.boss.x,
          y: this.boss.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: this.boss.color,
          size: 4 + Math.random() * 5,
        });
      }
    }
  }

  advanceBossRound() {
    if (this.bossRound >= BOSS_MAX_ROUNDS) return;
    this.initBossRound(this.bossRound + 1);
    this.dodgeHealth = Math.min(this.dodgeMaxHealth, this.dodgeHealth + 12);
    this.screenShake = 10;
  }

  spawnBossGameplay() {
    if (!this.boss || this.bossRoundCleared) return;
    const now = performance.now();
    if (now >= this.bossClearUntilMs && this.bossRoundCleared) {
      this.advanceBossRound();
      return;
    }
    this.firePlayerWeapon(now);
    if (!this.isBossStunned(now)) {
      this.spawnBossAttacks(now);
    }
  }

  getBossAimTarget() {
    let best = null;
    let bestDist = Infinity;

    if (this.boss && !this.bossRoundCleared) {
      const dist = Math.hypot(this.boss.x - this.playerX, this.boss.y - this.playerY);
      best = { x: this.boss.x, y: this.boss.y, dist, boss: true };
      bestDist = dist;
    }

    for (const minion of this.bossMinions) {
      const dist = Math.hypot(minion.x - this.playerX, minion.y - this.playerY);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: minion.x, y: minion.y, dist, minion };
      }
    }

    return best;
  }

  spawnBossMinions(minionType, count, round = this.bossRound) {
    if (!this.boss || count <= 0) return;
    const stats = getBossMinionStats(minionType, round);

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const dist = this.boss.radius + 36 + Math.random() * 28;
      this.bossMinions.push({
        id: `${performance.now()}-${i}-${Math.random()}`,
        type: minionType,
        name: stats.name,
        x: this.boss.x + Math.cos(angle) * dist,
        y: this.boss.y + Math.sin(angle) * dist,
        health: stats.health,
        maxHealth: stats.health,
        size: stats.size,
        speed: stats.speed,
        touchDamage: stats.touchDamage,
        color: stats.color,
        glow: stats.glow,
        chase: !!stats.chase,
        shooter: !!stats.shooter,
        fireRate: stats.fireRate || 0,
        projectileSpeed: stats.projectileSpeed || 0,
        nextShotMs: performance.now() + 600 + i * 120,
        wobblePhase: Math.random() * Math.PI * 2,
        spawnFlash: 1,
      });
    }

    this.screenShake = Math.max(this.screenShake, 6);
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 140;
      this.particles.push({
        x: this.boss.x,
        y: this.boss.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: stats.color,
        size: 3 + Math.random() * 3,
      });
    }

    if (this.onScoreUpdate) {
      this.onScoreUpdate({
        score: this.score,
        combo: this.combo,
        rating: null,
        side: null,
        lane: null,
        health: this.dodgeHealth,
        maxHealth: this.dodgeMaxHealth,
        bossHealth: this.boss.health,
        bossMaxHealth: this.boss.maxHealth,
        bossRound: this.bossRound,
        bossSkill: this.boss.signature,
        minionCount: this.bossMinions.length,
      });
    }
  }

  damageMinion(minion, amount) {
    minion.health = Math.max(0, minion.health - amount);
    minion.hitFlash = 1;
    this.score += Math.floor(amount * 0.9);
    this.stats.good++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);

    if (minion.health <= 0) {
      this.killMinion(minion);
    }
  }

  killMinion(minion) {
    this.bossMinions = this.bossMinions.filter((entry) => entry.id !== minion.id);
    this.score += 35 + this.bossRound * 8;
    this.stats.excellent++;
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 110;
      this.particles.push({
        x: minion.x,
        y: minion.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        color: minion.color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  minionContainsPoint(minion, x, y, padding = 0) {
    const half = minion.size * 0.5 + padding;
    return Math.abs(x - minion.x) <= half && Math.abs(y - minion.y) <= half;
  }

  firePlayerWeapon(nowMs) {
    if (!this.boss || this.bossRoundCleared) return;
    const weapon = this.bossWeapon || getBossWeapon(DEFAULT_SKIN_ID);
    const intervalMs = weapon.fireRate * 1000;
    if (nowMs < this.playerNextFireMs) return;

    const target = this.getBossAimTarget();
    if (!target) return;

    const baseAngle = Math.atan2(target.y - this.playerY, target.x - this.playerX);

    for (let b = 0; b < weapon.burst; b++) {
      const spread = (b - (weapon.burst - 1) / 2) * weapon.spread;
      const angle = baseAngle + spread + (Math.random() - 0.5) * weapon.spread * 0.35;
      this.bossProjectiles.push({
        x: this.playerX,
        y: this.playerY,
        vx: Math.cos(angle) * weapon.projectileSpeed,
        vy: Math.sin(angle) * weapon.projectileSpeed,
        damage: weapon.damage,
        size: weapon.projectileSize,
        color: weapon.color,
        glow: weapon.glow,
        cosmic: !!weapon.cosmic,
        pierce: !!weapon.pierce,
        life: 1.2,
      });
    }

    this.playerNextFireMs = nowMs + intervalMs;
    if (weapon.cosmic && Math.random() < 0.35) {
      audioEngine.playParrySound('good');
    }
  }

  spawnBossAttacks(nowMs) {
    if (!this.boss || this.bossRoundCleared) return;
    const round = this.bossRound;
    const kit = this.bossRoundKit || getBossRoundKit(round);
    const interval = getBossAttackInterval(round) * 1000;
    const warningMs = 520 * (this.hasAbility('long-warning') ? 1.35 : 1);
    const speed = getBossProjectileSpeed(round);

    while (this.bossNextAttackMs <= nowMs + warningMs + 80) {
      const attackDef = pickBossAttack(kit, this.bossAttackIndex++);
      this.queueBossAttack(attackDef, this.bossNextAttackMs, warningMs, speed, round);
      this.bossNextAttackMs += interval;
    }
  }

  queueBossAttack(attackDef, startMs, warningMs, speed, round) {
    const type = attackDef.type || attackDef;
    const boss = this.boss;
    const px = this.playerX;
    const py = this.playerY;

    if (type === 'summon') {
      this.bossAttacks.push({
        type: 'summon',
        minionType: attackDef.minionType || 'drone',
        count: attackDef.count || 2,
        x: boss.x,
        y: boss.y,
        warningStartMs: startMs,
        warningDurationMs: warningMs + 180,
        fireTimeMs: startMs + warningMs + 180,
        state: 'warning',
        hit: false,
      });
      return;
    }

    const makeAttack = (angle, radius = 7, delay = 0, attackType = type) => ({
      x: boss.x,
      y: boss.y,
      angle,
      speed,
      radius,
      warningStartMs: startMs + delay,
      warningDurationMs: warningMs,
      fireTimeMs: startMs + delay + warningMs,
      state: 'warning',
      hit: false,
      traveled: 0,
      type: attackType,
    });

    if (type === 'aimed') {
      const angle = Math.atan2(py - boss.y, px - boss.x);
      this.bossAttacks.push(makeAttack(angle, 7 + round * 0.2));
      this.totalNotes++;
      return;
    }

    if (type === 'spread') {
      const base = Math.atan2(py - boss.y, px - boss.x);
      const count = 3 + Math.min(4, Math.floor(round / 2));
      const spread = 0.22 + round * 0.015;
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * spread;
        this.bossAttacks.push(makeAttack(base + offset, 6 + round * 0.15, i * 40));
        this.totalNotes++;
      }
      return;
    }

    if (type === 'ring') {
      const count = 8 + Math.min(10, round * 2);
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        this.bossAttacks.push(makeAttack(angle, 6, i * 25));
        this.totalNotes++;
      }
      return;
    }

    if (type === 'sweep') {
      const base = Math.atan2(py - boss.y, px - boss.x);
      for (let i = 0; i < 5; i++) {
        this.bossAttacks.push(makeAttack(base + (i - 2) * 0.35, 8, i * 70));
        this.totalNotes++;
      }
      return;
    }

    if (type === 'barrage') {
      for (let i = 0; i < 4; i++) {
        const angle = Math.atan2(py - boss.y, px - boss.x) + (Math.random() - 0.5) * 0.5;
        this.bossAttacks.push(makeAttack(angle, 7, i * 90));
        this.totalNotes++;
      }
      return;
    }

    if (type === 'crossfire') {
      const base = Math.atan2(py - boss.y, px - boss.x);
      const arms = 4;
      for (let i = 0; i < arms; i++) {
        const angle = base + (i - 1.5) * 0.55;
        this.bossAttacks.push(makeAttack(angle, 7 + round * 0.1, i * 55, 'crossfire'));
        this.totalNotes++;
      }
      return;
    }

    if (type === 'spiral') {
      const count = 10 + Math.min(6, Math.floor(round / 2));
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + round * 0.2;
        this.bossAttacks.push(makeAttack(angle, 6 + round * 0.08, i * 45, 'spiral'));
        this.totalNotes++;
      }
    }
  }

  updateBossGameplay(dt, nowMs) {
    if (!this.boss) return;

    if (this.boss.hitFlash > 0) this.boss.hitFlash = Math.max(0, this.boss.hitFlash - dt * 4);
    if (this.boss.stunPulse > 0) this.boss.stunPulse = Math.max(0, this.boss.stunPulse - dt * 2.5);
    this.boss.wobblePhase += dt * (this.isBossStunned(nowMs) ? 0.4 : 1.6);
    this.boss.x = this.centerX + Math.sin(this.boss.wobblePhase) * (28 + this.bossRound * 2);
    this.boss.y = this.canvas.height * 0.28 + Math.cos(this.boss.wobblePhase * 0.7) * 12;

    if (this.bossRoundCleared) {
      if (nowMs >= this.bossClearUntilMs) {
        this.advanceBossRound();
      }
      this.updateBossProjectiles(dt);
      return;
    }

    this.updateBossProjectiles(dt);

    const hitR = this.ballRadius + 6;
    const invincible = nowMs < this.dodgeInvincibleUntilMs || this.isVoidDashing();

    for (const attack of this.bossAttacks) {
      if (attack.hit) continue;

      if (attack.type === 'summon') {
        if (attack.state === 'warning' && nowMs >= attack.fireTimeMs) {
          this.spawnBossMinions(attack.minionType, attack.count, this.bossRound);
          attack.state = 'done';
        }
        continue;
      }

      if (attack.state === 'warning' && nowMs >= attack.fireTimeMs) {
        attack.state = 'firing';
      }

      if (attack.state === 'firing') {
        const prevX = attack.x;
        const prevY = attack.y;
        const move = attack.speed * dt;
        attack.x += Math.cos(attack.angle) * move;
        attack.y += Math.sin(attack.angle) * move;
        attack.traveled = (attack.traveled || 0) + move;

        const offScreen =
          attack.x < -80 || attack.x > this.canvas.width + 80 ||
          attack.y < -80 || attack.y > this.canvas.height + 80 ||
          (attack.traveled || 0) > 2200;

        if (offScreen) {
          attack.state = 'done';
          this.stats.excellent++;
          continue;
        }

        if (!invincible && segmentHitsCircle(prevX, prevY, attack.x, attack.y, this.playerX, this.playerY, hitR)) {
          attack.hit = true;
          attack.state = 'done';
          this.registerBossPlayerHit();
        }
      }
    }

    this.bossAttacks = this.bossAttacks.filter((a) => a.state !== 'done');
    this.updateBossMinions(dt, nowMs, invincible, hitR);
  }

  updateBossMinions(dt, nowMs, invincible, hitR) {
    if (!this.boss) return;

    for (const minion of this.bossMinions) {
      if (minion.spawnFlash > 0) minion.spawnFlash = Math.max(0, minion.spawnFlash - dt * 3);
      if (minion.hitFlash > 0) minion.hitFlash = Math.max(0, minion.hitFlash - dt * 4);
      minion.wobblePhase += dt * 3.2;

      if (minion.chase) {
        const dx = this.playerX - minion.x;
        const dy = this.playerY - minion.y;
        const dist = Math.hypot(dx, dy) || 1;
        minion.x += (dx / dist) * minion.speed * dt;
        minion.y += (dy / dist) * minion.speed * dt;
      } else if (this.boss) {
        const orbitR = this.boss.radius + 54 + minion.size;
        minion.x = this.boss.x + Math.cos(minion.wobblePhase) * orbitR;
        minion.y = this.boss.y + Math.sin(minion.wobblePhase) * orbitR;
      }

      if (!invincible) {
        const touchR = minion.size * 0.5 + hitR * 0.55;
        if (Math.hypot(minion.x - this.playerX, minion.y - this.playerY) <= touchR) {
          this.dodgeHealth = Math.max(0, this.dodgeHealth - minion.touchDamage);
          this.stats.miss++;
          this.combo = 0;
          this.screenShake = 10;
          audioEngine.playParrySound('miss');
          this.killMinion(minion);
          if (this.dodgeHealth <= 0) {
            this.handleBossDefeat();
            return;
          }
          if (this.onScoreUpdate) {
            this.onScoreUpdate({
              score: this.score,
              combo: this.combo,
              rating: 'miss',
              side: null,
              lane: null,
              health: this.dodgeHealth,
              maxHealth: this.dodgeMaxHealth,
              bossHealth: this.boss.health,
              bossMaxHealth: this.boss.maxHealth,
              bossRound: this.bossRound,
              bossSkill: this.boss.signature,
              minionCount: this.bossMinions.length,
            });
          }
        }
      }

      if (minion.shooter && nowMs >= minion.nextShotMs) {
        const angle = Math.atan2(this.playerY - minion.y, this.playerX - minion.x);
        this.bossAttacks.push({
          x: minion.x,
          y: minion.y,
          angle,
          speed: minion.projectileSpeed,
          radius: 6,
          warningStartMs: nowMs,
          warningDurationMs: 220,
          fireTimeMs: nowMs + 220,
          state: 'warning',
          hit: false,
          traveled: 0,
          type: 'minion-shot',
        });
        minion.nextShotMs = nowMs + minion.fireRate * 1000;
      }
    }
  }

  updateBossProjectiles(dt) {
    if (!this.boss) return;
    const boss = this.boss;

    for (const shot of this.bossProjectiles) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.life -= dt;

      let hit = false;
      for (const minion of this.bossMinions) {
        if (this.minionContainsPoint(minion, shot.x, shot.y, shot.size)) {
          this.damageMinion(minion, shot.damage);
          hit = true;
          if (!shot.pierce) break;
        }
      }

      if (!hit && !this.bossRoundCleared && this.bossContainsPoint(shot.x, shot.y, shot.size)) {
        this.damageBoss(shot.damage, performance.now());
        hit = true;
        for (let i = 0; i < (shot.cosmic ? 6 : 3); i++) {
          const angle = Math.random() * Math.PI * 2;
          this.particles.push({
            x: boss.x,
            y: boss.y,
            vx: Math.cos(angle) * (80 + Math.random() * 120),
            vy: Math.sin(angle) * (80 + Math.random() * 120),
            life: 1,
            color: shot.color,
            size: 2 + Math.random() * 3,
          });
        }
      }

      if (hit && !shot.pierce) shot.life = 0;
    }

    this.bossProjectiles = this.bossProjectiles.filter((s) =>
      s.life > 0 &&
      s.x > -40 && s.x < this.canvas.width + 40 &&
      s.y > -40 && s.y < this.canvas.height + 40
    );
  }

  registerBossPlayerHit() {
    if (this.hasAbility('ghost-phase') && !this.abilityState.ghostPhaseUsed) {
      this.abilityState.ghostPhaseUsed = true;
      this.consumeActiveAbility('ghost-phase');
      this.dodgeInvincibleUntilMs = performance.now() + 500;
      return;
    }

    this.dodgeHealth = Math.max(0, this.dodgeHealth - BOSS_HIT_DAMAGE);
    this.stats.miss++;
    this.combo = 0;
    this.screenShake = 12;
    audioEngine.playParrySound('miss');
    this.spawnDodgeHitParticles();

    if (this.onScoreUpdate) {
      this.onScoreUpdate({
        score: this.score,
        combo: this.combo,
        rating: 'miss',
        side: null,
        lane: null,
        health: this.dodgeHealth,
        maxHealth: this.dodgeMaxHealth,
        bossHealth: this.boss?.health,
        bossMaxHealth: this.boss?.maxHealth,
        bossRound: this.bossRound,
      });
    }

    if (this.dodgeHealth <= 0) {
      this.handleBossDefeat();
    }
  }

  renderBossScene() {
    const ctx = this.ctx;
    const shakeX = (Math.random() - 0.5) * this.screenShake;
    const shakeY = (Math.random() - 0.5) * this.screenShake;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.clearRect(-50, -50, this.canvas.width + 100, this.canvas.height + 100);

    this.drawBossBackground(ctx);
    this.drawBossAttackWarnings(ctx);
    this.drawBossAttacks(ctx);
    this.drawBossMinions(ctx);
    this.drawBossProjectiles(ctx);
    this.drawBossEntity(ctx);
    this.drawBossPlayer(ctx);
    this.drawBossHudBars(ctx);
    this.drawParticles(ctx);
    this.drawOverdriveWave(ctx);
    this.drawVoidDashEffect(ctx);
    this.drawBossHints(ctx);

    ctx.restore();
  }

  drawBossBackground(ctx) {
    const gradient = ctx.createRadialGradient(
      this.centerX, this.canvas.height * 0.28, 0,
      this.centerX, this.canvas.height * 0.28, this.canvas.height * 0.55
    );
    const c = this.boss?.color || '#c77dff';
    gradient.addColorStop(0, this.hexToRgba(c, 0.18));
    gradient.addColorStop(0.45, this.hexToRgba('#7b2cbf', 0.08));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 60; i++) {
      const sx = (i * 173) % this.canvas.width;
      const sy = (i * 97) % this.canvas.height;
      ctx.globalAlpha = 0.15 + (i % 5) * 0.08;
      ctx.beginPath();
      ctx.arc(sx, sy, (i % 3) * 0.6 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  getBossHalfSize(boss = this.boss) {
    if (!boss) return 0;
    return boss.radius * (boss.roundCleared ? 1.2 : 1);
  }

  bossContainsPoint(x, y, padding = 0) {
    if (!this.boss) return false;
    const half = this.getBossHalfSize() + padding;
    return Math.abs(x - this.boss.x) <= half && Math.abs(y - this.boss.y) <= half;
  }

  drawBossSquare(ctx, x, y, half, options = {}) {
    const {
      rotation = 0,
      fill,
      stroke,
      lineWidth = 3,
      shadowColor,
      shadowBlur = 0,
      dashed = false,
    } = options;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    if (shadowBlur > 0) {
      ctx.shadowColor = shadowColor || stroke || fill || '#ffffff';
      ctx.shadowBlur = shadowBlur;
    }
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(-half, -half, half * 2, half * 2);
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      if (dashed) ctx.setLineDash([8, 8]);
      ctx.strokeRect(-half, -half, half * 2, half * 2);
      if (dashed) ctx.setLineDash([]);
    }
    ctx.restore();
  }

  drawBossEntity(ctx) {
    if (!this.boss) return;
    const boss = this.boss;
    const stunned = this.isBossStunned();
    const half = this.getBossHalfSize(boss);
    const rotation = boss.wobblePhase * 0.35;

    if (this.isCosmicSkin() && this.bossWeapon?.cosmic) {
      this.drawCosmicBoss(ctx, boss, half, stunned, rotation);
      return;
    }

    ctx.save();
    const pulse = 1 + Math.sin(boss.wobblePhase * 2) * 0.04;
    const glowHalf = half * 1.8 * pulse;
    ctx.globalAlpha = stunned ? 0.35 : 0.55;
    this.drawBossSquare(ctx, boss.x, boss.y, glowHalf, {
      rotation,
      fill: this.hexToRgba(boss.color, 0.2),
      stroke: this.hexToRgba(boss.color, 0.08),
      lineWidth: 1,
    });
    ctx.globalAlpha = 1;

    this.drawBossSquare(ctx, boss.x, boss.y, half, {
      rotation,
      fill: stunned ? 'rgba(120,120,160,0.85)' : this.hexToRgba(boss.color, 0.9),
      stroke: stunned ? 'rgba(200,200,255,0.8)' : 'rgba(255,255,255,0.65)',
      lineWidth: 3,
    });

    if (boss.hitFlash > 0) {
      ctx.globalAlpha = boss.hitFlash * 0.5;
      this.drawBossSquare(ctx, boss.x, boss.y, half * 1.08, {
        rotation,
        fill: '#ffffff',
      });
      ctx.globalAlpha = 1;
    }

    if (stunned) {
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 120) * 0.3;
      this.drawBossSquare(ctx, boss.x, boss.y, half + 16, {
        rotation: -rotation * 0.6,
        stroke: '#b8f0ff',
        lineWidth: 2,
        dashed: true,
      });
      ctx.globalAlpha = 1;
    }

    ctx.font = '700 14px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(boss.name, boss.x, boss.y - half - 18);
    ctx.font = '600 11px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(200,200,230,0.8)';
    ctx.fillText(`Round ${boss.round} · ${boss.signature || 'Boss'}`, boss.x, boss.y - half - 4);
    ctx.restore();
  }

  drawCosmicBoss(ctx, boss, half, stunned, rotation) {
    ctx.save();
    const pulse = 1 + Math.sin(boss.wobblePhase * 2) * 0.05;

    ctx.globalAlpha = 0.55;
    this.drawBossSquare(ctx, boss.x, boss.y, half * 2.2 * pulse, {
      rotation: rotation * 0.5,
      fill: 'rgba(224,64,251,0.12)',
      stroke: 'rgba(64,196,255,0.2)',
      lineWidth: 1,
      shadowColor: '#40c4ff',
      shadowBlur: 24,
    });
    ctx.globalAlpha = 1;

    for (let i = 0; i < 3; i++) {
      const ringHalf = half * (1.08 + i * 0.18);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(224,64,251,0.55)' : 'rgba(64,196,255,0.45)';
      ctx.lineWidth = 2;
      ctx.save();
      ctx.translate(boss.x, boss.y);
      ctx.rotate(rotation + i * 0.25);
      ctx.strokeRect(-ringHalf, -ringHalf, ringHalf * 2, ringHalf * 2);
      ctx.restore();
    }

    this.drawBossSquare(ctx, boss.x, boss.y, half, {
      rotation,
      fill: stunned ? 'rgba(90,70,140,0.9)' : 'rgba(16,0,43,0.95)',
      stroke: stunned ? '#b8f0ff' : '#e040fb',
      lineWidth: 3,
      shadowColor: '#40c4ff',
      shadowBlur: 18,
    });

    if (boss.hitFlash > 0) {
      this.drawSparkStar(ctx, boss.x, boss.y, half * 0.45 * boss.hitFlash, boss.hitFlash, boss.wobblePhase);
    }

    if (stunned) {
      ctx.globalAlpha = 0.7;
      ctx.font = '700 12px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#b8f0ff';
      ctx.fillText('STUNNED', boss.x, boss.y + 5);
      ctx.globalAlpha = 1;
    }

    ctx.font = '700 14px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8c4ff';
    ctx.fillText(boss.name, boss.x, boss.y - half - 18);
    ctx.font = '600 11px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(184,240,255,0.85)';
    ctx.fillText(`Round ${boss.round} · ${boss.signature || 'Boss'}`, boss.x, boss.y - half - 4);
    ctx.restore();
  }

  drawBossPlayer(ctx) {
    const r = this.ballRadius;
    const weapon = this.bossWeapon || getBossWeapon(DEFAULT_SKIN_ID);
    const invincible = performance.now() < this.dodgeInvincibleUntilMs || this.isVoidDashing();

    this.updateSkinTrail(this.playerX, this.playerY);
    this.drawSkinTrail(ctx);

    if (invincible) ctx.globalAlpha = 0.55 + Math.sin(performance.now() / 80) * 0.25;

    if (this.isCosmicSkin()) {
      this.drawCosmicPlayer(ctx, this.playerX, this.playerY, r);
    } else {
      const ballColor = this.getPlayerBallColor();
      ctx.beginPath();
      ctx.arc(this.playerX, this.playerY, r + 10, 0, Math.PI * 2);
      const glow = ctx.createRadialGradient(this.playerX, this.playerY, r * 0.2, this.playerX, this.playerY, r + 10);
      glow.addColorStop(0, this.ballColorToRgba(this.getPlayerGlowColor(), 0.65));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.playerX, this.playerY, r, 0, Math.PI * 2);
      ctx.fillStyle = ballColor;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (this.boss && !this.bossRoundCleared) {
      const target = this.getBossAimTarget();
      if (target) {
        const angle = Math.atan2(target.y - this.playerY, target.x - this.playerX);
        const gunLen = weapon.cosmic ? 22 : 16;
        const gx = this.playerX + Math.cos(angle) * (r + 4);
        const gy = this.playerY + Math.sin(angle) * (r + 4);
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(angle);
        ctx.fillStyle = weapon.cosmic ? '#e040fb' : weapon.color;
        ctx.strokeStyle = weapon.cosmic ? '#b8f0ff' : '#ffffff';
        ctx.lineWidth = 2;
        if (weapon.cosmic) {
          ctx.shadowColor = '#40c4ff';
          ctx.shadowBlur = 12;
        }
        ctx.fillRect(0, -3, gunLen, 6);
        ctx.strokeRect(0, -3, gunLen, 6);
        if (weapon.cosmic) {
          this.drawSparkStar(ctx, gunLen + 2, 0, 4, 0.8, performance.now() / 300);
        }
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = weapon.glow || weapon.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.moveTo(this.playerX, this.playerY);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    ctx.globalAlpha = 1;
  }

  drawBossProjectiles(ctx) {
    for (const shot of this.bossProjectiles) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, shot.life);
      if (shot.cosmic) {
        this.drawSparkStar(ctx, shot.x, shot.y, shot.size * 1.2, 0.9, performance.now() / 200);
      } else {
        ctx.beginPath();
        ctx.arc(shot.x, shot.y, shot.size, 0, Math.PI * 2);
        ctx.fillStyle = shot.color;
        ctx.shadowColor = shot.glow || shot.color;
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawBossAttackWarnings(ctx) {
    const now = performance.now();
    for (const attack of this.bossAttacks) {
      if (attack.state !== 'warning' || attack.hit) continue;

      if (attack.type === 'summon') {
        const t = Math.min(1, (now - attack.warningStartMs) / attack.warningDurationMs);
        const alpha = 0.2 + t * 0.55;
        const pulse = 1 + t * 0.35;
        const half = (this.getBossHalfSize() + 24) * pulse;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#e040fb';
        ctx.lineWidth = 2 + t * 2;
        ctx.setLineDash([6, 8]);
        ctx.strokeRect(attack.x - half, attack.y - half, half * 2, half * 2);
        ctx.setLineDash([]);
        ctx.font = '600 10px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(232,196,255,0.9)';
        ctx.fillText(`SUMMON x${attack.count}`, attack.x, attack.y - half - 8);
        ctx.restore();
        continue;
      }

      const t = Math.min(1, (now - attack.warningStartMs) / attack.warningDurationMs);
      const alpha = 0.25 + t * 0.55;
      const len = 1800;
      const x2 = attack.x + Math.cos(attack.angle) * len;
      const y2 = attack.y + Math.sin(attack.angle) * len;
      const color = attack.type === 'spiral'
        ? `rgba(180, 120, 255, ${alpha})`
        : attack.type === 'crossfire'
          ? `rgba(255, 120, 90, ${alpha})`
          : `rgba(255, 90, 120, ${alpha})`;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 + t * 2;
      ctx.setLineDash([10, 12]);
      ctx.beginPath();
      ctx.moveTo(attack.x, attack.y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  drawBossMinions(ctx) {
    for (const minion of this.bossMinions) {
      const half = minion.size * 0.5;
      const rotation = minion.wobblePhase * 0.8;

      if (minion.spawnFlash > 0) {
        ctx.save();
        ctx.globalAlpha = minion.spawnFlash * 0.4;
        this.drawBossSquare(ctx, minion.x, minion.y, half * 2.2, {
          rotation,
          stroke: minion.glow,
          lineWidth: 2,
        });
        ctx.restore();
      }

      this.drawBossSquare(ctx, minion.x, minion.y, half, {
        rotation,
        fill: minion.hitFlash > 0 ? '#ffffff' : this.hexToRgba(minion.color, 0.92),
        stroke: minion.glow,
        lineWidth: 2,
        shadowColor: minion.glow,
        shadowBlur: 8,
      });

      const hpPct = minion.maxHealth > 0 ? minion.health / minion.maxHealth : 0;
      const barW = minion.size + 8;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(minion.x - barW / 2, minion.y - half - 8, barW, 3);
      ctx.fillStyle = minion.color;
      ctx.fillRect(minion.x - barW / 2, minion.y - half - 8, barW * hpPct, 3);
    }
  }

  drawBossAttacks(ctx) {
    for (const attack of this.bossAttacks) {
      if (attack.state !== 'firing' || attack.hit) continue;
      ctx.beginPath();
      ctx.arc(attack.x, attack.y, attack.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 80, 110, 0.9)';
      ctx.shadowColor = 'rgba(255, 80, 110, 0.8)';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  drawBossHudBars(ctx) {
    if (!this.boss) return;
    const barW = Math.min(360, this.canvas.width * 0.42);
    const x = this.centerX - barW / 2;
    const y = 28;
    const hpPct = this.boss.maxHealth > 0 ? this.boss.health / this.boss.maxHealth : 0;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - 4, y - 4, barW + 8, 18);
    const grad = ctx.createLinearGradient(x, y, x + barW, y);
    grad.addColorStop(0, '#e040fb');
    grad.addColorStop(1, '#40c4ff');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, barW * Math.max(0, hpPct), 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barW, 10);

    ctx.font = '600 11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(230,230,255,0.9)';
    const weapon = this.bossWeapon || getBossWeapon(DEFAULT_SKIN_ID);
    const minionText = this.bossMinions.length ? ` · ${this.bossMinions.length} enemies` : '';
    ctx.fillText(`${weapon.name} · Round ${this.bossRound} · ${this.boss.signature || 'Boss'}${minionText}`, this.centerX, y + 24);
  }

  drawBossHints(ctx) {
    ctx.font = '600 11px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(136, 136, 170, 0.7)';
    ctx.textAlign = 'left';
    const hints = [];
    if (this.hasAbility('op-overdrive')) hints.push('SPACE Stun');
    if (this.hasAbility('op-void-dash')) hints.push('V Dodge');
    const abilityHint = hints.length ? ` · ${hints.join(' · ')}` : '';
    const weapon = this.bossWeapon?.name || 'Gun';
    ctx.fillText(
      `Boss Fight · ${weapon} auto-aim · Move cursor · ESC quit · R restart${abilityHint}`,
      16,
      this.canvas.height - 16
    );
  }

  drawDodgeHints(ctx) {
    ctx.font = '600 11px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(136, 136, 170, 0.7)';
    ctx.textAlign = 'left';
    const hints = [];
    if (this.hasAbility('op-overdrive')) hints.push('SPACE Overdrive');
    if (this.hasAbility('op-void-dash')) hints.push('V Void Dash');
    const abilityHint = hints.length ? ` · ${hints.join(' · ')}` : '';
    ctx.fillText(
      `Build v6 · Level ${this.trainingLevel} · Move cursor to dodge · ESC quit · R restart${abilityHint}`,
      16,
      this.canvas.height - 16
    );
  }
}
