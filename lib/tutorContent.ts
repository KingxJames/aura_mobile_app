import type { ArticulationType, ClefType, DynamicType, NoteValueType, OrnamentType } from "@/components/tutor/NoteGlyph";
import type { SequenceToken } from "@/components/tutor/NoteSequence";
import type { TimeSignatureValue } from "@/components/tutor/staffGeometry";

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
const ORNAMENT_VALUES: OrnamentType[] = ["fermata"];

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
// or [[sequence:notes:C4-q D4-q E4-q F4-q,clef:treble,play:true]]
const TAG_PATTERN = /\[\[(note|sequence):([^\]]+)\]\]/g;

export type TutorContentSegment =
  | { type: "text"; value: string }
  | {
      type: "note";
      value: NoteValueType;
      pitch?: string;
      clef?: ClefType;
      play?: boolean;
      rest?: boolean;
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
    const split = splitOnLastDash(raw);
    if (!split) return null;
    const [pitchOrRest, code] = split;
    const noteType = DURATION_CODE[code.toLowerCase()];
    if (!noteType) return null;

    if (pitchOrRest.toLowerCase() === "r") {
      tokens.push({ rest: true, type: noteType });
    } else {
      tokens.push({ rest: false, type: noteType, pitch: pitchOrRest });
    }
  }

  return { type: "sequence", tokens, clef, play, keySignature, timeSignature };
}

export function parseTutorContent(content: string): TutorContentSegment[] {
  const segments: TutorContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TAG_PATTERN.lastIndex = 0;
  while ((match = TAG_PATTERN.exec(content)) !== null) {
    const [fullMatch, tagName, body] = match;
    const segment = tagName === "note" ? parseNoteTag(body) : parseSequenceTag(body);

    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }

    segments.push(segment ?? { type: "text", value: fullMatch });

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return segments;
}
