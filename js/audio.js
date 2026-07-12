const PARRY_PROFILE_KEY = 'beatParrySoundProfile';

const PARRY_SOUND_PROFILES = {
  default: { id: 'default', label: 'Normal', description: 'Classic parry tones' },
  creamy: { id: 'creamy', label: 'Creamy Keycap', description: 'Soft, muted thock' },
  blue: { id: 'blue', label: 'Blue Switch Keycap', description: 'Clicky tactile bump' },
  red: { id: 'red', label: 'Red Switch Keycap', description: 'Smooth linear press' },
};

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
    this.parryProfile = 'default';
    this.parryBuffers = {};
    this.parryLoadPromise = null;
    this.loadStoredProfile();
  }

  loadStoredProfile() {
    const stored = localStorage.getItem(PARRY_PROFILE_KEY);
    if (stored && PARRY_SOUND_PROFILES[stored]) {
      this.parryProfile = stored;
    }
  }

  getParryProfile() {
    return this.parryProfile;
  }

  getParryProfileInfo() {
    return PARRY_SOUND_PROFILES[this.parryProfile] || PARRY_SOUND_PROFILES.default;
  }

  setParryProfile(profileId) {
    if (!PARRY_SOUND_PROFILES[profileId]) return;
    this.parryProfile = profileId;
    localStorage.setItem(PARRY_PROFILE_KEY, profileId);
    this.parryBuffers = {};
    this.parryLoadPromise = null;
    if (profileId !== 'default') {
      return this.loadParrySounds(profileId);
    }
    return Promise.resolve();
  }

  resetParryProfile() {
    return this.setParryProfile('default');
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

  loadParrySounds(profileId = this.parryProfile) {
    if (profileId === 'default') return Promise.resolve();
    if (this.parryLoadPromise && this.parryProfile === profileId) {
      return this.parryLoadPromise;
    }

    this.parryLoadPromise = (async () => {
      this.init();
      const ratings = ['excellent', 'good', 'medium', 'bad', 'miss'];
      const buffers = {};

      await Promise.all(
        ratings.map(async (rating) => {
          try {
            const res = await fetch(`sounds/keycap/${profileId}/${rating}.wav`);
            if (!res.ok) return;
            const arrayBuffer = await res.arrayBuffer();
            buffers[rating] = await this.ctx.decodeAudioData(arrayBuffer);
          } catch {
            /* profile file missing */
          }
        })
      );

      this.parryBuffers = buffers;
    })();

    return this.parryLoadPromise;
  }

  resume() {
    this.init();
    const resumeCtx = this.ctx.state === 'suspended'
      ? this.ctx.resume()
      : Promise.resolve();
    return resumeCtx.then(() => {
      if (this.parryProfile !== 'default') {
        return this.loadParrySounds(this.parryProfile);
      }
      return undefined;
    });
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

    if (this.parryProfile === 'default') {
      this.playParrySoundDefault(rating);
      return;
    }

    const buffer = this.parryBuffers[rating];
    if (buffer) {
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      const volumes = { excellent: 0.9, good: 0.85, medium: 0.75, bad: 0.7, miss: 0.65 };
      source.buffer = buffer;
      gain.gain.value = volumes[rating] || 0.75;
      source.connect(gain);
      gain.connect(this.sfxGain);
      source.start();
      return;
    }

    this.playParrySoundDefault(rating);
  }

  previewParrySound() {
    this.playParrySound('good');
  }

  playParrySoundDefault(rating) {
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
