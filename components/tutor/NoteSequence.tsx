import { useFonts } from "expo-font";
import React from "react";
import Svg, { Ellipse, Line, Path, Text as SvgText } from "react-native-svg";
import {
  CANVAS_MARGIN,
  CLEF_BOTTOM_LINE,
  CLEF_GLYPH,
  CLEF_TARGET_LINE,
  type ClefType,
  computePrefixWidth,
  diatonicStep,
  Flag,
  HALF_SPACING,
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
import {
  ARTIC_GLYPH_ABOVE,
  ARTIC_GLYPH_BELOW,
  type ArticulationType,
  DYNAMIC_GLYPH,
  type DynamicType,
} from "./NoteGlyph";

// A short, single-voice, single-clef row of notes/rests (a scale, a simple
// phrase) - deliberately NOT a general engraver: no chords (one pitch per
// token), no beaming (every eighth/sixteenth keeps its own flag), no slurs,
// no per-note ornaments. Each of those is a real feature with its own layout
// problems; this only covers "play/show me a short line of notes" plus
// per-note artic/dynamic marks, ties, and triplets, which is most of what a
// theory tutor actually needs to demonstrate. Key/time signature ARE
// supported (they apply once to the whole sequence, not per-note, so they
// don't have that per-note complexity).

export type SequenceToken =
  | {
      rest: false;
      type: NoteValueType;
      pitch: string;
      dotted?: boolean;
      artic?: ArticulationType;
      dynamic?: DynamicType;
      // Tied to the NEXT token (which tutorContent.ts's parser guarantees
      // exists, is non-rest, and shares this token's exact pitch).
      tied?: boolean;
      // Part of a group of exactly 3 consecutive same-duration tokens played
      // in the time of 2 (tutorContent.ts validates the run shape).
      triplet?: boolean;
    }
  | { rest: true; type: NoteValueType; dotted?: boolean; triplet?: boolean };

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
      const dotY = STAFF_TOP_Y + REST_TARGET_LINE[token.type] * STAFF_LINE_SPACING;
      return { token, x, isRest: true as const, dotX: x + 8, dotY };
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
    // Same on-line nudge as NoteGlyph's single-note dot: a note sitting on a
    // staff line (even step) needs its dot pushed into the space above it.
    const dotY = noteY - (step % 2 === 0 ? HALF_SPACING : 0);

    // Same placement rules as NoteGlyph: articulation sits opposite the stem,
    // in whatever space is clear of the stem/flag; dynamics always sit below
    // the staff regardless of stem direction.
    const articGlyph = token.artic
      ? stemUp
        ? ARTIC_GLYPH_BELOW[token.artic]
        : ARTIC_GLYPH_ABOVE[token.artic]
      : null;
    const articY = stemUp ? noteY + HEAD_RY + STAFF_LINE_SPACING : noteY - HEAD_RY - STAFF_LINE_SPACING;
    const dynamicY = STAFF_BOTTOM_Y + STAFF_LINE_SPACING + 6;

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
      dotX: x + HEAD_RX + 8,
      dotY,
      articGlyph,
      articY,
      dynamicY,
    };
  });

  const staffRightX = firstNoteX + Math.max(0, tokens.length - 1) * NOTE_SPACING + RIGHT_MARGIN;

  // A tie curves from one notehead to the next (same pitch, guaranteed by
  // tutorContent.ts's parser), bulging away from the stem side - the same
  // "opposite the stem" convention NoteGlyph uses for articulation.
  const tieArcs = notes.flatMap((note, index) => {
    if (note.isRest || !note.token.tied) return [];
    const next = notes[index + 1];
    if (!next || next.isRest) return []; // parser guarantees this never happens
    const bulge = note.stemUp ? 1 : -1;
    return [
      {
        x1: note.x + HEAD_RX,
        x2: next.x - HEAD_RX,
        y: note.noteY + bulge * 3,
        controlY: note.noteY + bulge * 12,
      },
    ];
  });

  // A triplet bracket spans the 3 grouped notes on the stem-tip side (unlike
  // ties/articulation, a tuplet number conventionally sits WITH the stems,
  // not opposite them) - tutorContent.ts's parser guarantees triplet-flagged
  // tokens only ever appear in complete, contiguous runs of exactly 3.
  const tripletGroups: { x1: number; x2: number; bracketY: number; numeralY: number }[] = [];
  for (let i = 0; i < notes.length; ) {
    if (!notes[i].token.triplet) {
      i++;
      continue;
    }
    const group = [notes[i], notes[i + 1], notes[i + 2]];
    let groupStemUp = true;
    for (const n of group) {
      if (!n.isRest) {
        groupStemUp = n.stemUp;
        break;
      }
    }
    const extentYs = group.map((n) => (n.isRest ? n.dotY : n.stemEndY));
    const bracketY = groupStemUp ? Math.min(...extentYs) - 10 : Math.max(...extentYs) + 10;
    const numeralY = groupStemUp ? bracketY - 10 : bracketY + 14;
    tripletGroups.push({ x1: group[0].x, x2: group[2].x, bracketY, numeralY });
    i += 3;
  }

  // Same reasoning as NoteGlyph's dynamic viewBox: a fixed canvas clips high/
  // low notes once ledger lines or stems push past the usual staff margins,
  // so size it to whatever this specific sequence actually needs.
  const topCandidates = [STAFF_TOP_Y];
  const bottomCandidates = [STAFF_BOTTOM_Y + 40];

  tieArcs.forEach((arc) => {
    topCandidates.push(Math.min(arc.y, arc.controlY));
    bottomCandidates.push(Math.max(arc.y, arc.controlY));
  });
  tripletGroups.forEach((g) => {
    topCandidates.push(Math.min(g.bracketY, g.numeralY) - 8);
    bottomCandidates.push(Math.max(g.bracketY, g.numeralY) + 8);
  });

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
    if (note.articGlyph) {
      topCandidates.push(note.articY - STAFF_LINE_SPACING / 2);
      bottomCandidates.push(note.articY + STAFF_LINE_SPACING / 2);
    }
    if (note.token.dynamic) {
      bottomCandidates.push(note.dynamicY + STAFF_LINE_SPACING / 2);
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
            <React.Fragment key={index}>
              <SvgText
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
              {note.token.dotted && <Ellipse cx={note.dotX} cy={note.dotY} rx={2} ry={2} fill={color} />}
            </React.Fragment>
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

            {note.token.dotted && <Ellipse cx={note.dotX} cy={note.dotY} rx={2} ry={2} fill={color} />}

            {note.articGlyph && (
              <SvgText
                x={note.x}
                y={note.articY}
                fontFamily={SMUFL_FONT_FAMILY}
                fontSize={SMUFL_FONT_SIZE}
                fill={color}
                textAnchor="middle"
                alignmentBaseline="central"
              >
                {note.articGlyph}
              </SvgText>
            )}

            {note.token.dynamic && (
              <SvgText
                x={note.x}
                y={note.dynamicY}
                fontFamily={SMUFL_FONT_FAMILY}
                fontSize={SMUFL_FONT_SIZE}
                fill={color}
                textAnchor="middle"
                alignmentBaseline="central"
              >
                {DYNAMIC_GLYPH[note.token.dynamic]}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}

      {tieArcs.map((arc, index) => (
        <Path
          key={`tie-${index}`}
          d={`M ${arc.x1},${arc.y} Q ${(arc.x1 + arc.x2) / 2},${arc.controlY} ${arc.x2},${arc.y}`}
          stroke={color}
          strokeWidth={1.5}
          fill="none"
        />
      ))}

      {tripletGroups.map((group, index) => (
        <React.Fragment key={`triplet-${index}`}>
          <Line
            x1={group.x1}
            y1={group.bracketY}
            x2={group.x2}
            y2={group.bracketY}
            stroke={color}
            strokeWidth={1.2}
          />
          <Line
            x1={group.x1}
            y1={group.bracketY}
            x2={group.x1}
            y2={group.bracketY + (group.numeralY < group.bracketY ? 6 : -6)}
            stroke={color}
            strokeWidth={1.2}
          />
          <Line
            x1={group.x2}
            y1={group.bracketY}
            x2={group.x2}
            y2={group.bracketY + (group.numeralY < group.bracketY ? 6 : -6)}
            stroke={color}
            strokeWidth={1.2}
          />
          <SvgText
            x={(group.x1 + group.x2) / 2}
            y={group.numeralY}
            fontSize={12}
            fontWeight="700"
            fill={color}
            textAnchor="middle"
            alignmentBaseline="central"
          >
            3
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}
