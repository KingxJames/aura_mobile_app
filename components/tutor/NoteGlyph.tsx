import { useFonts } from "expo-font";
import React from "react";
import Svg, { Ellipse, Line, Path, Text as SvgText } from "react-native-svg";

export type NoteValueType = "whole" | "half" | "quarter" | "eighth" | "sixteenth";
export type ClefType = "treble" | "bass";

export const NOTE_LABELS: Record<NoteValueType, string> = {
  whole: "Whole note (semibreve)",
  half: "Half note (minim)",
  quarter: "Quarter note (crotchet)",
  eighth: "Eighth note (quaver)",
  sixteenth: "Sixteenth note (semiquaver)",
};

export const REST_LABELS: Record<NoteValueType, string> = {
  whole: "Whole rest",
  half: "Half rest",
  quarter: "Quarter rest",
  eighth: "Eighth rest",
  sixteenth: "Sixteenth rest",
};

// Duration in quarter-note beats, for handing a tagged note to audioSynth's
// playNoteSequence (which expects duration_beats, not a note type name).
export const NOTE_DURATION_BEATS: Record<NoteValueType, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  sixteenth: 0.25,
};

// Bundled SMuFL font (Bravura, SIL OFL - see assets/fonts/Bravura-LICENSE.txt).
// Clefs and rests render as real glyphs from this font instead of relying on
// whichever font the device happens to substitute for Unicode musical
// symbols - that device-fallback approach is what caused the clef to render
// in the wrong place to begin with, since different fallback fonts have
// different, unknown vertical metrics. Notehead/stem/flag/accidental stay as
// the existing hand-drawn shapes below, since those were never reported broken.
const SMUFL_FONT_FAMILY = "Bravura";

// SMuFL codepoints (stable, part of the public SMuFL 1.x spec - smufl.org).
const CLEF_GLYPH: Record<ClefType, string> = {
  treble: "", // gClef
  bass: "", // fClef
};

const REST_GLYPH: Record<NoteValueType, string> = {
  whole: "", // restWhole
  half: "", // restHalf
  quarter: "", // restQuarter
  eighth: "", // rest8th
  sixteenth: "", // rest16th
};

// Bottom staff line, in diatonic letter+octave terms, per clef.
const CLEF_BOTTOM_LINE: Record<ClefType, { letter: string; octave: number }> = {
  treble: { letter: "E", octave: 4 },
  bass: { letter: "G", octave: 2 },
};

// Staff line (0 = top, 4 = bottom) each clef glyph should be centered on -
// the G4 line for treble, the F3 line for bass. Used with alignmentBaseline
// "central" so the glyph is vertically centered on that line regardless of
// the rendering font's own ascent/descent metrics, instead of guessing a
// fixed pixel offset from a baseline that varies per platform/font.
const CLEF_TARGET_LINE: Record<ClefType, number> = {
  treble: 3,
  bass: 1,
};

// Staff line (0 = top, 4 = bottom) each rest glyph is conventionally centered
// on: a whole rest hangs from the 2nd line from the top, a half rest sits on
// the middle line, and quarter/8th/16th rests are centered on the middle line.
const REST_TARGET_LINE: Record<NoteValueType, number> = {
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

function diatonicStep(letter: string, octave: number): number {
  return octave * 7 + LETTER_STEPS[letter.toUpperCase()];
}

function parsePitch(pitch: string): { letter: string; accidental: "#" | "b" | null; octave: number } | null {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(pitch.trim());
  if (!match) return null;
  const [, letter, accidental, octave] = match;
  return { letter: letter.toUpperCase(), accidental: (accidental as "#" | "b") || null, octave: parseInt(octave, 10) };
}

const STAFF_LINE_SPACING = 14;
const HALF_SPACING = STAFF_LINE_SPACING / 2;
const STAFF_TOP_Y = 34;
const STAFF_BOTTOM_Y = STAFF_TOP_Y + STAFF_LINE_SPACING * 4;
const STAFF_LEFT_X = 14;
const STAFF_RIGHT_X = 150;
const NOTE_X = 118;
const HEAD_RX = 7.5;
const HEAD_RY = 5.5;
const HEAD_ROTATION = -18;
const STEM_LENGTH = 32;

// SMuFL convention: a font's em is designed to equal 4 staff-spaces, so
// setting fontSize to 4x the line spacing makes every Bravura glyph sized
// correctly relative to this hand-drawn staff automatically.
const SMUFL_FONT_SIZE = STAFF_LINE_SPACING * 4;

function stepToY(step: number): number {
  return STAFF_BOTTOM_Y - step * HALF_SPACING;
}

function ledgerSteps(step: number): number[] {
  const steps: number[] = [];
  if (step > 8) {
    for (let s = 10; s <= step; s += 2) steps.push(s);
  } else if (step < 0) {
    for (let s = -2; s >= step; s -= 2) steps.push(s);
  }
  return steps;
}

function Flag({ stemX, stemEndY, dir, color, index }: {
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

type Props = {
  type: NoteValueType;
  pitch?: string;
  clef?: ClefType;
  rest?: boolean;
  color?: string;
  width?: number;
};

export default function NoteGlyph({
  type,
  pitch,
  clef = "treble",
  rest = false,
  color = "#1F2937",
  width = 170,
}: Props) {
  const [fontsLoaded] = useFonts({ [SMUFL_FONT_FAMILY]: require("@/assets/fonts/Bravura.otf") });

  // Rests have no pitch - their vertical position is fixed by convention
  // (REST_TARGET_LINE), not by where a note sits on the staff.
  const parsedPitch = rest
    ? null
    : parsePitch(pitch ?? DEFAULT_PITCH[clef]) ?? parsePitch(DEFAULT_PITCH[clef])!;
  const bottomLine = CLEF_BOTTOM_LINE[clef];
  const step = parsedPitch
    ? diatonicStep(parsedPitch.letter, parsedPitch.octave) - diatonicStep(bottomLine.letter, bottomLine.octave)
    : 0;

  const noteY = stepToY(step);
  const hasStem = !rest && type !== "whole";
  const filledHead = !rest && type !== "whole" && type !== "half";
  const flagCount = rest ? 0 : type === "eighth" ? 1 : type === "sixteenth" ? 2 : 0;
  const stemUp = step <= 4;
  const stemX = stemUp ? NOTE_X + HEAD_RX * 0.85 : NOTE_X - HEAD_RX * 0.85;
  const stemEndY = stemUp ? noteY - STEM_LENGTH : noteY + STEM_LENGTH;
  const dir: 1 | -1 = stemUp ? 1 : -1;
  const ledgers = rest ? [] : ledgerSteps(step);
  const height = STAFF_BOTTOM_Y + 40;

  // Wait for the bundled font before rendering anything - a system-fallback
  // glyph flashing in first, then getting replaced, is worse than a brief blank.
  if (!fontsLoaded) return null;

  return (
    <Svg width={width} height={(width / (STAFF_RIGHT_X + 20)) * height} viewBox={`0 0 ${STAFF_RIGHT_X + 20} ${height}`}>
      {[0, 1, 2, 3, 4].map((line) => (
        <Line
          key={line}
          x1={STAFF_LEFT_X}
          y1={STAFF_TOP_Y + line * STAFF_LINE_SPACING}
          x2={STAFF_RIGHT_X}
          y2={STAFF_TOP_Y + line * STAFF_LINE_SPACING}
          stroke={color}
          strokeWidth={1.5}
          opacity={0.7}
        />
      ))}

      <SvgText
        x={STAFF_LEFT_X + 16}
        y={STAFF_TOP_Y + CLEF_TARGET_LINE[clef] * STAFF_LINE_SPACING}
        fontFamily={SMUFL_FONT_FAMILY}
        fontSize={SMUFL_FONT_SIZE}
        fill={color}
        textAnchor="middle"
        alignmentBaseline="central"
      >
        {CLEF_GLYPH[clef]}
      </SvgText>

      {rest ? (
        <SvgText
          x={NOTE_X}
          y={STAFF_TOP_Y + REST_TARGET_LINE[type] * STAFF_LINE_SPACING}
          fontFamily={SMUFL_FONT_FAMILY}
          fontSize={SMUFL_FONT_SIZE}
          fill={color}
          textAnchor="middle"
          alignmentBaseline="central"
        >
          {REST_GLYPH[type]}
        </SvgText>
      ) : (
        <>
          {ledgers.map((s) => (
            <Line
              key={s}
              x1={NOTE_X - HEAD_RX - 4}
              y1={stepToY(s)}
              x2={NOTE_X + HEAD_RX + 4}
              y2={stepToY(s)}
              stroke={color}
              strokeWidth={1.5}
            />
          ))}

          {parsedPitch?.accidental && (
            <SvgText
              x={NOTE_X - HEAD_RX - 12}
              y={noteY + 5}
              fontSize={16}
              fill={color}
              textAnchor="middle"
            >
              {parsedPitch.accidental === "#" ? "♯" : "♭"}
            </SvgText>
          )}

          {hasStem && (
            <Line x1={stemX} y1={noteY} x2={stemX} y2={stemEndY} stroke={color} strokeWidth={2.2} />
          )}

          {Array.from({ length: flagCount }).map((_, i) => (
            <Flag key={i} stemX={stemX} stemEndY={stemEndY} dir={dir} color={color} index={i} />
          ))}

          <Ellipse
            cx={NOTE_X}
            cy={noteY}
            rx={HEAD_RX}
            ry={HEAD_RY}
            rotation={HEAD_ROTATION}
            origin={`${NOTE_X}, ${noteY}`}
            fill={filledHead ? color : "none"}
            stroke={color}
            strokeWidth={filledHead ? 0 : 2}
          />
        </>
      )}
    </Svg>
  );
}
