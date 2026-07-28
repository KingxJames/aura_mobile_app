import { useFonts } from "expo-font";
import React from "react";
import Svg, { Ellipse, Line, Text as SvgText } from "react-native-svg";
import {
  CANVAS_MARGIN,
  CLEF_BOTTOM_LINE,
  CLEF_GLYPH,
  CLEF_TARGET_LINE,
  type ClefType,
  computePrefixWidth,
  diatonicStep,
  HEAD_ROTATION,
  HEAD_RX,
  HEAD_RY,
  KeySignature,
  ledgerSteps,
  parsePitch,
  SMUFL_FONT_FAMILY,
  SMUFL_FONT_SIZE,
  STAFF_LEFT_X,
  STAFF_LINE_SPACING,
  STAFF_TOP_Y,
  STAFF_BOTTOM_Y,
  stepToY,
  STEM_LENGTH,
  TimeSignature,
  timeSignatureX,
  type TimeSignatureValue,
} from "./staffGeometry";

// A 3-note triad, stacked on one shared stem - covers the "triads" and
// "chord_inversions" curriculum topics. Deliberately triads only (not 7th
// chords or clusters): root/quality/inversion below are computed from the
// pitches, never asked of the AI (same reasoning as intervalLabel in
// IntervalGlyph.tsx - an LLM getting the theory arithmetic wrong would
// mislabel exactly what this is meant to teach). A triad is defined by its
// letters stacked in generic 3rds, so which pitch is the "root" only depends
// on letter-name spacing; once the root is known, the actual semitone
// distances above it give the quality (major/minor/diminished/augmented);
// and whichever chord tone is the lowest SOUNDING pitch (regardless of
// input order) gives the inversion. Always rendered as plain quarter notes -
// like intervals, duration isn't the point here.

const LETTER_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function semitoneValue(letter: string, accidental: "#" | "b" | null, octave: number): number {
  const base = LETTER_SEMITONE[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  return octave * 12 + base;
}

// Generic (letter-only) distance from `root` to `letter`, in diatonic steps
// 0-6 - exported for CadenceGlyph.tsx, which uses the same letter-only
// distance to work out each chord's scale degree relative to the key's tonic.
export function genericInterval(root: string, letter: string): number {
  return ((diatonicStep(letter, 0) - diatonicStep(root, 0)) % 7 + 7) % 7;
}

const QUALITY_LABEL = {
  major: "major",
  minor: "minor",
  diminished: "diminished",
  augmented: "augmented",
} as const;

const INVERSION_LABEL = ["root position", "1st inversion", "2nd inversion"] as const;

export type ChordAnalysis = {
  rootLetter: string;
  rootAccidental: "#" | "b" | null;
  quality: keyof typeof QUALITY_LABEL | null;
  inversion: 0 | 1 | 2;
};

export type ParsedPitch = { letter: string; accidental: "#" | "b" | null; octave: number };

/** Which of the 3 pitches is the root: the one whose letter, stacked with the
 * other two, forms a generic 3rd + 5th (e.g. C/E/G qualifies, C/D/G doesn't -
 * not every 3 letters form a tertian triad). */
function findRootIndex(letters: string[]): number | null {
  for (let i = 0; i < 3; i++) {
    const others = [0, 1, 2].filter((j) => j !== i).map((j) => genericInterval(letters[i], letters[j]));
    const sorted = [...others].sort((a, b) => a - b);
    if (sorted[0] === 2 && sorted[1] === 4) return i;
  }
  return null;
}

export function analyzeChord(pitches: string[]): ChordAnalysis | null {
  if (pitches.length !== 3) return null;
  const parsed = pitches.map((p) => parsePitch(p));
  if (parsed.some((p) => !p)) return null;
  const p = parsed as ParsedPitch[];

  const rootIdx = findRootIndex(p.map((x) => x.letter));
  if (rootIdx === null) return null;
  const thirdIdx = [0, 1, 2].find((i) => i !== rootIdx && genericInterval(p[rootIdx].letter, p[i].letter) === 2)!;
  const fifthIdx = [0, 1, 2].find((i) => i !== rootIdx && i !== thirdIdx)!;

  const rootSemi = semitoneValue(p[rootIdx].letter, p[rootIdx].accidental, p[rootIdx].octave);
  const thirdSemi = semitoneValue(p[thirdIdx].letter, p[thirdIdx].accidental, p[thirdIdx].octave);
  const fifthSemi = semitoneValue(p[fifthIdx].letter, p[fifthIdx].accidental, p[fifthIdx].octave);
  const thirdInterval = ((thirdSemi - rootSemi) % 12 + 12) % 12;
  const fifthInterval = ((fifthSemi - rootSemi) % 12 + 12) % 12;

  let quality: ChordAnalysis["quality"] = null;
  if (thirdInterval === 4 && fifthInterval === 7) quality = "major";
  else if (thirdInterval === 3 && fifthInterval === 7) quality = "minor";
  else if (thirdInterval === 3 && fifthInterval === 6) quality = "diminished";
  else if (thirdInterval === 4 && fifthInterval === 8) quality = "augmented";

  const bassIdx = [0, 1, 2].reduce((best, i) => {
    const bestSemi = semitoneValue(p[best].letter, p[best].accidental, p[best].octave);
    const iSemi = semitoneValue(p[i].letter, p[i].accidental, p[i].octave);
    return iSemi < bestSemi ? i : best;
  }, 0);
  const inversion = bassIdx === rootIdx ? 0 : bassIdx === thirdIdx ? 1 : 2;

  return { rootLetter: p[rootIdx].letter, rootAccidental: p[rootIdx].accidental, quality, inversion };
}

export function chordLabel(pitches: string[]): string {
  const analysis = analyzeChord(pitches);
  if (!analysis) return "Chord";
  const accidentalSymbol = analysis.rootAccidental === "#" ? "♯" : analysis.rootAccidental === "b" ? "♭" : "";
  const qualityText = analysis.quality ? ` ${QUALITY_LABEL[analysis.quality]}` : "";
  return `${analysis.rootLetter}${accidentalSymbol}${qualityText} — ${INVERSION_LABEL[analysis.inversion]}`;
}

const NOTE_X_BASE = 118;
const RIGHT_MARGIN = 40;

// Geometry (positions only, no x - callers place the stack) for a group of
// pitches stacked on one shared stem. Exported so CadenceGlyph.tsx can lay
// out 2 of these side by side instead of duplicating this math.
export type ChordStackGeometry = {
  parsed: ParsedPitch[];
  ys: number[];
  ledgers: number[];
  stemUp: boolean;
  stemStartY: number;
  stemEndY: number;
};

export function chordStackGeometry(pitches: string[], clef: ClefType): ChordStackGeometry | null {
  const parsed = pitches.map((p) => parsePitch(p));
  if (parsed.some((p) => !p)) return null;
  const p = parsed as ParsedPitch[];

  const bottomLine = CLEF_BOTTOM_LINE[clef];
  const steps = p.map((pitch) => diatonicStep(pitch.letter, pitch.octave) - diatonicStep(bottomLine.letter, bottomLine.octave));
  const ys = steps.map((s) => stepToY(s));
  const ledgers = Array.from(new Set(steps.flatMap((s) => ledgerSteps(s))));

  const yBottom = Math.max(...ys);
  const yTop = Math.min(...ys);
  const stemUp = steps.reduce((sum, s) => sum + s, 0) / steps.length <= 4;
  const stemStartY = stemUp ? yBottom : yTop;
  const stemEndY = stemUp ? yTop - STEM_LENGTH : yBottom + STEM_LENGTH;

  return { parsed: p, ys, ledgers, stemUp, stemStartY, stemEndY };
}

/** Renders one stacked-notehead-on-a-stem group at a given x. Pure presentation - callers own bounds/layout. */
export function ChordStack({
  x,
  geometry,
  color,
}: {
  x: number;
  geometry: ChordStackGeometry;
  color: string;
}) {
  const stemX = geometry.stemUp ? x + HEAD_RX * 0.85 : x - HEAD_RX * 0.85;

  return (
    <>
      {geometry.ledgers.map((s) => (
        <Line
          key={s}
          x1={x - HEAD_RX - 4}
          y1={stepToY(s)}
          x2={x + HEAD_RX + 4}
          y2={stepToY(s)}
          stroke={color}
          strokeWidth={1.5}
        />
      ))}

      <Line x1={stemX} y1={geometry.stemStartY} x2={stemX} y2={geometry.stemEndY} stroke={color} strokeWidth={2.2} />

      {geometry.parsed.map((pitch, i) => (
        <React.Fragment key={i}>
          {pitch.accidental && (
            <SvgText x={x - HEAD_RX - 12} y={geometry.ys[i] + 5} fontSize={16} fill={color} textAnchor="middle">
              {pitch.accidental === "#" ? "♯" : "♭"}
            </SvgText>
          )}
          <Ellipse
            cx={x}
            cy={geometry.ys[i]}
            rx={HEAD_RX}
            ry={HEAD_RY}
            rotation={HEAD_ROTATION}
            origin={`${x}, ${geometry.ys[i]}`}
            fill={color}
          />
        </React.Fragment>
      ))}
    </>
  );
}

type Props = {
  pitches: string[];
  clef?: ClefType;
  keySignature?: number;
  timeSignature?: TimeSignatureValue;
  color?: string;
  width?: number;
};

export default function ChordGlyph({
  pitches,
  clef = "treble",
  keySignature = 0,
  timeSignature,
  color = "#1F2937",
  width = 200,
}: Props) {
  const [fontsLoaded] = useFonts({ [SMUFL_FONT_FAMILY]: require("@/assets/fonts/Bravura.otf") });

  const geometry = chordStackGeometry(pitches, clef);
  if (!fontsLoaded || pitches.length !== 3 || !geometry) return null;

  const prefixWidth = computePrefixWidth(keySignature, !!timeSignature);
  const noteX = NOTE_X_BASE + prefixWidth;
  const staffRightX = noteX + RIGHT_MARGIN;

  const topCandidates = [STAFF_TOP_Y, ...geometry.ys.map((y) => y - HEAD_RY), geometry.stemEndY];
  const bottomCandidates = [STAFF_BOTTOM_Y + 40, ...geometry.ys.map((y) => y + HEAD_RY), geometry.stemEndY];
  geometry.ledgers.forEach((s) => {
    const y = stepToY(s);
    topCandidates.push(y);
    bottomCandidates.push(y);
  });

  const viewTop = Math.min(...topCandidates) - CANVAS_MARGIN;
  const viewBottom = Math.max(...bottomCandidates) + CANVAS_MARGIN;
  const contentHeight = viewBottom - viewTop;
  const viewWidth = staffRightX + 20;

  return (
    <Svg width={width} height={(width / viewWidth) * contentHeight} viewBox={`0 ${viewTop} ${viewWidth} ${contentHeight}`}>
      {[0, 1, 2, 3, 4].map((line) => (
        <Line
          key={line}
          x1={STAFF_LEFT_X}
          y1={STAFF_TOP_Y + line * STAFF_LINE_SPACING}
          x2={staffRightX}
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

      <KeySignature clef={clef} count={keySignature} color={color} />

      {timeSignature && (
        <TimeSignature value={timeSignature} x={timeSignatureX(keySignature)} color={color} />
      )}

      <ChordStack x={noteX} geometry={geometry} color={color} />
    </Svg>
  );
}
