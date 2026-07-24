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
  Flag,
  HEAD_ROTATION,
  HEAD_RX,
  HEAD_RY,
  KeySignature,
  ledgerSteps,
  type NoteValueType,
  parsePitch,
  REST_GLYPH,
  REST_TARGET_LINE,
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

// A short, single-voice, single-clef row of notes/rests (a scale, a simple
// phrase) - deliberately NOT a general engraver: no chords (one pitch per
// token), no beaming (every eighth/sixteenth keeps its own flag), no
// ties/slurs, no per-note articulation/dynamics. Each of those is a real
// feature with its own layout problems; this only covers "play/show me a
// short line of notes," which is most of what a theory tutor actually needs
// to demonstrate. Key/time signature ARE supported (they apply once to the
// whole sequence, not per-note, so they don't have that per-note complexity).

export type SequenceToken =
  | { rest: false; type: NoteValueType; pitch: string }
  | { rest: true; type: NoteValueType };

const CLEF_WIDTH = 40;
const NOTE_SPACING = 44;
const FIRST_NOTE_OFFSET = 20;
const RIGHT_MARGIN = 30;

type Props = {
  tokens: SequenceToken[];
  clef?: ClefType;
  keySignature?: number;
  timeSignature?: TimeSignatureValue;
  color?: string;
  width?: number;
};

export default function NoteSequence({
  tokens,
  clef = "treble",
  keySignature = 0,
  timeSignature,
  color = "#1F2937",
  width = 340,
}: Props) {
  const [fontsLoaded] = useFonts({ [SMUFL_FONT_FAMILY]: require("@/assets/fonts/Bravura.otf") });

  const prefixWidth = computePrefixWidth(keySignature, !!timeSignature);
  const firstNoteX = STAFF_LEFT_X + CLEF_WIDTH + prefixWidth + FIRST_NOTE_OFFSET;
  const bottomLine = CLEF_BOTTOM_LINE[clef];

  const notes = tokens.map((token, index) => {
    const x = firstNoteX + index * NOTE_SPACING;

    if (token.rest) {
      return { token, x, isRest: true as const };
    }

    const parsedPitch = parsePitch(token.pitch) ?? { letter: "B", accidental: null, octave: 4 };
    const step =
      diatonicStep(parsedPitch.letter, parsedPitch.octave) - diatonicStep(bottomLine.letter, bottomLine.octave);
    const noteY = stepToY(step);
    const hasStem = token.type !== "whole";
    const filledHead = token.type !== "whole" && token.type !== "half";
    const flagCount = token.type === "eighth" ? 1 : token.type === "sixteenth" ? 2 : 0;
    const stemUp = step <= 4;
    const stemX = stemUp ? x + HEAD_RX * 0.85 : x - HEAD_RX * 0.85;
    const stemEndY = stemUp ? noteY - STEM_LENGTH : noteY + STEM_LENGTH;
    const dir: 1 | -1 = stemUp ? 1 : -1;
    const ledgers = ledgerSteps(step);

    return {
      token,
      x,
      isRest: false as const,
      parsedPitch,
      step,
      noteY,
      hasStem,
      filledHead,
      flagCount,
      stemUp,
      stemX,
      stemEndY,
      dir,
      ledgers,
    };
  });

  const staffRightX = firstNoteX + Math.max(0, tokens.length - 1) * NOTE_SPACING + RIGHT_MARGIN;

  // Same reasoning as NoteGlyph's dynamic viewBox: a fixed canvas clips high/
  // low notes once ledger lines or stems push past the usual staff margins,
  // so size it to whatever this specific sequence actually needs.
  const topCandidates = [STAFF_TOP_Y];
  const bottomCandidates = [STAFF_BOTTOM_Y + 40];

  for (const note of notes) {
    if (note.isRest) continue;
    topCandidates.push(note.noteY - HEAD_RY);
    bottomCandidates.push(note.noteY + HEAD_RY);
    note.ledgers.forEach((s) => {
      const y = stepToY(s);
      topCandidates.push(y);
      bottomCandidates.push(y);
    });
    if (note.hasStem) {
      topCandidates.push(note.stemEndY);
      bottomCandidates.push(note.stemEndY);
      if (note.flagCount > 0) {
        const flagExtent = note.stemEndY + note.dir * (14 * (note.flagCount - 1) + 28);
        topCandidates.push(flagExtent);
        bottomCandidates.push(flagExtent);
      }
    }
  }

  const viewTop = Math.min(...topCandidates) - CANVAS_MARGIN;
  const viewBottom = Math.max(...bottomCandidates) + CANVAS_MARGIN;
  const contentHeight = viewBottom - viewTop;
  const viewWidth = staffRightX + 20;

  if (!fontsLoaded) return null;

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

      {notes.map((note, index) => {
        if (note.isRest) {
          return (
            <SvgText
              key={index}
              x={note.x}
              y={STAFF_TOP_Y + REST_TARGET_LINE[note.token.type] * STAFF_LINE_SPACING}
              fontFamily={SMUFL_FONT_FAMILY}
              fontSize={SMUFL_FONT_SIZE}
              fill={color}
              textAnchor="middle"
              alignmentBaseline="central"
            >
              {REST_GLYPH[note.token.type]}
            </SvgText>
          );
        }

        return (
          <React.Fragment key={index}>
            {note.ledgers.map((s) => (
              <Line
                key={s}
                x1={note.x - HEAD_RX - 4}
                y1={stepToY(s)}
                x2={note.x + HEAD_RX + 4}
                y2={stepToY(s)}
                stroke={color}
                strokeWidth={1.5}
              />
            ))}

            {note.parsedPitch.accidental && (
              <SvgText
                x={note.x - HEAD_RX - 12}
                y={note.noteY + 5}
                fontSize={16}
                fill={color}
                textAnchor="middle"
              >
                {note.parsedPitch.accidental === "#" ? "♯" : "♭"}
              </SvgText>
            )}

            {note.hasStem && (
              <Line
                x1={note.stemX}
                y1={note.noteY}
                x2={note.stemX}
                y2={note.stemEndY}
                stroke={color}
                strokeWidth={2.2}
              />
            )}

            {Array.from({ length: note.flagCount }).map((_, i) => (
              <Flag key={i} stemX={note.stemX} stemEndY={note.stemEndY} dir={note.dir} color={color} index={i} />
            ))}

            <Ellipse
              cx={note.x}
              cy={note.noteY}
              rx={HEAD_RX}
              ry={HEAD_RY}
              rotation={HEAD_ROTATION}
              origin={`${note.x}, ${note.noteY}`}
              fill={note.filledHead ? color : "none"}
              stroke={color}
              strokeWidth={note.filledHead ? 0 : 2}
            />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
