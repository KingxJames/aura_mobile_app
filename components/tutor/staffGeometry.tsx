import React from "react";
import { Path, Text as SvgText } from "react-native-svg";

// Shared staff/pitch/glyph geometry used by both NoteGlyph.tsx (a single
// centered note) and NoteSequence.tsx (a horizontal row of notes) - pulled
// out here so the pitch-to-staff-position math and SMuFL glyph lookups exist
// in exactly one place instead of drifting between two copies.

export type NoteValueType = "whole" | "half" | "quarter" | "eighth" | "sixteenth";
export type ClefType = "treble" | "bass";

// Bundled SMuFL font (Bravura, SIL OFL - see assets/fonts/Bravura-LICENSE.txt).
// Clefs and rests render as real glyphs from this font instead of relying on
// whichever font the device happens to substitute for Unicode musical
// symbols - that device-fallback approach is what caused the original clef
// positioning bug (different fallback fonts have different, unknown vertical
// metrics).
export const SMUFL_FONT_FAMILY = "Bravura";

// SMuFL codepoints (stable, part of the public SMuFL 1.x spec - smufl.org).
export const CLEF_GLYPH: Record<ClefType, string> = {
  treble: "\u{E050}", // gClef
  bass: "\u{E062}", // fClef
};

export const REST_GLYPH: Record<NoteValueType, string> = {
  whole: "\u{E4E3}", // restWhole
  half: "\u{E4E4}", // restHalf
  quarter: "\u{E4E5}", // restQuarter
  eighth: "\u{E4E6}", // rest8th
  sixteenth: "\u{E4E7}", // rest16th
};

// Bottom staff line, in diatonic letter+octave terms, per clef.
export const CLEF_BOTTOM_LINE: Record<ClefType, { letter: string; octave: number }> = {
  treble: { letter: "E", octave: 4 },
  bass: { letter: "G", octave: 2 },
};

// Staff line (0 = top, 4 = bottom) each clef glyph should be centered on -
// the G4 line for treble, the F3 line for bass. Used with alignmentBaseline
// "central" so the glyph is vertically centered on that line regardless of
// the rendering font's own ascent/descent metrics, instead of guessing a
// fixed pixel offset from a baseline that varies per platform/font.
export const CLEF_TARGET_LINE: Record<ClefType, number> = {
  treble: 3,
  bass: 1,
};

// Staff line (0 = top, 4 = bottom) each rest glyph is conventionally centered
// on: a whole rest hangs from the 2nd line from the top, a half rest sits on
// the middle line, and quarter/8th/16th rests are centered on the middle line.
export const REST_TARGET_LINE: Record<NoteValueType, number> = {
  whole: 1,
  half: 2,
  quarter: 2,
  eighth: 2,
  sixteenth: 2,
};

export const DEFAULT_PITCH: Record<ClefType, string> = {
  treble: "B4",
  bass: "D3",
};

const LETTER_STEPS: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

export function diatonicStep(letter: string, octave: number): number {
  return octave * 7 + LETTER_STEPS[letter.toUpperCase()];
}

export function parsePitch(
  pitch: string,
): { letter: string; accidental: "#" | "b" | null; octave: number } | null {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(pitch.trim());
  if (!match) return null;
  const [, letter, accidental, octave] = match;
  return {
    letter: letter.toUpperCase(),
    accidental: (accidental as "#" | "b") || null,
    octave: parseInt(octave, 10),
  };
}

export const STAFF_LINE_SPACING = 14;
export const HALF_SPACING = STAFF_LINE_SPACING / 2;
export const STAFF_TOP_Y = 34;
export const STAFF_BOTTOM_Y = STAFF_TOP_Y + STAFF_LINE_SPACING * 4;
export const STAFF_LEFT_X = 14;
export const HEAD_RX = 7.5;
export const HEAD_RY = 5.5;
export const HEAD_ROTATION = -18;
export const STEM_LENGTH = 32;

// SMuFL convention: a font's em is designed to equal 4 staff-spaces, so
// setting fontSize to 4x the line spacing makes every Bravura glyph sized
// correctly relative to this hand-drawn staff automatically.
export const SMUFL_FONT_SIZE = STAFF_LINE_SPACING * 4;

// Margin (in px) added around whatever a glyph's own content actually needs,
// when a component sizes its SVG viewBox dynamically.
export const CANVAS_MARGIN = 10;

export function stepToY(step: number): number {
  return STAFF_BOTTOM_Y - step * HALF_SPACING;
}

export function ledgerSteps(step: number): number[] {
  const steps: number[] = [];
  if (step > 8) {
    for (let s = 10; s <= step; s += 2) steps.push(s);
  } else if (step < 0) {
    for (let s = -2; s >= step; s -= 2) steps.push(s);
  }
  return steps;
}

export function Flag({
  stemX,
  stemEndY,
  dir,
  color,
  index,
}: {
  stemX: number;
  stemEndY: number;
  dir: 1 | -1;
  color: string;
  index: number;
}) {
  const y = stemEndY + dir * index * 14;
  const d = `M ${stemX},${y} C ${stemX + 16},${y + dir * 6} ${stemX + 14},${y + dir * 22} ${stemX},${y + dir * 28}`;
  return <Path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />;
}

// --- Key & time signatures ------------------------------------------------
//
// Position tables below are pitch+octave strings fed through the SAME
// parsePitch/diatonicStep/stepToY pipeline as regular notes - a key
// signature accidental is drawn at exactly the staff position a natural note
// of that letter would occupy, just at whichever octave keeps the classic
// zigzag shape compact. These were derived from first principles (walking
// the circle of fifths from a starting position) and cross-checked against
// several independently-confirmed reference points before trusting them:
// treble sharps reproduce the documented "zigzag breaks after D#" anomaly;
// bass sharps match "F# starts on the 4th line" and "A# sits in the lowest
// space"; bass flats match "F-flat sits in the space below the staff";
// treble flats anchor on "B-flat sits on the middle line". Order is the
// standard circle-of-fifths order: sharps F C G D A E B, flats B E A D G C F.
const SHARP_ORDER: Record<ClefType, string[]> = {
  treble: ["F5", "C5", "G5", "D5", "A4", "E5", "B4"],
  bass: ["F3", "C3", "G3", "D3", "A2", "E3", "B2"],
};
const FLAT_ORDER: Record<ClefType, string[]> = {
  treble: ["B4", "E5", "A4", "D5", "G4", "C5", "F4"],
  bass: ["B2", "E3", "A2", "D3", "G2", "C3", "F2"],
};

const ACCIDENTAL_GLYPH = {
  sharp: "\u{E262}", // accidentalSharp
  flat: "\u{E260}", // accidentalFlat
};

const TIME_SIG_DIGIT: Record<string, string> = {
  "0": "\u{E080}",
  "1": "\u{E081}",
  "2": "\u{E082}",
  "3": "\u{E083}",
  "4": "\u{E084}",
  "5": "\u{E085}",
  "6": "\u{E086}",
  "7": "\u{E087}",
  "8": "\u{E088}",
  "9": "\u{E089}",
};

function digitsToGlyphs(digits: string): string {
  return digits
    .split("")
    .map((d) => TIME_SIG_DIGIT[d] ?? "")
    .join("");
}

export type TimeSignatureValue = { numerator: string; denominator: string };

// Horizontal space (px) each successive key-signature accidental takes, and
// the space reserved for a stacked time signature. 20px was measured against
// the actual rendered glyph width at SMUFL_FONT_SIZE - the sharp glyph in
// particular is noticeably wider than its nominal "one staff-space" footprint
// suggests, and an earlier, tighter value caused successive accidentals to
// visibly overlap.
const KEY_SIG_ACCIDENTAL_WIDTH = 20;
const TIME_SIG_SLOT_WIDTH = 26;

// Where the key/time signature prefix begins - right after the clef glyph.
export const PREFIX_START_X = STAFF_LEFT_X + 42;

/**
 * How much extra horizontal space (px) the key signature + time signature
 * need, so callers can shift their first note/notehead right by this amount.
 * `keyCount` is signed: positive = sharps, negative = flats, 0/omitted = none.
 */
export function computePrefixWidth(keyCount: number, hasTimeSignature: boolean): number {
  const keyWidth = keyCount !== 0 ? Math.min(Math.abs(keyCount), 7) * KEY_SIG_ACCIDENTAL_WIDTH + 6 : 0;
  const timeWidth = hasTimeSignature ? TIME_SIG_SLOT_WIDTH + 10 : 0;
  return keyWidth + timeWidth;
}

export function KeySignature({
  clef,
  count,
  color,
}: {
  clef: ClefType;
  count: number;
  color: string;
}) {
  if (!count) return null;

  const order = count > 0 ? SHARP_ORDER[clef] : FLAT_ORDER[clef];
  const glyph = count > 0 ? ACCIDENTAL_GLYPH.sharp : ACCIDENTAL_GLYPH.flat;
  const n = Math.min(Math.abs(count), 7);
  const bottomLine = CLEF_BOTTOM_LINE[clef];

  return (
    <>
      {order.slice(0, n).map((pitchStr, i) => {
        const parsed = parsePitch(pitchStr)!;
        const step = diatonicStep(parsed.letter, parsed.octave) - diatonicStep(bottomLine.letter, bottomLine.octave);
        return (
          <SvgText
            key={i}
            x={PREFIX_START_X + i * KEY_SIG_ACCIDENTAL_WIDTH}
            y={stepToY(step)}
            fontFamily={SMUFL_FONT_FAMILY}
            fontSize={SMUFL_FONT_SIZE}
            fill={color}
            textAnchor="middle"
            alignmentBaseline="central"
          >
            {glyph}
          </SvgText>
        );
      })}
    </>
  );
}

export function TimeSignature({
  value,
  x,
  color,
}: {
  value: TimeSignatureValue;
  x: number;
  color: string;
}) {
  return (
    <>
      <SvgText
        x={x}
        y={STAFF_TOP_Y + 1 * STAFF_LINE_SPACING}
        fontFamily={SMUFL_FONT_FAMILY}
        fontSize={SMUFL_FONT_SIZE}
        fill={color}
        textAnchor="middle"
        alignmentBaseline="central"
      >
        {digitsToGlyphs(value.numerator)}
      </SvgText>
      <SvgText
        x={x}
        y={STAFF_TOP_Y + 3 * STAFF_LINE_SPACING}
        fontFamily={SMUFL_FONT_FAMILY}
        fontSize={SMUFL_FONT_SIZE}
        fill={color}
        textAnchor="middle"
        alignmentBaseline="central"
      >
        {digitsToGlyphs(value.denominator)}
      </SvgText>
    </>
  );
}

/** X position for the time signature: right after the clef, or after the key signature when both are present. */
export function timeSignatureX(keyCount: number): number {
  const keyWidth = keyCount !== 0 ? Math.min(Math.abs(keyCount), 7) * KEY_SIG_ACCIDENTAL_WIDTH + 6 : 0;
  return PREFIX_START_X + keyWidth + TIME_SIG_SLOT_WIDTH / 2;
}
