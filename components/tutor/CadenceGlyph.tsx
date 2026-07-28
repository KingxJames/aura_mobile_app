import { useFonts } from "expo-font";
import React from "react";
import Svg, { Line, Text as SvgText } from "react-native-svg";
import {
  CANVAS_MARGIN,
  CLEF_GLYPH,
  CLEF_TARGET_LINE,
  type ClefType,
  computePrefixWidth,
  HEAD_RY,
  KeySignature,
  SMUFL_FONT_FAMILY,
  SMUFL_FONT_SIZE,
  STAFF_LEFT_X,
  STAFF_LINE_SPACING,
  STAFF_TOP_Y,
  STAFF_BOTTOM_Y,
  stepToY,
  TimeSignature,
  timeSignatureX,
  type TimeSignatureValue,
} from "./staffGeometry";
import { analyzeChord, chordStackGeometry, ChordStack, genericInterval } from "./ChordGlyph";

// Two triads in a row, the harmonic move that closes a phrase - covers the
// "cadences" curriculum topic. Like ChordGlyph, the classification (perfect/
// plagal/imperfect/interrupted) is computed, never asked of the AI: it's a
// question of which scale degree (relative to the KEY's tonic - hence why
// this needs keySignature, unlike the other tags where it's just cosmetic)
// each chord's root sits on, and how the second chord resolves the first.
// Only classifies 2-chord cadences; anything longer should be described in
// words instead of forced into this tag.

// Tonic pitch letter for each key signature (signed sharps/flats, matching
// the `,key:N` convention already used by every other tag) - major-key
// tonics only, same simplification the system prompt already documents for
// [[note:...]]'s key signatures ("for a minor key, use its relative major's
// sharp/flat count").
const TONIC_FOR_KEY: Record<string, string> = {
  "-7": "C",
  "-6": "G",
  "-5": "D",
  "-4": "A",
  "-3": "E",
  "-2": "B",
  "-1": "F",
  "0": "C",
  "1": "G",
  "2": "D",
  "3": "A",
  "4": "E",
  "5": "B",
  "6": "F",
  "7": "C",
};

export type CadenceType = "perfect" | "plagal" | "imperfect" | "interrupted";

const CADENCE_TYPE_LABEL: Record<CadenceType, string> = {
  perfect: "Perfect (authentic) cadence",
  plagal: "Plagal cadence",
  imperfect: "Imperfect (half) cadence",
  interrupted: "Interrupted (deceptive) cadence",
};

/** `chords` is [firstChord, secondChord], each 3 pitches. `keySignature` identifies the tonic the degrees are measured against. */
export function analyzeCadence(chords: [string[], string[]], keySignature: number): CadenceType | null {
  const tonicLetter = TONIC_FOR_KEY[String(keySignature)] ?? TONIC_FOR_KEY["0"];
  const [firstAnalysis, secondAnalysis] = chords.map((pitches) => analyzeChord(pitches));
  if (!firstAnalysis || !secondAnalysis) return null;

  const firstDegree = genericInterval(tonicLetter, firstAnalysis.rootLetter);
  const secondDegree = genericInterval(tonicLetter, secondAnalysis.rootLetter);

  if (secondDegree === 0 && firstDegree === 4) return "perfect";
  if (secondDegree === 0 && firstDegree === 3) return "plagal";
  if (secondDegree === 5 && firstDegree === 4) return "interrupted";
  if (secondDegree === 4) return "imperfect";
  return null;
}

export function cadenceLabel(chords: [string[], string[]], keySignature: number): string {
  const type = analyzeCadence(chords, keySignature);
  return type ? CADENCE_TYPE_LABEL[type] : "Chord progression";
}

const NOTE_X_BASE = 118;
const CHORD_SPACING = 70;
const RIGHT_MARGIN = 30;

type Props = {
  chords: [string[], string[]];
  clef?: ClefType;
  keySignature?: number;
  timeSignature?: TimeSignatureValue;
  color?: string;
  width?: number;
};

export default function CadenceGlyph({
  chords,
  clef = "treble",
  keySignature = 0,
  timeSignature,
  color = "#1F2937",
  width = 260,
}: Props) {
  const [fontsLoaded] = useFonts({ [SMUFL_FONT_FAMILY]: require("@/assets/fonts/Bravura.otf") });

  const geometries = chords.map((pitches) => chordStackGeometry(pitches, clef));
  if (!fontsLoaded || geometries.some((g) => !g)) return null;
  const [geom1, geom2] = geometries as NonNullable<(typeof geometries)[number]>[];

  const prefixWidth = computePrefixWidth(keySignature, !!timeSignature);
  const noteX1 = NOTE_X_BASE + prefixWidth;
  const noteX2 = noteX1 + CHORD_SPACING;
  const staffRightX = noteX2 + RIGHT_MARGIN;

  const topCandidates = [STAFF_TOP_Y];
  const bottomCandidates = [STAFF_BOTTOM_Y + 40];
  [geom1, geom2].forEach((g) => {
    g.ys.forEach((y) => {
      topCandidates.push(y - HEAD_RY);
      bottomCandidates.push(y + HEAD_RY);
    });
    topCandidates.push(g.stemEndY);
    bottomCandidates.push(g.stemEndY);
    g.ledgers.forEach((s) => {
      const y = stepToY(s);
      topCandidates.push(y);
      bottomCandidates.push(y);
    });
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

      <ChordStack x={noteX1} geometry={geom1} color={color} />
      <ChordStack x={noteX2} geometry={geom2} color={color} />
    </Svg>
  );
}
