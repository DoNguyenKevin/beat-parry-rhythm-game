class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.isPlaying = false;
    this.scheduledNodes = [];
    this.startTime = 0;
    this.song = null;
    this.onBeat = null;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.5;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.8;
    this.sfxGain.connect(this.masterGain);
  }

  resume() {
    this.init();
    if (this.ctx.state === 'suspended') {
      return this.ctx.resume();
    }
    return Promise.resolve();
  }

  stop() {
    this.isPlaying = false;
    this.scheduledNodes.forEach((n) => {
      try { n.stop(); } catch (_) { /* already stopped */ }
    });
    this.scheduledNodes = [];
  }

  playSong(song, startOffset = 0) {
    this.stop();
    this.song = song;
    this.isPlaying = true;
    this.startTime = this.ctx.currentTime - startOffset;

    const beatInterval = 60 / song.bpm;
    const totalBeats = Math.ceil(song.duration / beatInterval);

    for (let beat = 0; beat < totalBeats; beat++) {
      const time = this.startTime + beat * beatInterval;
      if (beat * beatInterval < startOffset) continue;

      this.scheduleKick(time, song.bassFreq);
      if (beat % 2 === 0) this.scheduleSnare(time + beatInterval * 0.5, song);
      if (beat % 4 === 2) this.scheduleHiHat(time + beatInterval * 0.25);

      const noteIdx = Math.floor(beat / 2) % song.melodyScale.length;
      const melodyTime = time + beatInterval * 0.1;
      this.scheduleMelody(melodyTime, song, noteIdx);
    }
  }

  getCurrentTime() {
    if (!this.ctx || !this.isPlaying) return 0;
    return this.ctx.currentTime - this.startTime;
  }

  scheduleKick(time, freq) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, time + 0.1);
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.3);
    this.scheduledNodes.push(osc);
  }

  scheduleSnare(time, song) {
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    source.start(time);
    source.stop(time + 0.1);
    this.scheduledNodes.push(source);
  }

  scheduleHiHat(time) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 8000;
    gain.gain.setValueAtTime(0.05, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.05);
    this.scheduledNodes.push(osc);
  }

  scheduleMelody(time, song, noteIdx) {
    const rootFreq = 220;
    const semitone = song.melodyScale[noteIdx];
    const freq = rootFreq * Math.pow(2, semitone / 12);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(time);
    osc.stop(time + 0.2);
    this.scheduledNodes.push(osc);
  }

  playParrySound(rating) {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const freqs = {
      excellent: 880,
      good: 660,
      medium: 440,
      bad: 220,
      miss: 110,
    };

    osc.type = rating === 'excellent' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freqs[rating] || 440, time);
    if (rating === 'excellent') {
      osc.frequency.exponentialRampToValueAtTime(1320, time + 0.1);
    }

    const volumes = { excellent: 0.4, good: 0.3, medium: 0.2, bad: 0.15, miss: 0.1 };
    gain.gain.setValueAtTime(volumes[rating] || 0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(time);
    osc.stop(time + 0.15);
  }
}

const audioEngine = new AudioEngine();
