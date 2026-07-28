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

// A stacked ("harmonic") or side-by-side ("melodic") pair of notes with the
// interval number shown between them, e.g. "how far apart are C and G?" -> a
// 5th. Always drawn as plain quarter notes - duration isn't the pedagogical
// point here, the distance between the two pitches is, so unlike
// NoteGlyph/NoteSequence there's no duration prop.

export type IntervalType = "harmonic" | "melodic";

const ORDINAL_LABEL: Record<number, string> = { 1: "Unison", 8: "Octave" };

/** Diatonic distance between two pitches, counted inclusively (C to D = 2nd, C to G = 5th). */
export function intervalNumber(pitch1: string, pitch2: string): number | null {
  const p1 = parsePitch(pitch1);
  const p2 = parsePitch(pitch2);
  if (!p1 || !p2) return null;
  return Math.abs(diatonicStep(p2.letter, p2.octave) - diatonicStep(p1.letter, p1.octave)) + 1;
}

export function intervalLabel(pitch1: string, pitch2: string): string {
  const n = intervalNumber(pitch1, pitch2);
  if (n === null) return "";
  return ORDINAL_LABEL[n] ?? `${n}th`;
}

const NOTE_X_BASE = 118;
const HARMONIC_RIGHT_MARGIN = 40;
const MELODIC_NOTE_SPACING = 64;
const MELODIC_RIGHT_MARGIN = 30;
const BRACKET_GAP = 10; // px between the higher note's stem/head and the bracket
const BRACKET_TICK = 6; // px the bracket's end-ticks drop down toward each notehead

type Props = {
  pitch1: string;
  pitch2: string;
  intervalType: IntervalType;
  clef?: ClefType;
  keySignature?: number;
  timeSignature?: TimeSignatureValue;
  color?: string;
  width?: number;
};

function NoteHead({
  x,
  y,
  accidental,
  color,
}: {
  x: number;
  y: number;
  accidental: "#" | "b" | null;
  color: string;
}) {
  return (
    <>
      {accidental && (
        <SvgText x={x - HEAD_RX - 12} y={y + 5} fontSize={16} fill={color} textAnchor="middle">
          {accidental === "#" ? "♯" : "♭"}
        </SvgText>
      )}
      <Ellipse cx={x} cy={y} rx={HEAD_RX} ry={HEAD_RY} rotation={HEAD_ROTATION} origin={`${x}, ${y}`} fill={color} />
    </>
  );
}

function LedgerLines({ x, steps, color }: { x: number; steps: number[]; color: string }) {
  return (
    <>
      {steps.map((s) => (
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
    </>
  );
}

export default function IntervalGlyph({
  pitch1,
  pitch2,
  intervalType,
  clef = "treble",
  keySignature = 0,
  timeSignature,
  color = "#1F2937",
  width = 240,
}: Props) {
  const [fontsLoaded] = useFonts({ [SMUFL_FONT_FAMILY]: require("@/assets/fonts/Bravura.otf") });

  const p1 = parsePitch(pitch1);
  const p2 = parsePitch(pitch2);

  if (!fontsLoaded || !p1 || !p2) return null;

  const prefixWidth = computePrefixWidth(keySignature, !!timeSignature);
  const label = intervalLabel(pitch1, pitch2);
  const noteX = NOTE_X_BASE + prefixWidth;

  const bottomLine = CLEF_BOTTOM_LINE[clef];
  const step1 = diatonicStep(p1.letter, p1.octave) - diatonicStep(bottomLine.letter, bottomLine.octave);
  const step2 = diatonicStep(p2.letter, p2.octave) - diatonicStep(bottomLine.letter, bottomLine.octave);
  const y1 = stepToY(step1);
  const y2 = stepToY(step2);
  const ledgers1 = ledgerSteps(step1);
  const ledgers2 = ledgerSteps(step2);

  const topCandidates = [STAFF_TOP_Y, y1 - HEAD_RY, y2 - HEAD_RY];
  const bottomCandidates = [STAFF_BOTTOM_Y + 40, y1 + HEAD_RY, y2 + HEAD_RY];
  [...ledgers1, ...ledgers2].forEach((s) => {
    const y = stepToY(s);
    topCandidates.push(y);
    bottomCandidates.push(y);
  });

  let content;
  let staffRightX;

  if (intervalType === "harmonic") {
    staffRightX = noteX + HARMONIC_RIGHT_MARGIN;

    // One shared stem serves both heads: it starts at the note nearer the
    // stem direction and extends STEM_LENGTH past the note farther from it,
    // passing through both note centers since they share the same x.
    const lowStep = Math.min(step1, step2);
    const highStep = Math.max(step1, step2);
    const yBottom = stepToY(lowStep);
    const yTop = stepToY(highStep);
    const stemUp = (step1 + step2) / 2 <= 4;
    const stemX = stemUp ? noteX + HEAD_RX * 0.85 : noteX - HEAD_RX * 0.85;
    const stemStartY = stemUp ? yBottom : yTop;
    const stemEndY = stemUp ? yTop - STEM_LENGTH : yBottom + STEM_LENGTH;
    const labelY = stemUp ? stemEndY - 14 : stemEndY + 18;

    topCandidates.push(stemEndY, labelY - 10);
    bottomCandidates.push(stemEndY, labelY + 10);

    content = (
      <>
        <LedgerLines x={noteX} steps={[...ledgers1, ...ledgers2]} color={color} />
        <Line x1={stemX} y1={stemStartY} x2={stemX} y2={stemEndY} stroke={color} strokeWidth={2.2} />
        <NoteHead x={noteX} y={y1} accidental={p1.accidental} color={color} />
        <NoteHead x={noteX} y={y2} accidental={p2.accidental} color={color} />
        <SvgText x={noteX} y={labelY} fontSize={13} fontWeight="700" fill={color} textAnchor="middle">
          {label}
        </SvgText>
      </>
    );
  } else {
    const noteX2 = noteX + MELODIC_NOTE_SPACING;
    staffRightX = noteX2 + MELODIC_RIGHT_MARGIN;

    const stemUp1 = step1 <= 4;
    const stemUp2 = step2 <= 4;
    const stemX1 = stemUp1 ? noteX + HEAD_RX * 0.85 : noteX - HEAD_RX * 0.85;
    const stemX2 = stemUp2 ? noteX2 + HEAD_RX * 0.85 : noteX2 - HEAD_RX * 0.85;
    const stemEndY1 = stemUp1 ? y1 - STEM_LENGTH : y1 + STEM_LENGTH;
    const stemEndY2 = stemUp2 ? y2 - STEM_LENGTH : y2 + STEM_LENGTH;

    // Bracket sits above whichever stem tops out highest (smallest Y), with
    // the interval number centered above the bracket itself.
    const bracketY = Math.min(stemEndY1, stemEndY2) - BRACKET_GAP;
    const labelY = bracketY - 10;

    topCandidates.push(stemEndY1, stemEndY2, labelY - 8);
    bottomCandidates.push(stemEndY1, stemEndY2);

    content = (
      <>
        <LedgerLines x={noteX} steps={ledgers1} color={color} />
        <LedgerLines x={noteX2} steps={ledgers2} color={color} />
        <Line x1={stemX1} y1={y1} x2={stemX1} y2={stemEndY1} stroke={color} strokeWidth={2.2} />
        <Line x1={stemX2} y1={y2} x2={stemX2} y2={stemEndY2} stroke={color} strokeWidth={2.2} />
        <NoteHead x={noteX} y={y1} accidental={p1.accidental} color={color} />
        <NoteHead x={noteX2} y={y2} accidental={p2.accidental} color={color} />

        <Line x1={noteX} y1={bracketY + BRACKET_TICK} x2={noteX} y2={bracketY} stroke={color} strokeWidth={1.5} />
        <Line x1={noteX} y1={bracketY} x2={noteX2} y2={bracketY} stroke={color} strokeWidth={1.5} />
        <Line x1={noteX2} y1={bracketY + BRACKET_TICK} x2={noteX2} y2={bracketY} stroke={color} strokeWidth={1.5} />
        <SvgText x={(noteX + noteX2) / 2} y={labelY} fontSize={13} fontWeight="700" fill={color} textAnchor="middle">
          {label}
        </SvgText>
      </>
    );
  }

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

      {content}
    </Svg>
  );
}
