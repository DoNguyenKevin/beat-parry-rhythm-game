const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const BASE_DIR = path.join(__dirname, '..', 'sounds', 'keycap');
const RATINGS = ['excellent', 'good', 'medium', 'bad', 'miss'];

function writeWav(filePath, samples) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

function env(t, attack, decay) {
  if (t < attack) return t / attack;
  return Math.exp(-(t - attack) / decay);
}

function tone(freq, t, type = 'sine') {
  const phase = 2 * Math.PI * freq * t;
  if (type === 'sine') return Math.sin(phase);
  if (type === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(phase));
  if (type === 'square') return Math.sin(phase) >= 0 ? 1 : -1;
  return Math.sin(phase);
}

function noise() {
  return Math.random() * 2 - 1;
}

function render(duration, fn) {
  const count = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const t = i / SAMPLE_RATE;
    samples[i] = fn(t);
  }
  return samples;
}

function lowpass(sample, prev, coeff) {
  return prev + coeff * (sample - prev);
}

function applyLowpass(samples, coeff) {
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    prev = lowpass(samples[i], prev, coeff);
    samples[i] = prev;
  }
  return samples;
}

const PROFILE_TRAITS = {
  creamy: {
    label: 'creamy',
    pitch: 0.72,
    soft: 0.55,
    click: 0.08,
    thock: 1.1,
    lp: 0.12,
  },
  blue: {
    label: 'blue',
    pitch: 1.05,
    soft: 0.25,
    click: 0.95,
    thock: 0.55,
    lp: 0.35,
  },
  red: {
    label: 'red',
    pitch: 0.88,
    soft: 0.4,
    click: 0.2,
    thock: 0.95,
    lp: 0.22,
  },
};

function makeHit(rating, traits) {
  const pitchScale = traits.pitch;
  const ratingPitch = {
    excellent: 1.15,
    good: 1,
    medium: 0.85,
    bad: 0.7,
    miss: 0.55,
  }[rating];

  return (t) => {
    const e = env(t, 0.001, rating === 'miss' ? 0.12 : 0.07);
    const p = pitchScale * ratingPitch;

    const click = noise() * Math.exp(-t * 90) * traits.click;
    const thock = tone(180 * p, t, 'sine') * Math.exp(-t * 14) * traits.thock;
    const body = tone(420 * p, t, 'triangle') * Math.exp(-t * 22) * traits.soft;
    const ring = tone(880 * p, t, 'sine') * Math.exp(-t * 28) * traits.soft * 0.35;

    if (rating === 'blue' || traits.label === 'blue') {
      const bump = tone(640 * p, t, 'square') * Math.exp(-t * 45) * 0.18 * traits.click;
      return (click + thock + body + ring + bump) * e * 0.8;
    }

    if (rating === 'miss') {
      const drop = tone(120 * p, t, 'sine') * Math.exp(-t * 8);
      return (drop + click * 0.4) * e * 0.55;
    }

    return (click + thock + body + ring) * e * 0.78;
  };
}

for (const [profileId, traits] of Object.entries(PROFILE_TRAITS)) {
  const outDir = path.join(BASE_DIR, profileId);
  fs.mkdirSync(outDir, { recursive: true });

  for (const rating of RATINGS) {
    const duration = rating === 'miss' ? 0.2 : 0.14;
    const samples = render(duration, makeHit(rating, traits));
    applyLowpass(samples, traits.lp);
    const outPath = path.join(outDir, `${rating}.wav`);
    writeWav(outPath, samples);
    console.log(`Wrote ${outPath}`);
  }
}

console.log('Keycap parry sounds ready in sounds/keycap/ — replace WAVs with your own anytime.');
