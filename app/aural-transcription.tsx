import {
  useGenerateAuralExerciseMutation,
  useGetTranscriptionUnlockStatusQuery,
  useSubmitAuralAttemptMutation,
  type NoteEvent,
  type SubmittedNote,
  type TranscriptionExercise,
  type TranscriptionScoreDetails,
} from "@/store/services/auralTrainingAPI";
import { useGetCurriculumQuery } from "@/store/services/curriculumAPI";
import { useSubmitFeedbackMutation } from "@/store/services/feedbackAPI";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Delete,
  Lock,
  Music,
  Star,
  Trash2,
  Volume2,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PITCH_CLASSES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

// Rhythm isn't scored (see AuralModuleController::noteMismatchCost - pitch/
// octave only), so every submitted note just uses a fixed placeholder
// duration. The backend's validation still requires the field to be present.
const SUBMITTED_NOTE_DURATION_BEATS = 1.0;

// Metro requires static require() paths - generated via scripts/generate-tones.js.
// Covers octaves 3-5 since the backend's stepwise-melody generator can land
// anywhere in that range depending on key + scale degree.
const SEQUENCE_TONE_ASSETS: Record<string, number> = {
  C3: require("../assets/tones/sequence/C3.wav"),
  "C#3": require("../assets/tones/sequence/Cs3.wav"),
  D3: require("../assets/tones/sequence/D3.wav"),
  "D#3": require("../assets/tones/sequence/Ds3.wav"),
  E3: require("../assets/tones/sequence/E3.wav"),
  F3: require("../assets/tones/sequence/F3.wav"),
  "F#3": require("../assets/tones/sequence/Fs3.wav"),
  G3: require("../assets/tones/sequence/G3.wav"),
  "G#3": require("../assets/tones/sequence/Gs3.wav"),
  A3: require("../assets/tones/sequence/A3.wav"),
  "A#3": require("../assets/tones/sequence/As3.wav"),
  B3: require("../assets/tones/sequence/B3.wav"),
  C4: require("../assets/tones/sequence/C4.wav"),
  "C#4": require("../assets/tones/sequence/Cs4.wav"),
  D4: require("../assets/tones/sequence/D4.wav"),
  "D#4": require("../assets/tones/sequence/Ds4.wav"),
  E4: require("../assets/tones/sequence/E4.wav"),
  F4: require("../assets/tones/sequence/F4.wav"),
  "F#4": require("../assets/tones/sequence/Fs4.wav"),
  G4: require("../assets/tones/sequence/G4.wav"),
  "G#4": require("../assets/tones/sequence/Gs4.wav"),
  A4: require("../assets/tones/sequence/A4.wav"),
  "A#4": require("../assets/tones/sequence/As4.wav"),
  B4: require("../assets/tones/sequence/B4.wav"),
  C5: require("../assets/tones/sequence/C5.wav"),
  "C#5": require("../assets/tones/sequence/Cs5.wav"),
  D5: require("../assets/tones/sequence/D5.wav"),
  "D#5": require("../assets/tones/sequence/Ds5.wav"),
  E5: require("../assets/tones/sequence/E5.wav"),
  F5: require("../assets/tones/sequence/F5.wav"),
  "F#5": require("../assets/tones/sequence/Fs5.wav"),
  G5: require("../assets/tones/sequence/G5.wav"),
  "G#5": require("../assets/tones/sequence/Gs5.wav"),
  A5: require("../assets/tones/sequence/A5.wav"),
  "A#5": require("../assets/tones/sequence/As5.wav"),
  B5: require("../assets/tones/sequence/B5.wav"),
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatSequence(notes: { note_name: string; octave: number }[]): string {
  return notes.map((n) => `${n.note_name}${n.octave}`).join(" · ");
}

// Friendlier stand-in for the raw "cents" unit - 0 cents (perfect) -> 100%,
// 100+ cents off -> 0%. Purely a display transform; the backend's actual
// threshold comparison still runs on raw cents.
function centsToConsistencyPercent(cents: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - cents)));
}

export default function AuralTranscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: grades } = useGetCurriculumQuery();
  const gradeOneId = grades?.find((g) => g.level_number === 1)?.id;

  const {
    data: unlockStatus,
    isLoading: isCheckingUnlock,
  } = useGetTranscriptionUnlockStatusQuery();
  const [generateExercise, { isLoading: isGenerating }] =
    useGenerateAuralExerciseMutation();
  const [submitAttempt, { isLoading: isSubmittingAttempt }] =
    useSubmitAuralAttemptMutation();
  const [submitFeedback, { isLoading: isSubmittingFeedback }] =
    useSubmitFeedbackMutation();

  const [exercise, setExercise] = useState<TranscriptionExercise | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [builtSequence, setBuiltSequence] = useState<SubmittedNote[]>([]);
  const [selectedOctave, setSelectedOctave] = useState(4);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    attemptId: number | null;
    isCorrect: boolean;
    scoreDetails: TranscriptionScoreDetails;
    correctAnswer: NoteEvent[];
  } | null>(null);

  // Post-attempt qualitative feedback - same pattern as Free Practice, just
  // attached to this AuralModuleAttempt ("module_attempt") instead.
  const [selectedRating, setSelectedRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSubmitError, setFeedbackSubmitError] = useState<
    string | null
  >(null);

  const soundsRef = useRef<Audio.Sound[]>([]);

  useEffect(() => {
    return () => {
      soundsRef.current.forEach((sound) => sound.unloadAsync().catch(() => {}));
    };
  }, []);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/aural");
    }
  };

  const playSequence = async (notes: { note_name: string; octave: number; duration_beats: number }[]) => {
    setIsPlayingSequence(true);
    const beatMs = 60000 / 100; // fixed 100bpm playback tempo

    for (const note of notes) {
      const key = `${note.note_name}${note.octave}`;
      const asset = SEQUENCE_TONE_ASSETS[key];
      if (asset) {
        try {
          const { sound } = await Audio.Sound.createAsync(asset);
          soundsRef.current.push(sound);
          sound.playAsync();
        } catch {
          // Missing/failed tone asset - keep going rather than derail the round.
        }
      }
      await sleep(note.duration_beats * beatMs);
    }

    setIsPlayingSequence(false);
  };

  const handleStartExercise = async () => {
    if (!gradeOneId) return;

    setGenError(null);
    setResult(null);
    setBuiltSequence([]);

    try {
      const ex = (await generateExercise({
        moduleType: "transcription",
        gradeId: gradeOneId,
      }).unwrap()) as TranscriptionExercise;

      setExercise(ex);
      playSequence(ex.note_sequence);
    } catch (error: any) {
      setGenError(
        error?.data?.message ?? "Couldn't load an exercise. Try again.",
      );
    }
  };

  // Fire-and-forget preview so tapping through several notes in a row still
  // feels instant, unlike playSequence which deliberately waits between notes.
  const playNotePreview = (pitchClass: string, octave: number) => {
    const key = `${pitchClass}${octave}`;
    const asset = SEQUENCE_TONE_ASSETS[key];
    if (!asset) return;

    Audio.Sound.createAsync(asset)
      .then(({ sound }) => {
        soundsRef.current.push(sound);
        sound.playAsync();
      })
      .catch(() => {});
  };

  const handleAddNote = (pitchClass: string) => {
    playNotePreview(pitchClass, selectedOctave);
    setBuiltSequence((prev) => [
      ...prev,
      {
        note_name: pitchClass,
        octave: selectedOctave,
        duration_beats: SUBMITTED_NOTE_DURATION_BEATS,
      },
    ]);
  };

  const handleUndo = () => {
    setBuiltSequence((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setBuiltSequence([]);
  };

  const handleSubmitSequence = async () => {
    if (!exercise || builtSequence.length === 0) return;

    setSubmitError(null);
    try {
      const res = await submitAttempt({
        exerciseId: exercise.exercise_id,
        body: { note_sequence: builtSequence },
      }).unwrap();

      setResult({
        attemptId: res.attempt_id ?? null,
        isCorrect: !!res.is_correct,
        scoreDetails: res.score_details as unknown as TranscriptionScoreDetails,
        correctAnswer: (res.correct_answer as unknown as NoteEvent[]) ?? [],
      });
    } catch (error: any) {
      setSubmitError(
        error?.data?.message ?? "Couldn't submit that. Try again.",
      );
    }
  };

  const handleTryAnother = () => {
    setExercise(null);
    setResult(null);
    setBuiltSequence([]);
    setSelectedRating(0);
    setFeedbackComment("");
    setFeedbackSubmitted(false);
    setFeedbackSubmitError(null);
    handleStartExercise();
  };

  const handleSubmitFeedback = async () => {
    if (!result?.attemptId || selectedRating === 0) return;

    setFeedbackSubmitError(null);
    try {
      await submitFeedback({
        feedbackable_type: "module_attempt",
        feedbackable_id: result.attemptId,
        rating: selectedRating,
        comment: feedbackComment.trim() || undefined,
      }).unwrap();
      setFeedbackSubmitted(true);
    } catch {
      setFeedbackSubmitError("Couldn't submit feedback. Try again.");
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={handleBack}
          style={styles.breadcrumb}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={15} color={colors.textSecondary} />
          <Text style={styles.breadcrumbText}>Aural Training</Text>
        </Pressable>

        <Text style={styles.eyebrow}>TRANSCRIPTION</Text>
        <Text style={styles.heading}>Write What You Hear</Text>
        <Text style={styles.subheading}>
          Listen to a short pattern, then notate it note by note.
        </Text>

        {isCheckingUnlock ? (
          <View style={styles.card}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : !unlockStatus?.unlocked ? (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Lock size={16} color={colors.textPrimary} />
              <Text style={styles.cardTitle}>Not unlocked yet</Text>
            </View>
            <Text style={styles.bodyText}>
              Keep practicing in Free Practice to build your audiation skill
              before Transcription unlocks.
            </Text>

            {unlockStatus?.current_avg_cents !== null &&
            unlockStatus?.current_avg_cents !== undefined &&
            unlockStatus?.threshold_cents !== null &&
            unlockStatus?.threshold_cents !== undefined ? (
              (() => {
                const currentPercent = centsToConsistencyPercent(
                  unlockStatus.current_avg_cents,
                );
                const goalPercent = centsToConsistencyPercent(
                  unlockStatus.threshold_cents,
                );
                return (
                  <>
                    <View style={styles.unlockProgressTrack}>
                      <View
                        style={[
                          styles.unlockProgressFill,
                          { width: `${currentPercent}%` },
                        ]}
                      />
                      <View
                        style={[
                          styles.unlockGoalMarker,
                          { left: `${goalPercent}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      You&apos;re {currentPercent}% consistent - reach{" "}
                      {goalPercent}% to unlock
                    </Text>
                  </>
                );
              })()
            ) : (
              <Text style={styles.progressText}>
                No practice attempts yet - head to Free Practice to get started.
              </Text>
            )}

            {unlockStatus?.attempts_so_far !== null &&
            unlockStatus?.attempts_so_far !== undefined ? (
              <Text style={styles.progressText}>
                {unlockStatus.attempts_so_far} attempt
                {unlockStatus.attempts_so_far === 1 ? "" : "s"} counted so far
              </Text>
            ) : null}
          </View>
        ) : !exercise ? (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Music size={16} color={colors.textPrimary} />
              <Text style={styles.cardTitle}>Ready when you are</Text>
            </View>
            <Text style={styles.bodyText}>
              You&apos;ll hear a short 4-6 note pattern once. Notate it using
              the note buttons, then submit.
            </Text>
            {genError ? (
              <Text style={styles.formMessageError}>{genError}</Text>
            ) : null}
            <Pressable
              onPress={handleStartExercise}
              disabled={isGenerating || !gradeOneId}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.saveButtonPressed,
                (isGenerating || !gradeOneId) && styles.saveButtonDisabled,
              ]}
            >
              {isGenerating ? (
                <ActivityIndicator color={colors.onInk} />
              ) : (
                <Text style={styles.saveButtonText}>Start exercise</Text>
              )}
            </Pressable>
          </View>
        ) : !result ? (
          <>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Music size={16} color={colors.textPrimary} />
                <Text style={styles.cardTitle}>The pattern</Text>
              </View>
              <Pressable
                onPress={() => playSequence(exercise.note_sequence)}
                disabled={isPlayingSequence}
                style={({ pressed }) => [
                  styles.replayButton,
                  pressed && styles.recordButtonPressed,
                ]}
              >
                <Volume2 size={16} color={colors.ink} />
                <Text style={styles.replayButtonText}>
                  {isPlayingSequence ? "Playing…" : "Hear it again"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>Your notation</Text>
              </View>

              <View style={styles.sequenceChipsRow}>
                {builtSequence.length === 0 ? (
                  <Text style={styles.placeholderText}>
                    Tap notes below to build your sequence
                  </Text>
                ) : (
                  builtSequence.map((note, index) => (
                    <View key={index} style={styles.sequenceChip}>
                      <Text style={styles.sequenceChipText}>
                        {note.note_name}
                        {note.octave}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              <Pressable
                onPress={() => playSequence(builtSequence)}
                disabled={builtSequence.length === 0 || isPlayingSequence}
                style={({ pressed }) => [
                  styles.replayButton,
                  pressed && styles.recordButtonPressed,
                  (builtSequence.length === 0 || isPlayingSequence) &&
                    styles.saveButtonDisabled,
                ]}
              >
                <Volume2 size={16} color={colors.ink} />
                <Text style={styles.replayButtonText}>
                  {isPlayingSequence ? "Playing…" : "Play my notation"}
                </Text>
              </Pressable>

              <View style={styles.builderControlsRow}>
                <Text style={styles.controlLabel}>Octave</Text>
                {[3, 4, 5].map((octave) => (
                  <Pressable
                    key={octave}
                    onPress={() => setSelectedOctave(octave)}
                    style={[
                      styles.smallToggle,
                      selectedOctave === octave && styles.smallToggleActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.smallToggleText,
                        selectedOctave === octave && styles.smallToggleTextActive,
                      ]}
                    >
                      {octave}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.noteGrid}>
                {PITCH_CLASSES.map((pitchClass) => (
                  <Pressable
                    key={pitchClass}
                    onPress={() => handleAddNote(pitchClass)}
                    style={styles.noteChip}
                  >
                    <Text style={styles.noteChipText}>{pitchClass}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.builderControlsRow}>
                <Pressable
                  onPress={handleUndo}
                  disabled={builtSequence.length === 0}
                  style={({ pressed }) => [
                    styles.utilityButton,
                    pressed && styles.recordButtonPressed,
                  ]}
                >
                  <Delete size={14} color={colors.textSecondary} />
                  <Text style={styles.utilityButtonText}>Undo</Text>
                </Pressable>
                <Pressable
                  onPress={handleClear}
                  disabled={builtSequence.length === 0}
                  style={({ pressed }) => [
                    styles.utilityButton,
                    pressed && styles.recordButtonPressed,
                  ]}
                >
                  <Trash2 size={14} color={colors.textSecondary} />
                  <Text style={styles.utilityButtonText}>Clear</Text>
                </Pressable>
              </View>

              {submitError ? (
                <Text style={styles.formMessageError}>{submitError}</Text>
              ) : null}

              <Pressable
                onPress={handleSubmitSequence}
                disabled={isSubmittingAttempt || builtSequence.length === 0}
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.saveButtonPressed,
                  (isSubmittingAttempt || builtSequence.length === 0) &&
                    styles.saveButtonDisabled,
                ]}
              >
                {isSubmittingAttempt ? (
                  <ActivityIndicator color={colors.onInk} />
                ) : (
                  <Text style={styles.saveButtonText}>Submit</Text>
                )}
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.resultEmoji}>
              {result.isCorrect ? "🎯" : "🎵"}
            </Text>
            <Text style={styles.resultTitle}>
              {result.isCorrect ? "Correct!" : "Not quite"}
            </Text>
            <Text style={styles.bodyText}>
              You matched {result.scoreDetails.correctness_pct}% of the
              pattern.
            </Text>
            <Text style={styles.progressText}>
              You wrote: {formatSequence(builtSequence)}
            </Text>
            <Text style={styles.progressText}>
              Correct pattern: {formatSequence(result.correctAnswer)}
            </Text>

            <View style={styles.feedbackDivider} />

            {feedbackSubmitted ? (
              <Text style={styles.feedbackThanksText}>
                Thanks for the feedback!
              </Text>
            ) : (
              <View style={styles.feedbackSection}>
                <Text style={styles.feedbackPrompt}>
                  How was this exercise?
                </Text>

                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => setSelectedRating(value)}
                      accessibilityRole="button"
                      accessibilityLabel={`Rate ${value} out of 5`}
                      hitSlop={6}
                    >
                      <Star
                        size={26}
                        color={colors.gold}
                        fill={value <= selectedRating ? colors.gold : "transparent"}
                      />
                    </Pressable>
                  ))}
                </View>

                {selectedRating > 0 ? (
                  <>
                    <TextInput
                      value={feedbackComment}
                      onChangeText={setFeedbackComment}
                      placeholder="Anything else? (optional)"
                      placeholderTextColor={colors.textMuted}
                      style={styles.feedbackInput}
                      multiline
                    />

                    {feedbackSubmitError ? (
                      <Text style={styles.formMessageError}>
                        {feedbackSubmitError}
                      </Text>
                    ) : null}

                    <Pressable
                      onPress={handleSubmitFeedback}
                      disabled={isSubmittingFeedback}
                      style={({ pressed }) => [
                        styles.feedbackSubmitButton,
                        pressed && styles.recordButtonPressed,
                        isSubmittingFeedback && styles.saveButtonDisabled,
                      ]}
                    >
                      {isSubmittingFeedback ? (
                        <ActivityIndicator color={colors.ink} />
                      ) : (
                        <Text style={styles.feedbackSubmitButtonText}>
                          Submit feedback
                        </Text>
                      )}
                    </Pressable>
                  </>
                ) : null}
              </View>
            )}

            <Pressable
              onPress={handleTryAnother}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.saveButtonPressed,
              ]}
            >
              <Text style={styles.saveButtonText}>Try another</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 60,
    },
    breadcrumb: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 14,
      marginBottom: 18,
    },
    breadcrumbText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1.2,
      color: colors.gold,
    },
    heading: {
      fontFamily: "Georgia",
      fontSize: 30,
      fontWeight: "700",
      color: colors.textPrimary,
      marginTop: 4,
    },
    subheading: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
      marginBottom: 18,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginBottom: 16,
    },
    cardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    cardTitle: {
      fontFamily: "Georgia",
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    bodyText: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.textPrimary,
      marginBottom: 12,
    },
    progressText: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    unlockProgressTrack: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "visible",
      marginBottom: 10,
      marginTop: 4,
    },
    unlockProgressFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.gold,
    },
    unlockGoalMarker: {
      position: "absolute",
      top: -4,
      width: 3,
      height: 18,
      borderRadius: 2,
      backgroundColor: colors.textPrimary,
      marginLeft: -1,
    },
    formMessageError: {
      fontSize: 13,
      color: colors.danger,
      marginBottom: 12,
    },
    replayButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      marginBottom: 16,
    },
    replayButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.ink,
    },
    recordButtonPressed: {
      opacity: 0.9,
    },
    sequenceChipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      minHeight: 40,
      marginBottom: 16,
    },
    placeholderText: {
      fontSize: 13,
      color: colors.textMuted,
      fontStyle: "italic",
    },
    sequenceChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.ink,
    },
    sequenceChipText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.onInk,
    },
    builderControlsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
    },
    controlLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
      marginRight: 4,
      width: 70,
    },
    smallToggle: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    smallToggleActive: {
      backgroundColor: colors.ink,
      borderColor: colors.ink,
    },
    smallToggleText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    smallToggleTextActive: {
      color: colors.onInk,
    },
    noteGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    noteChip: {
      minWidth: 48,
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    noteChipText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    utilityButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    utilityButtonText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    saveButton: {
      borderRadius: 8,
      backgroundColor: colors.ink,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 4,
    },
    saveButtonPressed: {
      opacity: 0.9,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.onInk,
      fontSize: 16,
      fontWeight: "700",
    },
    resultEmoji: {
      fontSize: 40,
      textAlign: "center",
      marginBottom: 4,
    },
    resultTitle: {
      fontFamily: "Georgia",
      fontSize: 22,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: 16,
    },
    feedbackDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 16,
    },
    feedbackSection: {
      marginBottom: 16,
    },
    feedbackPrompt: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: 10,
    },
    starRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
      marginBottom: 4,
    },
    feedbackInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.textPrimary,
      fontSize: 14,
      minHeight: 60,
      textAlignVertical: "top",
      marginTop: 14,
      marginBottom: 10,
    },
    feedbackSubmitButton: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      paddingVertical: 12,
      alignItems: "center",
    },
    feedbackSubmitButtonText: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: "700",
    },
    feedbackThanksText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.success,
      textAlign: "center",
      marginBottom: 16,
    },
  });
