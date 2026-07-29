// One-off generator for the reference-pitch WAV tones used by the Free
// Practice screen (app/aural-practice.tsx). Run with: node scripts/generate-tones.js
// Not part of the app bundle itself - just produces the files under assets/tones/.
//
// Synthesizes a piano-like tone (fundamental + decaying harmonics, percussive
// pluck-and-decay envelope) rather than a flat sine wave. A pure sine tone is
// notoriously hard to pitch-match by voice - it lacks the harmonic richness
// the ear/voice naturally locks onto, which is why real ear-training tools
// use piano tones instead.
const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const DURATION_SECONDS = 1.8;
const PEAK_AMPLITUDE = 13000; // headroom below 16-bit max (32767), avoids clipping

// Standard equal-temperament frequencies (A4 = 440Hz reference) - matching
// exactly what the backend's DSP (librosa.note_to_hz) expects for these notes.
// One full chromatic octave, all 12 pitch classes. The specific octave here
// is arbitrary now that the backend matches pitch class octave-invariantly -
// singing any octave of C, C#, etc. is scored as correct.
const NOTES = {
  C4: 261.63,
  "C#4": 277.18,
  D4: 293.66,
  "D#4": 311.13,
  E4: 329.63,
  F4: 349.23,
  "F#4": 369.99,
  G4: 392.0,
  "G#4": 415.3,
  A4: 440.0,
  "A#4": 466.16,
  B4: 493.88,
};

// Fundamental + decreasing-amplitude harmonics, roughly approximating a
// piano's overtone spectrum (a real piano is far more complex than this, but
// even a few harmonics reads as "keyboard-ish" instead of "lab tone generator").
const HARMONICS = [
  { multiple: 1, amplitude: 1.0 },
  { multiple: 2, amplitude: 0.55 },
  { multiple: 3, amplitude: 0.3 },
  { multiple: 4, amplitude: 0.15 },
  { multiple: 5, amplitude: 0.08 },
];
const HARMONIC_TOTAL = HARMONICS.reduce((sum, h) => sum + h.amplitude, 0);

const ATTACK_SECONDS = 0.006; // fast percussive attack, like a struck key
const DECAY_RATE = 2.2; // higher = faster exponential decay toward silence

function pluckEnvelope(t) {
  if (t < ATTACK_SECONDS) {
    return t / ATTACK_SECONDS;
  }
  return Math.exp(-DECAY_RATE * (t - ATTACK_SECONDS));
}

function writePianoWav(filePath, freq) {
  const numSamples = Math.floor(SAMPLE_RATE * DURATION_SECONDS);
  const data = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = pluckEnvelope(t);

    let harmonicSum = 0;
    for (const h of HARMONICS) {
      harmonicSum +=
        h.amplitude * Math.sin(2 * Math.PI * freq * h.multiple * t);
    }
    const normalized = harmonicSum / HARMONIC_TOTAL;

    const sample = Math.round(PEAK_AMPLITUDE * envelope * normalized);
    data.writeInt16LE(sample, i * 2);
  }

  const dataSize = data.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  fs.writeFileSync(filePath, Buffer.concat([header, data]));
}

const outDir = path.join(__dirname, "..", "assets", "tones");
fs.mkdirSync(outDir, { recursive: true });

// "#" is unsafe in an asset filename (Metro serves web assets via URLs, where
// "#" is a fragment separator and would truncate the path) - use "s" for
// sharp in the filename, keep proper "C#4" notation only as the object key
// (which is what's sent to the backend as target_note).
for (const [note, freq] of Object.entries(NOTES)) {
  const safeFileName = note.replace("#", "s");
  const filePath = path.join(outDir, `${safeFileName}.wav`);
  writePianoWav(filePath, freq);
  console.log(`Wrote ${filePath} (${freq} Hz, note=${note})`);
}

// --- Sequence tones (for Transcription's target-pattern playback) ---
// Shorter + faster decay than the Free Practice tones above, so notes played
// back-to-back in a melodic pattern don't smear into each other. Covers
// octaves 3-4 since AuralExerciseGeneratorService's stepwise-melody random
// walk (degree -4 to +4 from the tonic) can dip into the octave below.
const SEQUENCE_DURATION_SECONDS = 0.9;
const SEQUENCE_DECAY_RATE = 3.5;

function writeSequenceWav(filePath, freq) {
  const numSamples = Math.floor(SAMPLE_RATE * SEQUENCE_DURATION_SECONDS);
  const data = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let envelope;
    if (t < ATTACK_SECONDS) {
      envelope = t / ATTACK_SECONDS;
    } else {
      envelope = Math.exp(-SEQUENCE_DECAY_RATE * (t - ATTACK_SECONDS));
    }

    let harmonicSum = 0;
    for (const h of HARMONICS) {
      harmonicSum +=
        h.amplitude * Math.sin(2 * Math.PI * freq * h.multiple * t);
    }
    const normalized = harmonicSum / HARMONIC_TOTAL;

    const sample = Math.round(PEAK_AMPLITUDE * envelope * normalized);
    data.writeInt16LE(sample, i * 2);
  }

  const dataSize = data.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  fs.writeFileSync(filePath, Buffer.concat([header, data]));
}

const sequenceOutDir = path.join(__dirname, "..", "assets", "tones", "sequence");
fs.mkdirSync(sequenceOutDir, { recursive: true });

const SEQUENCE_NOTES = {};
for (const [note, freq] of Object.entries(NOTES)) {
  const pitchClass = note.replace(/\d+$/, "");
  SEQUENCE_NOTES[`${pitchClass}3`] = freq / 2;
  SEQUENCE_NOTES[`${pitchClass}4`] = freq;
  // Covers an edge case in the backend's stepwise-melody random walk where a
  // high scale degree combined with a key like G can land in octave 5.
  SEQUENCE_NOTES[`${pitchClass}5`] = freq * 2;
}

for (const [note, freq] of Object.entries(SEQUENCE_NOTES)) {
  const safeFileName = note.replace("#", "s");
  const filePath = path.join(sequenceOutDir, `${safeFileName}.wav`);
  writeSequenceWav(filePath, freq);
  console.log(`Wrote ${filePath} (${freq} Hz, note=${note})`);
}
