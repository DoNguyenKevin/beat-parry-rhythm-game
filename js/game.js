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

    this.onComplete = null;
    this.onScoreUpdate = null;
    this.onTrainingExit = null;
    this.onTrainingRestart = null;

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
    this.trainingMode = false;
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
    this.noteIndex = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.stats = { excellent: 0, good: 0, medium: 0, bad: 0, miss: 0 };
    this.spawnBeatCounter = 0;
    this.nextSpawnTime = 0.8;
    this.dodgeNextSpawn = 0.8;
    this.dodgeInvincibleUntil = 0;
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
    if (this.state !== 'playing' || this.playMode !== 'dodge') return;
    this.updatePlayerFromClient(e.clientX, e.clientY);
  }

  start(song, options = {}) {
    audioEngine.stop();

    const isDodge = !!options.dodge;
    const isTraining = !!options.training && !isDodge;
    this.playMode = isDodge ? 'dodge' : 'parry';
    this.dodgeMode = isDodge;
    this.trainingMode = isTraining;
    this.endlessMode = isDodge || (isTraining && !!song.endless);
    this.song = song;
    this.speedMult = song.speedMult || 1;
    this.trainingLevel = isDodge ? (song.startLevel || 1) : (song.startLevel || 3);

    this.resetRoundState();

    if (this.endlessMode) {
      this.beatMap = [];
      this.totalNotes = 0;
    } else {
      this.beatMap = generateBeatMap(song);
      this.totalNotes = this.beatMap.length;
    }

    this.playerX = this.centerX;
    this.playerY = this.centerY;
    if (isDodge) {
      this.dodgeClockStart = performance.now();
      this.dodgeNextSpawnMs = this.dodgeClockStart + 800;
      if (this._lastPointer.x != null) {
        this.updatePlayerFromClient(this._lastPointer.x, this._lastPointer.y);
      }
    }

    this.state = 'playing';
    this.lastTime = performance.now();
    this.canvas.classList.toggle('dodge-cursor', isDodge);
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

  getDodgeElapsed() {
    return (performance.now() - this.dodgeClockStart) / 1000;
  }

  getProgress() {
    if (!this.song) return 0;
    if (this.endlessMode) {
      if (this.playMode === 'dodge') {
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
    if (this.playMode === 'dodge') return getDodgeLevel(this.getDodgeElapsed(), startLevel);
    return getTrainingLevel(audioEngine.getCurrentTime(), startLevel);
  }

  spawnNotes(currentTime) {
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
    const warningMs = getDodgeWarningDuration(level) * 1000;
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

  getNoteSpeed(progress) {
    if (this.endlessMode) {
      return getEndlessSpeed(this.song, this.trainingLevel || 1);
    }
    return getSpeedForProgress(this.song, progress) * this.speedMult;
  }

  getTrainingSummary() {
    const elapsed = this.playMode === 'dodge' ? this.getDodgeElapsed() : audioEngine.getCurrentTime();
    const hitCount = this.playMode === 'dodge'
      ? this.stats.excellent
      : this.stats.excellent + this.stats.good + this.stats.medium + this.stats.bad;
    const weighted = this.playMode === 'dodge'
      ? this.stats.excellent * 100
      : this.stats.excellent * 100 +
        this.stats.good * 75 +
        this.stats.medium * 50;
    const divisor = this.playMode === 'dodge'
      ? Math.max(1, this.stats.excellent + this.stats.miss)
      : Math.max(1, hitCount);
    const accuracy = Math.max(0, Math.min(100, Math.round(weighted / divisor)));

    return {
      score: this.score,
      accuracy,
      grade: null,
      stats: { ...this.stats },
      maxCombo: this.maxCombo,
      training: this.playMode === 'dodge' || this.trainingMode,
      dodge: this.playMode === 'dodge',
      trainingLevel: this.trainingLevel,
      timeSurvived: Math.floor(elapsed),
      notesHit: hitCount,
      songId: this.song?.id || null,
    };
  }

  updateNotes(dt, currentTime) {
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

  updateDodgeBullets(dt, nowMs) {
    const level = this.trainingLevel || 1;
    this.score += Math.floor(dt * (12 + level * 2));

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
          continue;
        }

        if (nowMs >= this.dodgeInvincibleUntilMs) {
          const hitR = bullet.radius + this.ballRadius;
          if (segmentHitsCircle(prevX, prevY, bullet.x, bullet.y, this.playerX, this.playerY, hitR)) {
            bullet.hit = true;
            bullet.hitTime = nowMs;
            bullet.state = 'done';
            this.registerDodgeHit();
            this.spawnDodgeHitParticles();
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
    this.stats.miss++;
    this.combo = 0;
    this.score = Math.max(0, this.score - 25);
    this.dodgeInvincibleUntilMs = performance.now() + 600;
    audioEngine.playParrySound('miss');
    this.screenShake = 8;

    if (this.onScoreUpdate) {
      this.onScoreUpdate({
        score: this.score,
        combo: this.combo,
        rating: RATING.MISS,
        side: null,
        lane: null,
      });
    }
  }

  handleKeyDown(e) {
    if (this.state !== 'playing') return;

    const key = e.key.toLowerCase();
    if (key === 'escape') {
      e.preventDefault();
      if ((this.trainingMode || this.playMode === 'dodge') && this.onTrainingExit) {
        this.onTrainingExit();
      }
      return;
    }
    if (key === 'r' && (this.trainingMode || this.playMode === 'dodge')) {
      e.preventDefault();
      if (this.onTrainingRestart) this.onTrainingRestart();
      return;
    }
    if (this.playMode === 'dodge') return;

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

    const windows = getTimingWindows(this.song);
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

  getLaneY(lane) {
    const layers = getSongLayers(this.song);
    if (layers === 1) return this.centerY;
    return this.centerY + (lane === 0 ? -this.laneOffset : this.laneOffset);
  }

  registerHit(rating, note, side, lane) {
    this.stats[rating]++;

    if (rating === RATING.MISS) {
      if (!this.trainingMode) this.combo = 0;
      if (note) note.missTime = performance.now();
      if (!this.trainingMode) {
        this.score = Math.max(0, this.score + RATING_SCORE.miss);
      }
      audioEngine.playParrySound('miss');
      this.screenShake = this.trainingMode ? 2 : 6;
    } else if (rating === RATING.BAD) {
      if (!this.trainingMode) {
        this.combo = 0;
        this.score = Math.max(0, this.score + RATING_SCORE.bad);
      }
      audioEngine.playParrySound(rating);
      this.screenShake = this.trainingMode ? 2 : 5;
      this.spawnParticles(side, lane, rating);
    } else {
      const comboBonus = this.trainingMode ? 0 : Math.min(this.combo * 2, 50);
      this.score += RATING_SCORE[rating] + comboBonus;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      audioEngine.playParrySound(rating);
      this.screenShake = rating === RATING.EXCELLENT ? 6 : rating === RATING.GOOD ? 4 : 2;
      this.spawnParticles(side, lane, rating);
    }

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
      this.state = 'complete';
      this.stop();

      const weighted =
        this.stats.excellent * 100 +
        this.stats.good * 75 +
        this.stats.medium * 50 +
        this.stats.bad * (this.trainingMode ? 0 : -25) +
        this.stats.miss * (this.trainingMode ? 0 : -50);
      const accuracy = this.totalNotes > 0
        ? Math.max(0, Math.min(100, Math.round(weighted / this.totalNotes)))
        : 0;

      if (this.onComplete) {
        this.onComplete({
          score: this.score,
          accuracy,
          grade: this.trainingMode ? null : getGrade(accuracy),
          stats: { ...this.stats },
          maxCombo: this.maxCombo,
          training: this.trainingMode,
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
    this.drawParticles(ctx);
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

  drawPlayerBall(ctx) {
    const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.05;
    const r = this.ballRadius * pulse;
    const ballColor = getBallColor(this.song);

    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, r + 12, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(
      this.centerX, this.centerY, r * 0.3,
      this.centerX, this.centerY, r + 12
    );
    glow.addColorStop(0, this.ballColorToRgba(ballColor, 0.7));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, r, 0, Math.PI * 2);
    ctx.fillStyle = ballColor;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
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

  drawDodgePlayer(ctx) {
    const invincible = performance.now() < this.dodgeInvincibleUntilMs;
    const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.06;
    const r = this.ballRadius * pulse;
    const color = this.song?.color || '#ff6b6b';

    if (invincible) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.02) * 0.3;
    }

    ctx.beginPath();
    ctx.arc(this.playerX, this.playerY, r + 14, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(
      this.playerX, this.playerY, r * 0.2,
      this.playerX, this.playerY, r + 14
    );
    glow.addColorStop(0, this.ballColorToRgba(color, 0.65));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.playerX, this.playerY, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    if (invincible) ctx.restore();
  }

  drawDodgeHints(ctx) {
    ctx.font = '600 11px Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(136, 136, 170, 0.7)';
    ctx.textAlign = 'left';
    ctx.fillText(
      `Build v5 · Level ${this.trainingLevel} · Move cursor to dodge · ESC quit · R restart`,
      16,
      this.canvas.height - 16
    );
  }
}
