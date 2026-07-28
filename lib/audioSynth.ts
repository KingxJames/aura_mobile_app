import { Audio } from "expo-av";

// The app has no bundled instrument samples and React Native has no Web Audio
// API (so no Tone.js), so every sound the Aural Training modules play - the
// metronome click, and every note in a melody - is synthesized from scratch
// as a tiny WAV file and handed to expo-av to play. Nothing here touches the
// network or the filesystem; WAV bytes are built in memory and played via a
// `data:` URI.

const SAMPLE_RATE = 22050; // Plenty for short synthesized tones/clicks, keeps files small.

// The 12 chromatic pitch names, matching AuralExerciseGeneratorService on the backend.
const CHROMATIC_NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/** Standard equal-temperament formula: A4 = 440Hz, 12 semitones per octave. */
export function noteToFrequency(noteName: string, octave: number): number {
  const noteIndex = CHROMATIC_NOTES.indexOf(noteName);
  const semitonesFromA4 = (octave - 4) * 12 + (noteIndex - CHROMATIC_NOTES.indexOf("A"));
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

/**
 * Builds a mono 16-bit PCM WAV file (as a base64 string) containing a single
 * sine tone, with a short linear fade in/out so the tone doesn't pop at the
 * start/end. `velocity` is a 0-127 MIDI-style loudness value (matches the
 * dynamic_hint.velocity the backend sends for Musical Features).
 */
export function synthesizeToneWavBase64(
  frequencyHz: number,
  durationMs: number,
  velocity: number = 100,
): string {
  const sampleCount = Math.max(1, Math.round((SAMPLE_RATE * durationMs) / 1000));
  const amplitude = (velocity / 127) * 0.85; // Leave headroom so it never clips.
  const fadeSamples = Math.min(sampleCount / 2, Math.round(SAMPLE_RATE * 0.008)); // ~8ms fade

  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const t = i / SAMPLE_RATE;
    let envelope = 1;
    if (i < fadeSamples) envelope = i / fadeSamples;
    else if (i > sampleCount - fadeSamples) envelope = (sampleCount - i) / fadeSamples;

    const value = Math.sin(2 * Math.PI * frequencyHz * t) * amplitude * envelope;
    samples[i] = Math.max(-32767, Math.min(32767, Math.round(value * 32767)));
  }

  return pcmToWavBase64(samples);
}

/**
 * A short, fast-decaying burst (not a pure tone) used as the Pulse & Metre
 * metronome click - percussive rather than musical, so it doesn't get
 * confused with the melodic modules' note playback.
 *
 * `accent` marks beat 1 of each bar: lower-pitched and louder than the other
 * beats. Without this distinction every beat sounds identical, so 2-time and
 * 3-time patterns are indistinguishable by ear - the accent is what actually
 * lets the listener feel where each bar starts.
 */
export function synthesizeClickWavBase64(accent: boolean = false): string {
  const durationMs = accent ? 80 : 60;
  const frequencyHz = accent ? 1100 : 1800;
  const amplitude = accent ? 1 : 0.7;
  const sampleCount = Math.round((SAMPLE_RATE * durationMs) / 1000);

  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const t = i / SAMPLE_RATE;
    // Exponential decay envelope gives the "tick" its percussive shape.
    const envelope = Math.exp(-i / (sampleCount / 4));
    const value = Math.sin(2 * Math.PI * frequencyHz * t) * amplitude * envelope;
    samples[i] = Math.max(-32767, Math.min(32767, Math.round(value * 32767)));
  }

  return pcmToWavBase64(samples);
}

/** Wraps raw 16-bit PCM samples in a standard 44-byte WAV/RIFF header. */
function pcmToWavBase64(samples: Int16Array): string {
  const headerSize = 44;
  const dataSize = samples.length * 2; // 2 bytes per 16-bit sample
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate (mono, 16-bit)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(headerSize + i * 2, samples[i], true);
  }

  return arrayBufferToBase64(buffer);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chars = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) chars[i] = String.fromCharCode(bytes[i]);
  return btoa(chars.join(""));
}

/** Loads and plays a base64-encoded WAV via a `data:` URI - no filesystem writes needed. */
export async function playWavBase64(base64: string): Promise<Audio.Sound> {
  const { sound } = await Audio.Sound.createAsync({
    uri: `data:audio/wav;base64,${base64}`,
  });
  await sound.playAsync();
  return sound;
}

/**
 * Plays a real, pre-recorded audio clip from a remote URL (Pulse & Metre's
 * listen_mcq phase - the one exercise that isn't synthesized in-app, see
 * PulseMetreClip on the backend) and resolves once playback finishes.
 * Unlike the synthesized sounds above, a real clip's duration isn't known
 * up front, so completion is detected via the playback status callback
 * rather than a hand-timed setTimeout.
 */
export async function playRemoteClip(url: string): Promise<void> {
  const { sound } = await Audio.Sound.createAsync({ uri: url });

  await new Promise<void>((resolve) => {
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        resolve();
      }
    });
    sound.playAsync();
  });

  await sound.unloadAsync();
}

export type NoteEvent = {
  note_name: string;
  octave: number;
  degree: number;
  duration_beats: number;
};

// Diatonic letter -> semitone offset within an octave, used to resolve the
// AI tutor's letter-name pitch strings (which may use flats, unlike
// CHROMATIC_NOTES) down to one of the 12 chromatic names above.
const NATURAL_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/**
 * Parses a tutor pitch tag like "C4", "Bb3", or "F#5" into the note_name/
 * octave shape playNoteSequence expects, normalizing flats/sharps (and the
 * rare octave-crossing case like "Cb4" or "B#3") down to CHROMATIC_NOTES'
 * sharp-only spelling.
 */
function parseTutorPitch(pitch: string): { note_name: string; octave: number } | null {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(pitch.trim());
  if (!match) return null;
  const [, letter, accidental, octaveStr] = match;

  let semitone = NATURAL_SEMITONES[letter.toUpperCase()];
  if (accidental === "#") semitone += 1;
  if (accidental === "b") semitone -= 1;

  let octave = parseInt(octaveStr, 10);
  if (semitone < 0) {
    semitone += 12;
    octave -= 1;
  } else if (semitone > 11) {
    semitone -= 12;
    octave += 1;
  }

  return { note_name: CHROMATIC_NOTES[semitone], octave };
}

/**
 * Plays a single pitch tagged by the AI tutor (a [[note:...,pitch:C4,play:true]]
 * tag) - the tutor-chat equivalent of playNoteSequence for a lone note, since
 * the tutor only ever tags one note at a time rather than a full melody.
 */
export async function playTutorPitch(pitch: string, durationBeats: number): Promise<void> {
  const parsed = parseTutorPitch(pitch);
  if (!parsed) return;
  await playNoteSequence([{ ...parsed, degree: 0, duration_beats: durationBeats }]);
}

// Letter order for stepping to the next/previous natural letter, and which
// letters a key signature sharps/flats - same circle-of-fifths order the
// note tags themselves already use for ",key:N" (sharps: F C G D A E B,
// flats: B E A D G C F), kept as its own small copy here rather than
// importing from staffGeometry.tsx, matching how this file already keeps
// its own NATURAL_SEMITONES table independent of the UI layer.
const LETTER_ORDER = ["C", "D", "E", "F", "G", "A", "B"];
const SHARP_LETTERS = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_LETTERS = ["B", "E", "A", "D", "G", "C", "F"];

function keySignatureAccidental(letter: string, keySignature: number): "#" | "b" | "" {
  if (keySignature > 0) return SHARP_LETTERS.slice(0, Math.min(keySignature, 7)).includes(letter) ? "#" : "";
  if (keySignature < 0) return FLAT_LETTERS.slice(0, Math.min(-keySignature, 7)).includes(letter) ? "b" : "";
  return "";
}

/**
 * The pitch `steps` diatonic letter-steps from `pitch` (1 = next letter up,
 * -1 = next letter down), spelled with the given key signature's accidental
 * for that letter - e.g. in D major (key:2) the step above C4 is "C#4", not
 * "C4", because C is sharped in that key. This is what an ornament's actual
 * upper/lower neighbor tone is; picking a fixed semitone/whole-tone distance
 * instead would be wrong in most keys.
 */
function diatonicNeighborPitch(pitch: string, steps: 1 | -1, keySignature: number): string | null {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(pitch.trim());
  if (!match) return null;
  const letter = match[1].toUpperCase();
  const octave = parseInt(match[3], 10);

  const totalIndex = LETTER_ORDER.indexOf(letter) + steps;
  const nextLetter = LETTER_ORDER[((totalIndex % 7) + 7) % 7];
  const octaveShift = Math.floor(totalIndex / 7);

  return `${nextLetter}${keySignatureAccidental(nextLetter, keySignature)}${octave + octaveShift}`;
}

/**
 * Plays a [[note:...,ornament:X]] tag's ornament as the alternation pattern
 * it actually represents, instead of one plain sustained tone - a trill
 * drawn on the staff but heard as a single note is musically wrong, not just
 * a simplification. Falls back to a plain tone for fermata (a hold has no
 * alternation to perform) or when no ornament is set.
 */
export async function playTutorOrnamentedNote(
  pitch: string,
  durationBeats: number,
  ornament: "fermata" | "trill" | "turn" | "mordent" | undefined,
  keySignature: number,
): Promise<void> {
  if (ornament === "trill") {
    const upper = diatonicNeighborPitch(pitch, 1, keySignature);
    if (!upper) return playTutorPitch(pitch, durationBeats);
    const ALTERNATIONS = 8; // a "rapid" trill speed, independent of the note's own written duration
    const each = durationBeats / (ALTERNATIONS * 2);
    for (let i = 0; i < ALTERNATIONS; i++) {
      await playTutorPitch(pitch, each);
      await playTutorPitch(upper, each);
    }
    return;
  }

  if (ornament === "turn") {
    const upper = diatonicNeighborPitch(pitch, 1, keySignature);
    const lower = diatonicNeighborPitch(pitch, -1, keySignature);
    if (!upper || !lower) return playTutorPitch(pitch, durationBeats);
    const each = durationBeats / 4;
    await playTutorPitch(upper, each);
    await playTutorPitch(pitch, each);
    await playTutorPitch(lower, each);
    await playTutorPitch(pitch, each);
    return;
  }

  if (ornament === "mordent") {
    const lower = diatonicNeighborPitch(pitch, -1, keySignature);
    if (!lower) return playTutorPitch(pitch, durationBeats);
    const quick = Math.min(durationBeats / 4, 0.25);
    await playTutorPitch(pitch, quick);
    await playTutorPitch(lower, quick);
    await playTutorPitch(pitch, Math.max(durationBeats - quick * 2, quick));
    return;
  }

  await playTutorPitch(pitch, durationBeats);
}

/**
 * Plays a [[interval:...]] tag's two pitches - together for a harmonic
 * interval (each is its own independent Sound, so starting both without
 * awaiting between them is enough to make them sound simultaneously), or
 * one after another for a melodic interval.
 */
export async function playTutorInterval(
  pitch1: string,
  pitch2: string,
  intervalType: "harmonic" | "melodic",
  durationBeats: number,
): Promise<void> {
  if (intervalType === "harmonic") {
    await Promise.all([
      playTutorPitch(pitch1, durationBeats),
      playTutorPitch(pitch2, durationBeats),
    ]);
  } else {
    await playTutorPitch(pitch1, durationBeats);
    await playTutorPitch(pitch2, durationBeats);
  }
}

/**
 * Plays a [[chord:...]] tag's 3 pitches together - each is its own Sound
 * started without awaiting the others, same trick as the harmonic branch of
 * playTutorInterval above, so all 3 ring out simultaneously.
 */
export async function playTutorChord(pitches: string[], durationBeats: number): Promise<void> {
  await Promise.all(pitches.map((pitch) => playTutorPitch(pitch, durationBeats)));
}

/**
 * Plays a [[cadence:...]] tag's 2 chords one after another - each chord
 * itself plays as simultaneous notes via playTutorChord, and this just waits
 * out the first chord's full duration (which playTutorChord already blocks
 * on) before starting the second, so the progression's resolution is audible
 * rather than both chords firing at once.
 */
export async function playTutorCadence(chords: string[][], durationBeats: number): Promise<void> {
  for (const chord of chords) {
    await playTutorChord(chord, durationBeats);
  }
}

/**
 * Plays a [[sequence:...]] tag's notes/rests in order - the multi-note
 * equivalent of playTutorPitch above. `pitch: null` marks a rest: it just
 * waits out its duration in silence rather than synthesizing a tone.
 * Deliberately takes plain pitch strings + beat counts rather than a
 * component-defined note-type enum, so this file stays independent of any
 * UI type (same reasoning as playTutorPitch's `durationBeats: number` param).
 */
export async function playTutorSequence(
  tokens: { pitch: string | null; durationBeats: number }[],
): Promise<void> {
  for (const token of tokens) {
    if (token.pitch === null) {
      const msPerBeat = 60000 / 100; // matches playNoteSequence's default tempo
      await new Promise((resolve) => setTimeout(resolve, token.durationBeats * msPerBeat));
    } else {
      await playTutorPitch(token.pitch, token.durationBeats);
    }
  }
}

/**
 * Schedules metronome clicks at each given millisecond offset (relative to
 * "now"), preloading two click sounds (accent + regular) and replaying the
 * right one on every beat rather than creating a new Sound instance per
 * tick. `beatsPerBar` marks which beats are downbeats (index 0, beatsPerBar,
 * 2*beatsPerBar, ...) so the accent click actually outlines the metre -
 * without it 2-time and 3-time patterns are audibly identical.
 *
 * `audibleIndices`, when given, restricts which beat indices actually sound -
 * used by Pulse & Metre's muted_bar_tap/boss phases, where bar 2's timestamps
 * still need to elapse (so the tap window stays open the full length) but
 * must stay silent, forcing the user to keep time from memory. Omit it to
 * sound every beat (the listen_mcq/downbeat_tap phases).
 *
 * Returns a handle to cancel any pending clicks (e.g. if the user navigates
 * away mid-playback).
 */
export function scheduleClickTrack(
  beatTimestampsMs: number[],
  beatsPerBar: number = 1,
  onBeat?: (index: number) => void,
  audibleIndices?: number[],
): { stop: () => void } {
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  let accentSound: Audio.Sound | null = null;
  let regularSound: Audio.Sound | null = null;
  let cancelled = false;

  const audibleSet = audibleIndices ? new Set(audibleIndices) : null;

  const accentBase64 = synthesizeClickWavBase64(true);
  const regularBase64 = synthesizeClickWavBase64(false);

  Promise.all([
    Audio.Sound.createAsync({ uri: `data:audio/wav;base64,${accentBase64}` }),
    Audio.Sound.createAsync({ uri: `data:audio/wav;base64,${regularBase64}` }),
  ]).then(([accent, regular]) => {
    if (cancelled) {
      accent.sound.unloadAsync();
      regular.sound.unloadAsync();
      return;
    }
    accentSound = accent.sound;
    regularSound = regular.sound;

    beatTimestampsMs.forEach((offsetMs, index) => {
      const isDownbeat = index % beatsPerBar === 0;
      const isAudible = audibleSet ? audibleSet.has(index) : true;
      const timeoutId = setTimeout(() => {
        if (isAudible) {
          (isDownbeat ? accentSound : regularSound)?.replayAsync();
        }
        onBeat?.(index);
      }, offsetMs);
      timeouts.push(timeoutId);
    });
  });

  return {
    stop: () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
      accentSound?.unloadAsync();
      regularSound?.unloadAsync();
    },
  };
}

/**
 * Plays a melodic note sequence in order. Each note gets its own
 * synthesized Sound (pitches differ note-to-note, unlike the click track),
 * played sequentially and awaited so the melody isn't garbled by overlap.
 * `articulationHint`/`dynamicHint` (from Musical Features exercises) tweak
 * how connected/loud the notes sound; omit them for a neutral playback.
 */
export async function playNoteSequence(
  notes: NoteEvent[],
  options: {
    tempoBpm?: number;
    dynamicHint?: { velocity: number };
    articulationHint?: { duration_multiplier: number };
  } = {},
): Promise<void> {
  const tempoBpm = options.tempoBpm ?? 100;
  const msPerBeat = 60000 / tempoBpm;
  const velocity = options.dynamicHint?.velocity ?? 100;
  const durationMultiplier = options.articulationHint?.duration_multiplier ?? 0.85;

  for (const note of notes) {
    const fullDurationMs = note.duration_beats * msPerBeat;
    const soundedDurationMs = fullDurationMs * durationMultiplier;
    const frequencyHz = noteToFrequency(note.note_name, note.octave);

    const base64 = synthesizeToneWavBase64(frequencyHz, soundedDurationMs, velocity);
    const { sound } = await Audio.Sound.createAsync({
      uri: `data:audio/wav;base64,${base64}`,
    });
    await sound.playAsync();

    // Wait out the note's full written duration (not just the sounded part)
    // so rests between staccato notes are audible, then release the sound.
    await new Promise((resolve) => setTimeout(resolve, fullDurationMs));
    sound.unloadAsync();
  }
}
