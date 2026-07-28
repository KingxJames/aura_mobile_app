import type { ArticulationType, ClefType, DynamicType, NoteValueType, OrnamentType } from "@/components/tutor/NoteGlyph";
import type { IntervalType } from "@/components/tutor/IntervalGlyph";
import type { SequenceToken } from "@/components/tutor/NoteSequence";
import type { TimeSignatureValue } from "@/components/tutor/staffGeometry";

const CHORD_TONE_COUNT = 3;

const NOTE_ALIASES: Record<string, NoteValueType> = {
  whole: "whole",
  semibreve: "whole",
  half: "half",
  minim: "half",
  quarter: "quarter",
  crotchet: "quarter",
  eighth: "eighth",
  quaver: "eighth",
  sixteenth: "sixteenth",
  semiquaver: "sixteenth",
};

// Compact single-letter codes for [[sequence:...]] tokens (e.g. "C4-q") -
// deliberately terser than NOTE_ALIASES above, since a sequence can carry up
// to 8 of these in one tag and full words would bloat it.
const DURATION_CODE: Record<string, NoteValueType> = {
  w: "whole",
  h: "half",
  q: "quarter",
  e: "eighth",
  s: "sixteenth",
};

const ARTICULATION_VALUES: ArticulationType[] = ["staccato", "accent", "tenuto"];
const DYNAMIC_VALUES: DynamicType[] = ["pp", "p", "mp", "mf", "f", "ff"];
const ORNAMENT_VALUES: OrnamentType[] = ["fermata", "trill", "turn", "mordent"];

const MIN_SEQUENCE_TOKENS = 2;
const MAX_SEQUENCE_TOKENS = 8;

const MAX_KEY_SIGNATURE = 7;

// Shared by both the note and sequence tag parsers below.
function parseKeySignatureValue(val: string): number | null {
  if (!/^-?\d{1,2}$/.test(val)) return null;
  const n = parseInt(val, 10);
  if (n < -MAX_KEY_SIGNATURE || n > MAX_KEY_SIGNATURE) return null;
  return n;
}

function parseTimeSignatureValue(val: string): TimeSignatureValue | null {
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(val);
  if (!match) return null;
  return { numerator: match[1], denominator: match[2] };
}

// Matches [[note:quarter]] or [[note:quarter,pitch:C4]] or
// [[note:quarter,pitch:C4,clef:bass]] or [[note:quarter,pitch:C4,play:true]]
// or [[note:quarter,rest:true]] or [[note:quarter,pitch:C4,artic:staccato]]
// or [[note:quarter,pitch:C4,dynamic:mf]] or [[note:quarter,pitch:C4,ornament:fermata]]
// or [[note:quarter,pitch:C4,dotted:true]]
// or [[sequence:notes:C4-q D4-q E4-q F4-q,clef:treble,play:true]] (tokens may use a
// trailing "." duration code, e.g. "C4-q.", for a dotted note, and/or trailing
// ":artic"/":dynamic"/":tied"/":triplet" markers, e.g. "C4-q:accent:mf" or
// "C4-e:tied C4-e" (a tie) or "C4-e:triplet D4-e:triplet E4-e:triplet" (a
// triplet) - rests only ever take ":triplet", never artic/dynamic/tied)
// or [[interval:pitch1:C4,pitch2:G4,type:harmonic,clef:treble,play:true]]
// or [[chord:notes:C4 E4 G4,clef:treble,play:true]] (exactly 3 pitches - a triad)
// or [[cadence:chords:G4+B4+D5 C4+E4+G4,clef:treble,key:0,play:true]] (exactly 2
// chords, each 3 pitches joined by "+"; key identifies the tonic for classification)
const TAG_PATTERN = /\[\[(note|sequence|interval|chord|cadence):([^\]]+)\]\]/g;

export type TutorContentSegment =
  | { type: "text"; value: string }
  | {
      type: "note";
      value: NoteValueType;
      pitch?: string;
      clef?: ClefType;
      play?: boolean;
      rest?: boolean;
      dotted?: boolean;
      artic?: ArticulationType;
      dynamic?: DynamicType;
      ornament?: OrnamentType;
      keySignature?: number;
      timeSignature?: TimeSignatureValue;
    }
  | {
      type: "sequence";
      tokens: SequenceToken[];
      clef?: ClefType;
      play?: boolean;
      keySignature?: number;
      timeSignature?: TimeSignatureValue;
    }
  | {
      type: "interval";
      pitch1: string;
      pitch2: string;
      intervalType: IntervalType;
      clef?: ClefType;
      play?: boolean;
      keySignature?: number;
      timeSignature?: TimeSignatureValue;
    }
  | {
      type: "chord";
      pitches: string[];
      clef?: ClefType;
      play?: boolean;
      keySignature?: number;
      timeSignature?: TimeSignatureValue;
    }
  | {
      type: "cadence";
      chords: [string[], string[]];
      clef?: ClefType;
      play?: boolean;
      keySignature?: number;
      timeSignature?: TimeSignatureValue;
    };

function parseNoteTag(body: string): TutorContentSegment | null {
  const parts = body.split(",").map((part) => part.trim());
  const [rawType, ...rest] = parts;
  const noteType = NOTE_ALIASES[rawType.toLowerCase()];
  if (!noteType) return null;

  const segment: TutorContentSegment = { type: "note", value: noteType };
  for (const part of rest) {
    const [key, val] = part.split(":").map((s) => s.trim());
    if (key === "pitch" && val) segment.pitch = val;
    if (key === "clef" && (val === "treble" || val === "bass")) segment.clef = val;
    if (key === "play" && val === "true") segment.play = true;
    if (key === "rest" && val === "true") segment.rest = true;
    if (key === "dotted" && val === "true") segment.dotted = true;
    if (key === "artic" && ARTICULATION_VALUES.includes(val as ArticulationType)) {
      segment.artic = val as ArticulationType;
    }
    if (key === "dynamic" && DYNAMIC_VALUES.includes(val as DynamicType)) {
      segment.dynamic = val as DynamicType;
    }
    if (key === "ornament" && ORNAMENT_VALUES.includes(val as OrnamentType)) {
      segment.ornament = val as OrnamentType;
    }
    if (key === "key") {
      const parsed = parseKeySignatureValue(val);
      if (parsed !== null) segment.keySignature = parsed;
    }
    if (key === "time") {
      const parsed = parseTimeSignatureValue(val);
      if (parsed) segment.timeSignature = parsed;
    }
  }
  return segment;
}

// Splits a token like "C4-q" or "C-1-q" (negative octave) on its LAST dash,
// since the dash between a negative octave and the duration code would
// otherwise be ambiguous with a naive split.
function splitOnLastDash(token: string): [string, string] | null {
  const idx = token.lastIndexOf("-");
  if (idx <= 0) return null;
  return [token.slice(0, idx), token.slice(idx + 1)];
}

function parseSequenceTag(body: string): TutorContentSegment | null {
  const parts = body.split(",").map((part) => part.trim());

  let notesValue: string | null = null;
  let clef: ClefType | undefined;
  let play: boolean | undefined;
  let keySignature: number | undefined;
  let timeSignature: TimeSignatureValue | undefined;

  for (const part of parts) {
    const colonIndex = part.indexOf(":");
    if (colonIndex === -1) continue;
    const key = part.slice(0, colonIndex).trim();
    const val = part.slice(colonIndex + 1).trim();

    if (key === "notes") notesValue = val;
    if (key === "clef" && (val === "treble" || val === "bass")) clef = val;
    if (key === "play" && val === "true") play = true;
    if (key === "key") {
      const parsed = parseKeySignatureValue(val);
      if (parsed !== null) keySignature = parsed;
    }
    if (key === "time") {
      const parsed = parseTimeSignatureValue(val);
      if (parsed) timeSignature = parsed;
    }
  }

  if (!notesValue) return null;

  const rawTokens = notesValue.split(/\s+/).filter(Boolean);
  if (rawTokens.length < MIN_SEQUENCE_TOKENS || rawTokens.length > MAX_SEQUENCE_TOKENS) {
    return null;
  }

  const tokens: SequenceToken[] = [];
  for (const raw of rawTokens) {
    // Optional ":artic"/":dynamic"/":tied"/":triplet" markers trail the
    // pitch-duration part, e.g. "C4-q:accent:mf" - order-independent, each
    // classified by which value list (or literal keyword) it matches.
    // Colons are safe here since a token is already whitespace-delimited
    // from its neighbors before this runs.
    const [base, ...markers] = raw.split(":");

    const split = splitOnLastDash(base);
    if (!split) return null;
    const [pitchOrRest, rawCode] = split;
    // A trailing "." (e.g. "q.") marks a dotted duration - stripped before the
    // base-code lookup so DURATION_CODE itself only has to know the 5 base codes.
    const dotted = rawCode.endsWith(".");
    const code = dotted ? rawCode.slice(0, -1) : rawCode;
    const noteType = DURATION_CODE[code.toLowerCase()];
    if (!noteType) return null;

    const isRest = pitchOrRest.toLowerCase() === "r";

    let artic: ArticulationType | undefined;
    let dynamic: DynamicType | undefined;
    let tied = false;
    let triplet = false;
    for (const marker of markers) {
      if (marker === "tied") tied = true;
      else if (marker === "triplet") triplet = true;
      else if (ARTICULATION_VALUES.includes(marker as ArticulationType)) artic = marker as ArticulationType;
      else if (DYNAMIC_VALUES.includes(marker as DynamicType)) dynamic = marker as DynamicType;
      else return null;
    }
    // Rests have no pitch to sustain or articulate/accent - only "triplet"
    // (a rhythmic grouping, independent of pitch) makes sense on one.
    if (isRest && (artic || dynamic || tied)) return null;

    if (isRest) {
      tokens.push({ rest: true, type: noteType, dotted, triplet });
    } else {
      tokens.push({ rest: false, type: noteType, pitch: pitchOrRest, dotted, artic, dynamic, tied, triplet });
    }
  }

  if (!validateTies(tokens)) return null;
  if (!validateTriplets(tokens)) return null;

  return { type: "sequence", tokens, clef, play, keySignature, timeSignature };
}

/** Every `tied` token must be followed by a non-rest token of the exact same pitch - a tie only ever connects two soundings of one pitch. */
function validateTies(tokens: SequenceToken[]): boolean {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.rest || !token.tied) continue;
    const next = tokens[i + 1];
    if (!next || next.rest || next.pitch !== token.pitch) return false;
  }
  return true;
}

/** `triplet` tokens must form complete, contiguous runs of exactly 3 same-duration, non-dotted tokens - never a partial group or a mix of durations. */
function validateTriplets(tokens: SequenceToken[]): boolean {
  let i = 0;
  while (i < tokens.length) {
    if (!tokens[i].triplet) {
      i++;
      continue;
    }
    if (i + 2 >= tokens.length) return false;
    const [a, b, c] = [tokens[i], tokens[i + 1], tokens[i + 2]];
    if (!a.triplet || !b.triplet || !c.triplet) return false;
    if (a.type !== b.type || b.type !== c.type) return false;
    if (a.dotted || b.dotted || c.dotted) return false;
    i += 3;
  }
  return true;
}

const PITCH_FORMAT = /^[A-Ga-g][#b]?-?\d+$/;

function parseIntervalTag(body: string): TutorContentSegment | null {
  const parts = body.split(",").map((part) => part.trim());

  let pitch1: string | null = null;
  let pitch2: string | null = null;
  let intervalType: IntervalType | null = null;
  let clef: ClefType | undefined;
  let play: boolean | undefined;
  let keySignature: number | undefined;
  let timeSignature: TimeSignatureValue | undefined;

  for (const part of parts) {
    const colonIndex = part.indexOf(":");
    if (colonIndex === -1) continue;
    const key = part.slice(0, colonIndex).trim();
    const val = part.slice(colonIndex + 1).trim();

    if (key === "pitch1") pitch1 = val;
    if (key === "pitch2") pitch2 = val;
    if (key === "type" && (val === "harmonic" || val === "melodic")) intervalType = val;
    if (key === "clef" && (val === "treble" || val === "bass")) clef = val;
    if (key === "play" && val === "true") play = true;
    if (key === "key") {
      const parsed = parseKeySignatureValue(val);
      if (parsed !== null) keySignature = parsed;
    }
    if (key === "time") {
      const parsed = parseTimeSignatureValue(val);
      if (parsed) timeSignature = parsed;
    }
  }

  if (!pitch1 || !pitch2 || !intervalType) return null;
  if (!PITCH_FORMAT.test(pitch1) || !PITCH_FORMAT.test(pitch2)) return null;

  return { type: "interval", pitch1, pitch2, intervalType, clef, play, keySignature, timeSignature };
}

function parseChordTag(body: string): TutorContentSegment | null {
  const parts = body.split(",").map((part) => part.trim());

  let notesValue: string | null = null;
  let clef: ClefType | undefined;
  let play: boolean | undefined;
  let keySignature: number | undefined;
  let timeSignature: TimeSignatureValue | undefined;

  for (const part of parts) {
    const colonIndex = part.indexOf(":");
    if (colonIndex === -1) continue;
    const key = part.slice(0, colonIndex).trim();
    const val = part.slice(colonIndex + 1).trim();

    if (key === "notes") notesValue = val;
    if (key === "clef" && (val === "treble" || val === "bass")) clef = val;
    if (key === "play" && val === "true") play = true;
    if (key === "key") {
      const parsed = parseKeySignatureValue(val);
      if (parsed !== null) keySignature = parsed;
    }
    if (key === "time") {
      const parsed = parseTimeSignatureValue(val);
      if (parsed) timeSignature = parsed;
    }
  }

  if (!notesValue) return null;

  const pitches = notesValue.split(/\s+/).filter(Boolean);
  if (pitches.length !== CHORD_TONE_COUNT) return null;
  if (pitches.some((p) => !PITCH_FORMAT.test(p))) return null;

  return { type: "chord", pitches, clef, play, keySignature, timeSignature };
}

const CADENCE_CHORD_COUNT = 2;

function parseCadenceTag(body: string): TutorContentSegment | null {
  const parts = body.split(",").map((part) => part.trim());

  let chordsValue: string | null = null;
  let clef: ClefType | undefined;
  let play: boolean | undefined;
  let keySignature: number | undefined;
  let timeSignature: TimeSignatureValue | undefined;

  for (const part of parts) {
    const colonIndex = part.indexOf(":");
    if (colonIndex === -1) continue;
    const key = part.slice(0, colonIndex).trim();
    const val = part.slice(colonIndex + 1).trim();

    if (key === "chords") chordsValue = val;
    if (key === "clef" && (val === "treble" || val === "bass")) clef = val;
    if (key === "play" && val === "true") play = true;
    if (key === "key") {
      const parsed = parseKeySignatureValue(val);
      if (parsed !== null) keySignature = parsed;
    }
    if (key === "time") {
      const parsed = parseTimeSignatureValue(val);
      if (parsed) timeSignature = parsed;
    }
  }

  if (!chordsValue) return null;

  // Each chord is 3 pitches joined by "+" (not "-", which a negative octave
  // like "C-1" could already contain); chords are space-separated.
  const chordTokens = chordsValue.split(/\s+/).filter(Boolean);
  if (chordTokens.length !== CADENCE_CHORD_COUNT) return null;

  const chords: string[][] = [];
  for (const token of chordTokens) {
    const pitches = token.split("+");
    if (pitches.length !== CHORD_TONE_COUNT) return null;
    if (pitches.some((p) => !PITCH_FORMAT.test(p))) return null;
    chords.push(pitches);
  }

  return {
    type: "cadence",
    chords: chords as [string[], string[]],
    clef,
    play,
    keySignature,
    timeSignature,
  };
}

export function parseTutorContent(content: string): TutorContentSegment[] {
  const segments: TutorContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(content)) !== null) {
    const [fullMatch, tagName, body] = match;
    const segment =
      tagName === "note"
        ? parseNoteTag(body)
        : tagName === "sequence"
          ? parseSequenceTag(body)
          : tagName === "interval"
            ? parseIntervalTag(body)
            : tagName === "chord"
              ? parseChordTag(body)
              : parseCadenceTag(body);

    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }

    // A tag that fails to parse (out-of-spec token count, bad pitch, unknown
    // duration code...) used to fall back to rendering fullMatch as literal
    // text, which leaked raw "[[sequence:notes:...]]" markup into the chat
    // bubble whenever Gemini emitted something outside the documented spec.
    // Since the surrounding sentence already names what the tag was supposed
    // to show (per the system prompt's instructions), just drop it silently
    // instead of showing broken-looking syntax to the student.
    if (segment) {
      segments.push(segment);
    }

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return segments;
}
