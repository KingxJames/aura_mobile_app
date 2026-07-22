import { markAuralModuleCompleted } from "@/lib/auralModuleProgress";
import { playNoteSequence, scheduleClickTrack } from "@/lib/audioSynth";
import {
    useGenerateAuralExerciseMutation,
    useSubmitAuralAttemptMutation,
    type AuralAttemptResult,
    type AuralExercise,
    type AuralModuleType,
} from "@/store/services/auralTrainingAPI";
import type { ThemeColors } from "@/constants/Colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    ArrowLeft,
    Check,
    Mic,
    Play,
    Sparkles,
    Square,
    Trophy,
    X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import Animated, {
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Flat XP award per completed round - matches XP_PER_TOPIC in
// app/grade/[id].tsx so the whole path (theory + aural) feels consistent.
const AURAL_XP = 40;

// Each visit to a module is a round of this many exercises, mirroring
// MAX_QUESTIONS_PER_SESSION in app/quiz/[id].tsx, before the results screen.
const ROUND_LENGTH = 10;

// How long the correct/wrong feedback stays on screen before the next
// exercise in the round loads automatically.
const FEEDBACK_DURATION_MS = 1400;

// A little buffer after the last scheduled beat before we reveal the
// follow-up question, so the final click has time to actually ring out.
const POST_PLAYBACK_BUFFER_MS = 900;

type Phase =
  | "loading"
  | "intro"
  | "answering"
  | "feedback"
  | "results"
  | "error";

export default function AuralExerciseScreen() {
  const { moduleType, gradeId, moduleLabel } = useLocalSearchParams<{
    moduleType: AuralModuleType;
    gradeId: string;
    moduleLabel?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const contentInset = isTablet ? 32 : 16;
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [generateExercise] = useGenerateAuralExerciseMutation();
  const [submitAttempt, { isLoading: isSubmitting }] =
    useSubmitAuralAttemptMutation();

  const [exercise, setExercise] = useState<AuralExercise | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [result, setResult] = useState<AuralAttemptResult | null>(null);

  // Round-level counters - persist across exercises within a round, only
  // reset when a whole new round starts (mount, or "Try again").
  const [roundIndex, setRoundIndex] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [attemptedCount, setAttemptedCount] = useState(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [hasPlayedAltered, setHasPlayedAltered] = useState(false);
  const [tapTimestamps, setTapTimestamps] = useState<number[]>([]);
  const [selectedTimeSignature, setSelectedTimeSignature] = useState<
    string | null
  >(null);
  const [selectedPosition, setSelectedPosition] = useState<
    "beginning" | "end" | null
  >(null);
  const [selectedDynamic, setSelectedDynamic] = useState<string | null>(null);
  const [selectedArticulation, setSelectedArticulation] = useState<
    string | null
  >(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const tapStartRef = useRef<number | null>(null);
  const clickTrackRef = useRef<{ stop: () => void } | null>(null);
  const answerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const shake = useSharedValue(0);
  const pulse = useSharedValue(1);

  const resetInteractionState = () => {
    setIsPlaying(false);
    setHasPlayedOnce(false);
    setHasPlayedAltered(false);
    setTapTimestamps([]);
    setSelectedTimeSignature(null);
    setSelectedPosition(null);
    setSelectedDynamic(null);
    setSelectedArticulation(null);
    setIsRecording(false);
    setRecordingUri(null);
    setMicError(null);
    tapStartRef.current = null;
  };

  // Fetches one new exercise within the current round - does NOT touch the
  // round-level counters (roundIndex/correctCount/attemptedCount). The
  // previous exercise is deliberately left in place (not nulled) while the
  // next one loads, so the top bar/progress bar don't flash away between
  // every rep in the round - only the very first load shows the full-screen
  // spinner (see the `phase === "loading" && !exercise` check below).
  const loadNextExercise = useCallback(async () => {
    setPhase("loading");
    setResult(null);
    resetInteractionState();

    try {
      const ex = await generateExercise({ moduleType, gradeId }).unwrap();
      setExercise(ex);
      setPhase("intro");
    } catch {
      setPhase("error");
    }
  }, [generateExercise, moduleType, gradeId]);

  // Resets round-level counters, then loads exercise #1 - used on first
  // mount and whenever the learner chooses "Try again" from the results screen.
  const startRound = useCallback(() => {
    setRoundIndex(1);
    setCorrectCount(0);
    setAttemptedCount(0);
    loadNextExercise();
  }, [loadNextExercise]);

  useEffect(() => {
    startRound();
    return () => {
      clickTrackRef.current?.stop();
      if (answerTimeoutRef.current) clearTimeout(answerTimeoutRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
    // Only re-run when the route params identify a different module/grade to load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleType, gradeId]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));
  const roundProgressStyle = useAnimatedStyle(() => ({
    width: withTiming(`${(roundIndex / ROUND_LENGTH) * 100}%`, {
      duration: 350,
    }),
  }));

  const triggerShake = () => {
    shake.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 90 }),
      withTiming(-6, { duration: 90 }),
      withTiming(0, { duration: 70 }),
    );
  };

  const triggerPulse = () => {
    pulse.value = withSequence(
      withTiming(1.15, { duration: 90 }),
      withTiming(1, { duration: 140 }),
    );
  };

  // Advances to the next exercise in the round, or - once ROUND_LENGTH has
  // been reached - marks the module complete and shows the results screen.
  const advanceRound = () => {
    if (roundIndex >= ROUND_LENGTH) {
      markAuralModuleCompleted(gradeId, moduleType);
      setPhase("results");
    } else {
      setRoundIndex((prev) => prev + 1);
      loadNextExercise();
    }
  };

  const finishAttempt = async (body: Record<string, unknown> | FormData) => {
    if (!exercise) return;
    try {
      const res = await submitAttempt({
        exerciseId: exercise.exercise_id,
        body,
      }).unwrap();
      setResult(res);
      setAttemptedCount((prev) => prev + 1);
      if (res.is_correct === true) setCorrectCount((prev) => prev + 1);
      if (res.is_correct === false) triggerShake();
      setPhase("feedback");
      answerTimeoutRef.current = setTimeout(advanceRound, FEEDBACK_DURATION_MS);
    } catch {
      setResult({
        success: false,
        is_correct: null,
        message: "Couldn't submit that attempt. Try again in a moment.",
      });
      setPhase("feedback");
      answerTimeoutRef.current = setTimeout(advanceRound, FEEDBACK_DURATION_MS);
    }
  };

  // --- Pulse & Metre -------------------------------------------------------

  const handlePlayAndTap = () => {
    if (exercise?.module_type !== "pulse_metre" || isPlaying) return;
    setTapTimestamps([]);
    setIsPlaying(true);
    tapStartRef.current = Date.now();
    clickTrackRef.current = scheduleClickTrack(
      exercise.beat_timestamps_ms,
      exercise.beats_per_bar,
    );

    const lastBeat =
      exercise.beat_timestamps_ms[exercise.beat_timestamps_ms.length - 1] ?? 0;
    answerTimeoutRef.current = setTimeout(() => {
      setIsPlaying(false);
      setHasPlayedOnce(true);
      setPhase("answering");
    }, lastBeat + POST_PLAYBACK_BUFFER_MS);
  };

  const handleTap = () => {
    if (!isPlaying || tapStartRef.current === null) return;
    setTapTimestamps((prev) => [...prev, Date.now() - tapStartRef.current!]);
    triggerPulse();
  };

  const handleSelectTimeSignature = (option: string) => {
    if (selectedTimeSignature) return;
    setSelectedTimeSignature(option);
    finishAttempt({
      tap_timestamps_ms: tapTimestamps,
      selected_time_signature: option,
    });
  };

  // --- Spotting the Difference ----------------------------------------------

  const handlePlayOriginal = async () => {
    if (exercise?.module_type !== "spot_difference" || isPlaying) return;
    setIsPlaying(true);
    await playNoteSequence(exercise.original_sequence);
    setIsPlaying(false);
    setHasPlayedOnce(true);
  };

  const handlePlayAltered = async () => {
    if (exercise?.module_type !== "spot_difference" || isPlaying) return;
    setIsPlaying(true);
    await playNoteSequence(exercise.altered_sequence);
    setIsPlaying(false);
    setHasPlayedAltered(true);
    setPhase("answering");
  };

  const handleSelectPosition = (position: "beginning" | "end") => {
    if (selectedPosition) return;
    setSelectedPosition(position);
    finishAttempt({ selected_position: position });
  };

  // --- Musical Features ------------------------------------------------------

  const handlePlayFeatures = async () => {
    if (exercise?.module_type !== "musical_features" || isPlaying) return;
    setIsPlaying(true);
    await playNoteSequence(exercise.note_sequence, {
      dynamicHint: exercise.dynamic_hint,
      articulationHint: exercise.articulation_hint,
    });
    setIsPlaying(false);
    setHasPlayedOnce(true);
    setPhase("answering");
  };

  const handleSubmitFeatures = () => {
    if (!selectedDynamic || !selectedArticulation) return;
    finishAttempt({
      selected_dynamic: selectedDynamic,
      selected_articulation: selectedArticulation,
    });
  };

  // --- Echo Singing ------------------------------------------------------

  const handlePlayPhrase = async () => {
    if (exercise?.module_type !== "echo_singing" || isPlaying) return;
    setIsPlaying(true);
    await playNoteSequence(exercise.note_sequence);
    setIsPlaying(false);
    setHasPlayedOnce(true);
    setPhase("answering");
  };

  const handleStartRecording = async () => {
    setMicError(null);
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        setMicError("Microphone access is needed to record your singing.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setIsRecording(true);
    } catch {
      setMicError("Couldn't start recording. Try again.");
    }
  };

  const handleStopRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      setRecordingUri(uri);
      setIsRecording(false);
    } catch {
      setMicError("Couldn't save that recording. Try again.");
      setIsRecording(false);
    }
  };

  const handleSubmitRecording = () => {
    if (!recordingUri) return;
    const formData = new FormData();
    formData.append("audio", {
      uri: recordingUri,
      name: "echo-singing.m4a",
      type: "audio/m4a",
    } as unknown as Blob);
    finishAttempt(formData);
  };

  const handleTryAgain = () => {
    startRound();
  };

  const handleBackToPath = () => {
    router.replace(`/aural-training/${gradeId}`);
  };

  // ---------------------------------------------------------------------

  if (phase === "loading" && !exercise) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color={colors.blue} size="large" />
        <Text style={styles.centerStateText}>Building your exercise…</Text>
      </View>
    );
  }

  if (phase === "error" || !exercise) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.centerStateText}>
          Couldn&apos;t load this exercise.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={[styles.topBar, { paddingHorizontal: contentInset }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Close exercise"
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {moduleLabel ?? "Aural Training"}
        </Text>
        <View style={styles.xpBadge}>
          <Sparkles size={13} color={colors.blue} />
          <Text style={styles.xpBadgeText}>+{AURAL_XP} XP</Text>
        </View>
      </View>

      {phase !== "results" && (
        <View style={[styles.progressRow, { paddingHorizontal: contentInset }]}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, roundProgressStyle]} />
          </View>
          <Text style={styles.progressLabel}>
            {Math.min(roundIndex, ROUND_LENGTH)} / {ROUND_LENGTH}
          </Text>
        </View>
      )}

      {phase !== "results" && (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingHorizontal: contentInset },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInDown.duration(320).springify().damping(18)}
            style={[shakeStyle, styles.exerciseWrap]}
          >
            <LinearGradient
              colors={[colors.ink, "#0F1B2C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.exerciseCard}
            >
              {exercise.module_type === "pulse_metre" && (
                <>
                  <Text style={styles.exerciseHeading}>
                    Listen to the beat, then tap along
                  </Text>
                  <Text style={styles.exerciseSubtext}>
                    {exercise.tempo_bpm} BPM · {exercise.bars} bars
                  </Text>
                </>
              )}
              {exercise.module_type === "echo_singing" && (
                <>
                  <Text style={styles.exerciseHeading}>
                    Listen, then sing it back
                  </Text>
                  <Text style={styles.exerciseSubtext}>
                    Key of {exercise.key} major · {exercise.bars} bars
                  </Text>
                </>
              )}
              {exercise.module_type === "spot_difference" && (
                <>
                  <Text style={styles.exerciseHeading}>
                    Spot the changed note
                  </Text>
                  <Text style={styles.exerciseSubtext}>
                    Key of {exercise.key} major
                  </Text>
                </>
              )}
              {exercise.module_type === "musical_features" && (
                <>
                  <Text style={styles.exerciseHeading}>
                    Listen for how it&apos;s played
                  </Text>
                  <Text style={styles.exerciseSubtext}>
                    Key of {exercise.key} major
                  </Text>
                </>
              )}
            </LinearGradient>

            {/* --- Pulse & Metre interaction --- */}
            {exercise.module_type === "pulse_metre" && (
              <View style={styles.interactionBlock}>
                {!hasPlayedOnce && (
                  <Pressable
                    onPress={handlePlayAndTap}
                    disabled={isPlaying}
                    style={styles.primaryPillButton}
                  >
                    <Play size={16} color={colors.onInk} />
                    <Text style={styles.primaryPillButtonText}>
                      {isPlaying ? "Listen and tap…" : "Play the Beat"}
                    </Text>
                  </Pressable>
                )}
                {isPlaying && (
                  <Animated.View style={pulseStyle}>
                    <Pressable
                      onPress={handleTap}
                      style={styles.tapButton}
                      accessibilityRole="button"
                      accessibilityLabel="Tap along to the beat"
                    >
                      <Text style={styles.tapButtonText}>TAP</Text>
                    </Pressable>
                  </Animated.View>
                )}

                {(phase === "answering" || phase === "feedback") && (
                  <Animated.View
                    entering={FadeIn.duration(220)}
                    style={styles.optionsList}
                  >
                    <Text style={styles.questionPrompt}>
                      {exercise.question.prompt}
                    </Text>
                    {exercise.question.options.map((option) => (
                      <ChoiceButton
                        key={option}
                        label={option}
                        selected={selectedTimeSignature === option}
                        disabled={!!selectedTimeSignature || isSubmitting}
                        isCorrectAnswer={
                          phase === "feedback"
                            ? result?.correct_answer === option
                            : undefined
                        }
                        onPress={() => handleSelectTimeSignature(option)}
                        colors={colors}
                        styles={styles}
                      />
                    ))}
                    {phase === "feedback" &&
                      typeof result?.score_details?.timing_accuracy_pct ===
                        "number" && (
                        <Text style={styles.feedbackStat}>
                          Rhythm accuracy:{" "}
                          {result.score_details.timing_accuracy_pct}%
                        </Text>
                      )}
                  </Animated.View>
                )}
              </View>
            )}

            {/* --- Echo Singing interaction --- */}
            {exercise.module_type === "echo_singing" && (
              <View style={styles.interactionBlock}>
                {phase === "feedback" ? (
                  <Animated.View
                    entering={FadeIn.duration(220)}
                    style={styles.recordBlock}
                  >
                    <Check size={32} color={colors.success} />
                    <Text style={styles.feedbackStat}>
                      Saved! Next phrase coming up…
                    </Text>
                  </Animated.View>
                ) : !hasPlayedOnce ? (
                  <Pressable
                    onPress={handlePlayPhrase}
                    disabled={isPlaying}
                    style={styles.primaryPillButton}
                  >
                    <Play size={16} color={colors.onInk} />
                    <Text style={styles.primaryPillButtonText}>
                      {isPlaying ? "Playing…" : "Play Phrase"}
                    </Text>
                  </Pressable>
                ) : (
                  <Animated.View
                    entering={FadeIn.duration(220)}
                    style={styles.recordBlock}
                  >
                    <Pressable
                      onPress={handlePlayPhrase}
                      disabled={isPlaying}
                      style={styles.secondaryPillButton}
                    >
                      <Play size={14} color={colors.textPrimary} />
                      <Text style={styles.secondaryPillButtonText}>
                        Play again
                      </Text>
                    </Pressable>

                    {!recordingUri ? (
                      <Pressable
                        onPress={
                          isRecording ? handleStopRecording : handleStartRecording
                        }
                        style={[
                          styles.recordButton,
                          isRecording && styles.recordButtonActive,
                        ]}
                      >
                        {isRecording ? (
                          <Square size={20} color={colors.onInk} />
                        ) : (
                          <Mic size={22} color={colors.onInk} />
                        )}
                        <Text style={styles.recordButtonText}>
                          {isRecording ? "Stop" : "Sing it back"}
                        </Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={handleSubmitRecording}
                        disabled={isSubmitting}
                        style={styles.primaryPillButton}
                      >
                        <Check size={16} color={colors.onInk} />
                        <Text style={styles.primaryPillButtonText}>
                          Submit recording
                        </Text>
                      </Pressable>
                    )}

                    {micError && <Text style={styles.errorText}>{micError}</Text>}
                  </Animated.View>
                )}
              </View>
            )}

            {/* --- Spotting the Difference interaction --- */}
            {exercise.module_type === "spot_difference" && (
              <View style={styles.interactionBlock}>
                <View style={styles.playRow}>
                  <Pressable
                    onPress={handlePlayOriginal}
                    disabled={isPlaying}
                    style={styles.secondaryPillButton}
                  >
                    <Play size={14} color={colors.textPrimary} />
                    <Text style={styles.secondaryPillButtonText}>
                      Play Original
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handlePlayAltered}
                    disabled={isPlaying || !hasPlayedOnce}
                    style={[
                      styles.primaryPillButton,
                      (!hasPlayedOnce || isPlaying) && styles.pillButtonDisabled,
                    ]}
                  >
                    <Play size={14} color={colors.onInk} />
                    <Text style={styles.primaryPillButtonText}>Play Again</Text>
                  </Pressable>
                </View>

                {(phase === "answering" || phase === "feedback") && (
                  <Animated.View
                    entering={FadeIn.duration(220)}
                    style={styles.optionsList}
                  >
                    <Text style={styles.questionPrompt}>
                      {exercise.question.prompt}
                    </Text>
                    {exercise.question.options.map((option) => (
                      <ChoiceButton
                        key={option}
                        label={option === "beginning" ? "Beginning" : "End"}
                        selected={selectedPosition === option}
                        disabled={!!selectedPosition || isSubmitting}
                        isCorrectAnswer={
                          phase === "feedback"
                            ? result?.correct_answer === option
                            : undefined
                        }
                        onPress={() =>
                          handleSelectPosition(option as "beginning" | "end")
                        }
                        colors={colors}
                        styles={styles}
                      />
                    ))}
                  </Animated.View>
                )}
              </View>
            )}

            {/* --- Musical Features interaction --- */}
            {exercise.module_type === "musical_features" && (
              <View style={styles.interactionBlock}>
                {!hasPlayedOnce ? (
                  <Pressable
                    onPress={handlePlayFeatures}
                    disabled={isPlaying}
                    style={styles.primaryPillButton}
                  >
                    <Play size={16} color={colors.onInk} />
                    <Text style={styles.primaryPillButtonText}>
                      {isPlaying ? "Playing…" : "Play"}
                    </Text>
                  </Pressable>
                ) : (
                  <Animated.View
                    entering={FadeIn.duration(220)}
                    style={styles.optionsList}
                  >
                    <Pressable
                      onPress={handlePlayFeatures}
                      disabled={isPlaying}
                      style={styles.secondaryPillButton}
                    >
                      <Play size={14} color={colors.textPrimary} />
                      <Text style={styles.secondaryPillButtonText}>
                        Play again
                      </Text>
                    </Pressable>

                    <Text style={styles.questionPrompt}>
                      {exercise.question.dynamic.prompt}
                    </Text>
                    <View style={styles.choiceRow}>
                      {exercise.question.dynamic.options.map((option) => (
                        <ChoiceButton
                          key={option}
                          label={option}
                          compact
                          selected={selectedDynamic === option}
                          disabled={isSubmitting || phase === "feedback"}
                          isCorrectAnswer={
                            phase === "feedback"
                              ? (result?.correct_answer as { dynamic?: string })
                                  ?.dynamic === option
                              : undefined
                          }
                          onPress={() => setSelectedDynamic(option)}
                          colors={colors}
                          styles={styles}
                        />
                      ))}
                    </View>

                    <Text style={styles.questionPrompt}>
                      {exercise.question.articulation.prompt}
                    </Text>
                    <View style={styles.choiceRow}>
                      {exercise.question.articulation.options.map((option) => (
                        <ChoiceButton
                          key={option}
                          label={option}
                          compact
                          selected={selectedArticulation === option}
                          disabled={isSubmitting || phase === "feedback"}
                          isCorrectAnswer={
                            phase === "feedback"
                              ? (
                                  result?.correct_answer as {
                                    articulation?: string;
                                  }
                                )?.articulation === option
                              : undefined
                          }
                          onPress={() => setSelectedArticulation(option)}
                          colors={colors}
                          styles={styles}
                        />
                      ))}
                    </View>

                    {phase !== "feedback" && (
                      <Pressable
                        onPress={handleSubmitFeatures}
                        disabled={
                          !selectedDynamic || !selectedArticulation || isSubmitting
                        }
                        style={[
                          styles.primaryPillButton,
                          (!selectedDynamic || !selectedArticulation) &&
                            styles.pillButtonDisabled,
                        ]}
                      >
                        <Check size={16} color={colors.onInk} />
                        <Text style={styles.primaryPillButtonText}>Submit</Text>
                      </Pressable>
                    )}
                  </Animated.View>
                )}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      )}

      {phase === "results" && (
        <ScrollView
          contentContainerStyle={styles.resultsScroll}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInDown.duration(420).springify().damping(14)}
            style={styles.resultsCard}
          >
            {exercise.module_type === "echo_singing" ? (
              <Mic size={48} color={colors.blue} />
            ) : (
              <Trophy size={48} color={colors.gold} />
            )}

            <Text style={styles.resultsHeading}>
              {moduleLabel ? `${moduleLabel} complete!` : "Round complete!"}
            </Text>

            {exercise.module_type === "echo_singing" ? (
              <Text style={styles.resultsMessage}>
                {attemptedCount} phrases recorded — full scoring is coming
                soon.
              </Text>
            ) : (
              <>
                <Text style={styles.resultsScore}>
                  {correctCount}/{ROUND_LENGTH}
                </Text>
                <Text style={styles.resultsSubtext}>correct answers</Text>
              </>
            )}

            <View style={styles.resultsXpBadge}>
              <Sparkles size={13} color={colors.blue} />
              <Text style={styles.resultsXpBadgeText}>+{AURAL_XP} XP</Text>
            </View>

            <Pressable onPress={handleTryAgain} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
            <Pressable onPress={handleBackToPath} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Back to path</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

function ChoiceButton({
  label,
  selected,
  disabled,
  compact,
  isCorrectAnswer,
  onPress,
  colors,
  styles,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  compact?: boolean;
  // Set once the result for this round of the round comes back, so the right
  // answer highlights green and a wrong pick highlights red - undefined/false
  // while still answering, when there's nothing to reveal yet.
  isCorrectAnswer?: boolean;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const isWrongSelection = selected && isCorrectAnswer === false;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.optionRow,
        compact && styles.optionRowCompact,
        selected && styles.optionRowSelected,
        isCorrectAnswer && styles.optionRowCorrect,
        isWrongSelection && styles.optionRowWrong,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Answer: ${label}`}
    >
      <Text
        style={[
          styles.optionText,
          (selected || isCorrectAnswer) && styles.optionTextSelected,
        ]}
      >
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </Text>
      {isCorrectAnswer && <Check size={16} color={colors.onInk} />}
      {isWrongSelection && <X size={16} color={colors.onInk} />}
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centerScreen: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: colors.bg,
    },
    centerStateText: { color: colors.textPrimary, fontSize: 14 },
    retryButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.ink,
    },
    retryButtonText: { color: colors.onInk, fontSize: 13, fontWeight: "700" },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingTop: 8,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    topBarTitle: {
      flex: 1,
      color: colors.textPrimary,
      fontFamily: "Georgia",
      fontSize: 16,
      fontWeight: "700",
    },
    xpBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    xpBadgeText: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingTop: 14,
    },
    progressTrack: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 3,
      backgroundColor: colors.blue,
    },
    progressLabel: { color: colors.textPrimary, fontSize: 12, fontWeight: "700" },
    scroll: { paddingTop: 16, paddingBottom: 48 },
    exerciseWrap: { width: "100%" },
    exerciseCard: {
      borderRadius: 16,
      paddingHorizontal: 18,
      paddingTop: 20,
      paddingBottom: 22,
    },
    exerciseHeading: {
      color: colors.onInk,
      fontFamily: "Georgia",
      fontSize: 19,
      lineHeight: 26,
      marginBottom: 6,
    },
    exerciseSubtext: { color: colors.textSecondary, fontSize: 13 },
    interactionBlock: { marginTop: 20, gap: 14, alignItems: "center" },
    primaryPillButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 999,
      backgroundColor: colors.blue,
    },
    primaryPillButtonText: { color: colors.onInk, fontSize: 15, fontWeight: "700" },
    secondaryPillButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 18,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryPillButtonText: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
    pillButtonDisabled: { opacity: 0.45 },
    playRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
    tapButton: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: colors.gold,
      alignItems: "center",
      justifyContent: "center",
    },
    tapButtonText: {
      color: colors.ink,
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: 1.5,
    },
    optionsList: { width: "100%", gap: 10, alignItems: "stretch" },
    questionPrompt: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
      textAlign: "center",
      marginTop: 8,
    },
    choiceRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
    feedbackStat: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "center",
      marginTop: 4,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    optionRowCompact: { flex: 1, justifyContent: "center", gap: 8 },
    optionRowSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
    optionRowCorrect: { backgroundColor: colors.success, borderColor: colors.success },
    optionRowWrong: { backgroundColor: colors.danger, borderColor: colors.danger },
    optionText: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
    optionTextSelected: { color: colors.onInk },
    recordBlock: { alignItems: "center", gap: 14 },
    recordButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 22,
      paddingVertical: 14,
      borderRadius: 999,
      backgroundColor: colors.danger,
    },
    // Deliberately fixed darker literal for the pressed/active recording
    // state - the palette doesn't define a distinct "pressed danger" token.
    recordButtonActive: { backgroundColor: "#7A2323" },
    recordButtonText: { color: colors.onInk, fontSize: 15, fontWeight: "700" },
    errorText: { color: colors.danger, fontSize: 12, textAlign: "center" },
    resultsScroll: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 40,
    },
    resultsCard: {
      width: "100%",
      maxWidth: 360,
      alignItems: "center",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      paddingVertical: 32,
      paddingHorizontal: 24,
      gap: 6,
    },
    resultsHeading: {
      marginTop: 12,
      color: colors.textPrimary,
      fontFamily: "Georgia",
      fontSize: 22,
      fontWeight: "700",
    },
    resultsMessage: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      marginBottom: 8,
    },
    resultsScore: {
      marginTop: 8,
      color: colors.textPrimary,
      fontFamily: "Georgia",
      fontSize: 44,
    },
    resultsSubtext: { color: colors.textSecondary, fontSize: 13, marginBottom: 12 },
    resultsXpBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      // Decorative light-blue chip background - not covered by the theme
      // token set, left as a fixed literal (see report).
      backgroundColor: "#E3F0F7",
      marginBottom: 20,
    },
    resultsXpBadgeText: { color: colors.blue, fontSize: 12, fontWeight: "700" },
    primaryButton: {
      width: "100%",
      borderRadius: 10,
      backgroundColor: colors.ink,
      paddingVertical: 14,
      alignItems: "center",
      marginBottom: 10,
    },
    primaryButtonText: { color: colors.onInk, fontSize: 15, fontWeight: "700" },
    secondaryButton: {
      width: "100%",
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
    },
    secondaryButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: "600" },
  });
