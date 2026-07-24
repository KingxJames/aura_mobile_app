import type { ClefType, NoteValueType } from "@/components/tutor/NoteGlyph";

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

// Matches [[note:quarter]] or [[note:quarter,pitch:C4]] or
// [[note:quarter,pitch:C4,clef:bass]] or [[note:quarter,pitch:C4,play:true]]
// or [[note:quarter,rest:true]]
const NOTE_TAG_PATTERN = /\[\[note:([^\]]+)\]\]/g;

export type TutorContentSegment =
  | { type: "text"; value: string }
  | {
      type: "note";
      value: NoteValueType;
      pitch?: string;
      clef?: ClefType;
      play?: boolean;
      rest?: boolean;
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
  }
  return segment;
}

export function parseTutorContent(content: string): TutorContentSegment[] {
  const segments: TutorContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  NOTE_TAG_PATTERN.lastIndex = 0;
  while ((match = NOTE_TAG_PATTERN.exec(content)) !== null) {
    const [fullMatch, body] = match;
    const noteSegment = parseNoteTag(body);

    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }

    segments.push(noteSegment ?? { type: "text", value: fullMatch });

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return segments;
}
