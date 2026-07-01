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
    this.animationId = null;

    this.onComplete = null;
    this.onScoreUpdate = null;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
    this.lineLength = Math.min(this.canvas.width * 0.85, 900);
  }

  start(song) {
    this.song = song;
    this.beatMap = generateBeatMap(song);
    this.totalNotes = this.beatMap.length;
    this.noteIndex = 0;
    this.notes = [];
    this.particles = [];
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.stats = { excellent: 0, good: 0, medium: 0, bad: 0, miss: 0 };
    this.state = 'playing';
    this.lastTime = performance.now();

    audioEngine.playSong(song);
    this.loop();
  }

  stop() {
    this.state = 'idle';
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    audioEngine.stop();
  }

  getProgress() {
    if (!this.song) return 0;
    const t = audioEngine.getCurrentTime();
    return Math.min(t / this.song.duration, 1);
  }

  spawnNotes(currentTime) {
    const progress = this.getProgress();
    const speed = getSpeedForProgress(this.song, progress);
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

  updateNotes(dt, currentTime) {
    const progress = this.getProgress();
    const speed = getSpeedForProgress(this.song, progress);

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

  handleKeyDown(e) {
    if (this.state !== 'playing') return;
    const key = e.key.toLowerCase();
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

    let rating;
    if (bestDist <= TIMING_WINDOWS.excellent) rating = RATING.EXCELLENT;
    else if (bestDist <= TIMING_WINDOWS.good) rating = RATING.GOOD;
    else if (bestDist <= TIMING_WINDOWS.medium) rating = RATING.MEDIUM;
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
      this.combo = 0;
      if (note) note.missTime = performance.now();
      this.score = Math.max(0, this.score + RATING_SCORE.miss);
      audioEngine.playParrySound('miss');
      this.screenShake = 6;
    } else if (rating === RATING.BAD) {
      this.combo = 0;
      this.score = Math.max(0, this.score + RATING_SCORE.bad);
      audioEngine.playParrySound(rating);
      this.screenShake = 5;
      this.spawnParticles(side, lane, rating);
    } else {
      const comboBonus = Math.min(this.combo * 2, 50);
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
    const shades = {
      excellent: '#ffffff',
      good: '#cccccc',
      medium: '#888888',
      bad: '#444444',
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
        color: shades[rating],
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
    if (currentTime >= this.song.duration + 1) {
      this.state = 'complete';
      this.stop();

      const weighted =
        this.stats.excellent * 100 +
        this.stats.good * 75 +
        this.stats.medium * 50 +
        this.stats.bad * -25 +
        this.stats.miss * -50;
      const accuracy = this.totalNotes > 0
        ? Math.max(0, Math.min(100, Math.round(weighted / this.totalNotes)))
        : 0;

      if (this.onComplete) {
        this.onComplete({
          score: this.score,
          accuracy,
          grade: getGrade(accuracy),
          stats: { ...this.stats },
          maxCombo: this.maxCombo,
        });
      }
    }
  }

  loop() {
    if (this.state !== 'playing') return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    const currentTime = audioEngine.getCurrentTime();
    this.spawnNotes(currentTime);
    this.updateNotes(dt, currentTime);
    this.updateParticles(dt);
    this.updateKeyFlash(dt);

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 20);
    }

    this.draw();
    this.checkComplete(currentTime);

    this.animationId = requestAnimationFrame(() => this.loop());
  }

  draw() {
    const ctx = this.ctx;
    const shakeX = (Math.random() - 0.5) * this.screenShake;
    const shakeY = (Math.random() - 0.5) * this.screenShake;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.clearRect(-50, -50, this.canvas.width + 100, this.canvas.height + 100);

    this.drawBackground(ctx);
    this.drawLine(ctx);
    this.drawLaneGuides(ctx);
    this.drawPlayerBall(ctx);
    this.drawNotes(ctx);
    this.drawParticles(ctx);
    this.drawKeyIndicators(ctx);

    ctx.restore();
  }

  drawBackground(ctx) {
    const progress = this.getProgress();
    const intensity = 0.04 + progress * 0.06;
    const gradient = ctx.createRadialGradient(
      this.centerX, this.centerY, 0,
      this.centerX, this.centerY, this.lineLength * 0.6
    );
    gradient.addColorStop(0, `rgba(255,255,255,${intensity})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
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

    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, r + 8, 0, Math.PI * 2);
    const glow = ctx.createRadialGradient(
      this.centerX, this.centerY, r * 0.5,
      this.centerX, this.centerY, r + 8
    );
    glow.addColorStop(0, 'rgba(255,255,255,0.25)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(this.centerX, this.centerY, r, 0, Math.PI * 2);
    const ballGrad = ctx.createRadialGradient(
      this.centerX - 4, this.centerY - 4, 0,
      this.centerX, this.centerY, r
    );
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(0.5, '#aaaaaa');
    ballGrad.addColorStop(1, '#333333');
    ctx.fillStyle = ballGrad;
    ctx.fill();
  }

  drawNotes(ctx) {
    for (const note of this.notes) {
      const y = this.getLaneY(note.lane);
      const dist = Math.abs(note.x - this.centerX);
      const alpha = note.hit ? 0.3 : note.missed ? 0.2 : 1;

      if (note.hit) {
        const scale = 1 + (1 - (performance.now() - note.hitTime) / 300) * 0.5;
        this.drawBall(ctx, note.x, y, this.ballRadius * scale, alpha, note.rating);
      } else {
        this.drawBall(ctx, note.x, y, this.ballRadius, alpha, null);

        if (!note.missed && dist < this.hitZone + 20) {
          const glow = 1 - dist / (this.hitZone + 20);
          ctx.beginPath();
          ctx.arc(note.x, y, this.ballRadius + 6 * glow, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${glow * 0.15})`;
          ctx.fill();
        }
      }
    }
  }

  drawBall(ctx, x, y, r, alpha, rating) {
    ctx.save();
    ctx.globalAlpha = alpha;

    const shade = rating === 'excellent' ? '#ffffff'
      : rating === 'good' ? '#cccccc'
      : rating === 'medium' ? '#888888'
      : rating === 'bad' ? '#555555'
      : '#aaaaaa';

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(x - 3, y - 3, 0, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, shade);
    grad.addColorStop(1, '#222222');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
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
}
