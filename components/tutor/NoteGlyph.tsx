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
  DEFAULT_PITCH,
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

export type { ClefType, NoteValueType };
export { DEFAULT_PITCH };

export type ArticulationType = "staccato" | "accent" | "tenuto";
export type DynamicType = "pp" | "p" | "mp" | "mf" | "f" | "ff";
export type OrnamentType = "fermata";

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

export const ARTICULATION_LABELS: Record<ArticulationType, string> = {
  staccato: "staccato",
  accent: "accent",
  tenuto: "tenuto",
};

export const DYNAMIC_LABELS: Record<DynamicType, string> = {
  pp: "pianissimo (very quiet)",
  p: "piano (quiet)",
  mp: "mezzo-piano (moderately quiet)",
  mf: "mezzo-forte (moderately loud)",
  f: "forte (loud)",
  ff: "fortissimo (very loud)",
};

export const ORNAMENT_LABELS: Record<OrnamentType, string> = {
  fermata: "fermata (hold)",
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

// Articulation marks come in "Above"/"Below" variants shaped for which side
// of the notehead they sit on - rendering picks the side opposite the stem
// (standard engraving convention).
const ARTIC_GLYPH_ABOVE: Record<ArticulationType, string> = {
  staccato: "\u{E4A2}",
  accent: "\u{E4A0}",
  tenuto: "\u{E4A4}",
};
const ARTIC_GLYPH_BELOW: Record<ArticulationType, string> = {
  staccato: "\u{E4A3}",
  accent: "\u{E4A1}",
  tenuto: "\u{E4A5}",
};

// SMuFL has no single precomposed glyph for "mf"/"pp"/etc - dynamics are
// built by placing individual letterform glyphs adjacent in one text run,
// and the font typesets/kerns them correctly on its own.
const DYNAMIC_LETTER = {
  p: "\u{E520}", // dynamicPiano
  m: "\u{E521}", // dynamicMezzo
  f: "\u{E522}", // dynamicForte
};
const DYNAMIC_GLYPH: Record<DynamicType, string> = {
  pp: DYNAMIC_LETTER.p + DYNAMIC_LETTER.p,
  p: DYNAMIC_LETTER.p,
  mp: DYNAMIC_LETTER.m + DYNAMIC_LETTER.p,
  mf: DYNAMIC_LETTER.m + DYNAMIC_LETTER.f,
  f: DYNAMIC_LETTER.f,
  ff: DYNAMIC_LETTER.f + DYNAMIC_LETTER.f,
};

// Only the "Above" fermata is used - always rendered above the whole note
// (notehead + stem + flag), never tied to stem side the way articulation is.
const ORNAMENT_GLYPH: Record<OrnamentType, string> = {
  fermata: "\u{E4C0}", // fermataAbove
};

const STAFF_RIGHT_X_BASE = 150;
const NOTE_X_BASE = 118;

// Vertical clearance (in px) between the notehead/note construct and an
// articulation, dynamic, or ornament mark placed next to it.
const MARK_OFFSET = STAFF_LINE_SPACING;

type Props = {
  type: NoteValueType;
  pitch?: string;
  clef?: ClefType;
  rest?: boolean;
  artic?: ArticulationType;
  dynamic?: DynamicType;
  ornament?: OrnamentType;
  keySignature?: number;
  timeSignature?: TimeSignatureValue;
  color?: string;
  width?: number;
};

export default function NoteGlyph({
  type,
  pitch,
  clef = "treble",
  rest = false,
  artic,
  dynamic,
  ornament,
  keySignature = 0,
  timeSignature,
  color = "#1F2937",
  width = 170,
}: Props) {
  const [fontsLoaded] = useFonts({ [SMUFL_FONT_FAMILY]: require("@/assets/fonts/Bravura.otf") });

  const prefixWidth = computePrefixWidth(keySignature, !!timeSignature);
  const noteX = NOTE_X_BASE + prefixWidth;
  const staffRightX = STAFF_RIGHT_X_BASE + prefixWidth;

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
  const stemX = stemUp ? noteX + HEAD_RX * 0.85 : noteX - HEAD_RX * 0.85;
  const stemEndY = stemUp ? noteY - STEM_LENGTH : noteY + STEM_LENGTH;
  const dir: 1 | -1 = stemUp ? 1 : -1;
  const ledgers = rest ? [] : ledgerSteps(step);

  // Articulation sits on the side opposite the stem, in whatever space is
  // clear of the stem/flag.
  const articGlyph = !rest && artic ? (stemUp ? ARTIC_GLYPH_BELOW[artic] : ARTIC_GLYPH_ABOVE[artic]) : null;
  const articY = stemUp ? noteY + HEAD_RY + MARK_OFFSET : noteY - HEAD_RY - MARK_OFFSET;

  // Fermata always sits above the whole note construct (notehead, and the
  // stem/flag too when the stem points up), not tied to stem side.
  const glyphTopY = hasStem && stemUp ? stemEndY - (flagCount > 0 ? 16 : 0) : noteY;
  const fermataY = glyphTopY - HEAD_RY - MARK_OFFSET;

  const showDynamic = !rest && !!dynamic;
  const dynamicY = STAFF_BOTTOM_Y + STAFF_LINE_SPACING + 6;

  // The canvas used to be a fixed height tuned for a note sitting near the
  // staff - fine until a high/low pitch (needing ledger lines already close
  // to the top/bottom edge) combined with a mark pushed further out than the
  // note itself, which got clipped. Instead, size the viewBox to whatever
  // this particular glyph actually needs, with STAFF_TOP_Y/STAFF_BOTTOM_Y+40
  // (the original margins) as a floor so the common case doesn't shrink.
  const topCandidates = [STAFF_TOP_Y, noteY - HEAD_RY];
  const bottomCandidates = [STAFF_BOTTOM_Y + 40, noteY + HEAD_RY];

  if (!rest) {
    ledgers.forEach((s) => {
      const y = stepToY(s);
      topCandidates.push(y);
      bottomCandidates.push(y);
    });
    if (hasStem) {
      topCandidates.push(stemEndY);
      bottomCandidates.push(stemEndY);
      if (flagCount > 0) {
        const flagExtent = stemEndY + dir * (14 * (flagCount - 1) + 28);
        topCandidates.push(flagExtent);
        bottomCandidates.push(flagExtent);
      }
    }
    if (articGlyph) {
      topCandidates.push(articY - MARK_OFFSET / 2);
      bottomCandidates.push(articY + MARK_OFFSET / 2);
    }
    if (ornament) {
      topCandidates.push(fermataY - MARK_OFFSET / 2);
      bottomCandidates.push(fermataY + MARK_OFFSET / 2);
    }
  }
  if (showDynamic) {
    bottomCandidates.push(dynamicY + MARK_OFFSET / 2);
  }

  const viewTop = Math.min(...topCandidates) - CANVAS_MARGIN;
  const viewBottom = Math.max(...bottomCandidates) + CANVAS_MARGIN;
  const contentHeight = viewBottom - viewTop;

  // Wait for the bundled font before rendering anything - a system-fallback
  // glyph flashing in first, then getting replaced, is worse than a brief blank.
  if (!fontsLoaded) return null;

  return (
    <Svg
      width={width}
      height={(width / (staffRightX + 20)) * contentHeight}
      viewBox={`0 ${viewTop} ${staffRightX + 20} ${contentHeight}`}
    >
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

      {rest ? (
        <SvgText
          x={noteX}
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
              x1={noteX - HEAD_RX - 4}
              y1={stepToY(s)}
              x2={noteX + HEAD_RX + 4}
              y2={stepToY(s)}
              stroke={color}
              strokeWidth={1.5}
            />
          ))}

          {parsedPitch?.accidental && (
            <SvgText
              x={noteX - HEAD_RX - 12}
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
            cx={noteX}
            cy={noteY}
            rx={HEAD_RX}
            ry={HEAD_RY}
            rotation={HEAD_ROTATION}
            origin={`${noteX}, ${noteY}`}
            fill={filledHead ? color : "none"}
            stroke={color}
            strokeWidth={filledHead ? 0 : 2}
          />

          {articGlyph && (
            <SvgText
              x={noteX}
              y={articY}
              fontFamily={SMUFL_FONT_FAMILY}
              fontSize={SMUFL_FONT_SIZE}
              fill={color}
              textAnchor="middle"
              alignmentBaseline="central"
            >
              {articGlyph}
            </SvgText>
          )}

          {ornament && (
            <SvgText
              x={noteX}
              y={fermataY}
              fontFamily={SMUFL_FONT_FAMILY}
              fontSize={SMUFL_FONT_SIZE}
              fill={color}
              textAnchor="middle"
              alignmentBaseline="central"
            >
              {ORNAMENT_GLYPH[ornament]}
            </SvgText>
          )}

          {showDynamic && (
            <SvgText
              x={noteX}
              y={dynamicY}
              fontFamily={SMUFL_FONT_FAMILY}
              fontSize={SMUFL_FONT_SIZE}
              fill={color}
              textAnchor="middle"
              alignmentBaseline="central"
            >
              {DYNAMIC_GLYPH[dynamic!]}
            </SvgText>
          )}
        </>
      )}
    </Svg>
  );
}
