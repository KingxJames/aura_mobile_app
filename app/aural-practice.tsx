import {
  resetAuralSession,
  resetRecording,
  setLastAttemptId,
  setResultPreview,
  setSubmitting,
  setTargetNote,
  startRecording,
  stopRecording,
} from "@/store/features/auralSessionSlice";
import { useAnalyzeAuralAudioMutation } from "@/store/services/auraAPI";
import { useSubmitFeedbackMutation } from "@/store/services/feedbackAPI";
import FlowCheckinCard from "@/components/flowCheckin/flowCheckinCard";
import type { RootState } from "@/store/store";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Ear,
  Flame,
  Mic,
  Square,
  Star,
  Volume2,
} from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

// All 12 chromatic pitch classes. The octave suffix is only for the
// backend/DSP (librosa needs a specific note like "C#4") and the reference
// tone asset - matching is octave-invariant, so which octave is arbitrary,
// and the UI never shows it (see notePitchClass below).
const PRESET_NOTES = [
  "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
];

// Strips the octave number for display, e.g. "C#4" -> "C#".
function notePitchClass(note: string): string {
  return note.replace(/\d+$/, "");
}

// Picking your own note lets you gravitate toward ones you're already
// comfortable with, which would quietly inflate accuracy - randomizing keeps
// this an actual recall/reproduction test instead of confirmation practice.
function pickRandomNote(exclude?: string): string {
  const choices = exclude
    ? PRESET_NOTES.filter((n) => n !== exclude)
    : PRESET_NOTES;
  return choices[Math.floor(Math.random() * choices.length)];
}

// Metro requires static require() paths for assets - can't build this map
// dynamically from PRESET_NOTES. Generated via scripts/generate-tones.js.
// Filenames use "s" for sharp ("Cs4") since "#" is unsafe in a Metro web
// asset URL; the map's keys stay in proper note notation ("C#4") since
// that's what's sent to the backend.
const TONE_ASSETS: Record<string, number> = {
  C4: require("../assets/tones/C4.wav"),
  "C#4": require("../assets/tones/Cs4.wav"),
  D4: require("../assets/tones/D4.wav"),
  "D#4": require("../assets/tones/Ds4.wav"),
  E4: require("../assets/tones/E4.wav"),
  F4: require("../assets/tones/F4.wav"),
  "F#4": require("../assets/tones/Fs4.wav"),
  G4: require("../assets/tones/G4.wav"),
  "G#4": require("../assets/tones/Gs4.wav"),
  A4: require("../assets/tones/A4.wav"),
  "A#4": require("../assets/tones/As4.wav"),
  B4: require("../assets/tones/B4.wav"),
};

// On native, RN's FormData understands { uri, name, type } directly and the
// recording is genuinely m4a. On Expo web, FormData is the real browser API
// and needs an actual Blob - the recording's URI there is a blob: URL that
// must be re-fetched into one, and the browser's MediaRecorder actually
// produces webm/opus regardless of what we ask for, so the filename must
// reflect that (Laravel's mimes validation inspects real file content, not
// just the extension, but a mismatched extension is still worth avoiding).
async function resolveAudioFormPart(
  uri: string,
  nativeFileName: string,
  nativeType: string,
): Promise<{ part: { uri: string; name: string; type: string } | Blob; fileName: string }> {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    return { part: blob, fileName: "aural-practice.webm" };
  }
  return {
    part: { uri, name: nativeFileName, type: nativeType },
    fileName: nativeFileName,
  };
}

// Mirrors the DSP's own +/-50 cent pass/fail cutoff (pitch_service.py) -
// purely for client-side color coding, not a research computation.
const IN_TUNE_THRESHOLD_CENTS = 50;

// Visual gauge range - cents deviation is clamped to this for display only.
const GAUGE_RANGE_CENTS = 100;

type ResultTier = { emoji: string; title: string };

function getResultTier(cents: number): ResultTier {
  const abs = Math.abs(cents);
  if (abs <= 15) return { emoji: "🎯", title: "Spot on!" };
  if (abs <= IN_TUNE_THRESHOLD_CENTS) return { emoji: "👍", title: "Nice work!" };
  if (abs <= 100) return { emoji: "🎵", title: "So close!" };
  return { emoji: "💪", title: "Keep practicing" };
}

export default function AuralPracticeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useDispatch();

  const targetNote = useSelector(
    (state: RootState) => state.auralSession.targetNote,
  );
  const recordingState = useSelector(
    (state: RootState) => state.auralSession.recordingState,
  );
  const recordedBlobUrl = useSelector(
    (state: RootState) => state.auralSession.recordedBlobUrl,
  );
  const recordedFileName = useSelector(
    (state: RootState) => state.auralSession.recordedFileName,
  );
  const isSubmitting = useSelector(
    (state: RootState) => state.auralSession.isSubmitting,
  );
  const centsDeviationPreview = useSelector(
    (state: RootState) => state.auralSession.centsDeviationPreview,
  );
  const feedbackPreview = useSelector(
    (state: RootState) => state.auralSession.feedbackPreview,
  );
  const lastAttemptId = useSelector(
    (state: RootState) => state.auralSession.lastAttemptId,
  );

  const [analyzeAuralAudio] = useAnalyzeAuralAudioMutation();
  const [submitFeedback, { isLoading: isSubmittingFeedback }] =
    useSubmitFeedbackMutation();
  const [micError, setMicError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPlayingTone, setIsPlayingTone] = useState(false);
  // In-session only, purely cosmetic - not persisted, not sent anywhere.
  const [streak, setStreak] = useState(0);
  // Post-attempt qualitative feedback (rating + optional comment) - research
  // data, submitted separately from the DSP result via POST /v1/feedback.
  const [selectedRating, setSelectedRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackSubmitError, setFeedbackSubmitError] = useState<
    string | null
  >(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const toneSoundRef = useRef<Audio.Sound | null>(null);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    return () => {
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      toneSoundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (recordingState === "recording") {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 500 }),
          withTiming(1, { duration: 500 }),
        ),
        -1,
        true,
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [recordingState, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handlePlayTone = async (note: string) => {
    try {
      // Recording and playback can't both hold the mic/audio session on some
      // platforms - only play the reference tone while not actively recording.
      if (recordingState === "recording") return;

      await toneSoundRef.current?.unloadAsync().catch(() => {});

      const { sound } = await Audio.Sound.createAsync(TONE_ASSETS[note]);
      toneSoundRef.current = sound;
      setIsPlayingTone(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlayingTone(false);
        }
      });
      await sound.playAsync();
    } catch {
      setIsPlayingTone(false);
    }
  };

  // Roll a random note as soon as the screen opens, and play it immediately -
  // matches the existing "hear it, then sing it" flow, just without a picker.
  useEffect(() => {
    const note = pickRandomNote();
    dispatch(setTargetNote(note));
    handlePlayTone(note);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewNote = () => {
    if (recordingState === "recording" || isPlayingTone) return;
    dispatch(resetRecording());
    const note = pickRandomNote(targetNote);
    dispatch(setTargetNote(note));
    handlePlayTone(note);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/aural");
    }
  };

  const handleStartRecording = async () => {
    setMicError(null);
    setSubmitError(null);
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
      dispatch(startRecording());
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
      recordingRef.current = null;

      if (uri) {
        dispatch(stopRecording({ blobUrl: uri, fileName: "aural-practice.m4a" }));
      }
    } catch {
      setMicError("Couldn't save that recording. Try again.");
    }
  };

  const handleSubmit = async () => {
    if (!recordedBlobUrl) return;

    setSubmitError(null);
    dispatch(setSubmitting(true));

    try {
      const nativeFileName = recordedFileName ?? "aural-practice.m4a";
      const { part: audioFile, fileName } = await resolveAudioFormPart(
        recordedBlobUrl,
        nativeFileName,
        "audio/m4a",
      );

      const result = await analyzeAuralAudio({
        audioFile,
        audioFileName: fileName,
        targetNote,
      }).unwrap();

      dispatch(
        setResultPreview({
          detectedFrequency: result.detectedFrequency,
          centsDeviation: result.centsDeviation,
          feedbackText: result.feedbackText,
        }),
      );
      dispatch(setLastAttemptId(result.id));

      const wasInTune = Math.abs(result.centsDeviation) <= IN_TUNE_THRESHOLD_CENTS;
      setStreak((prev) => (wasInTune ? prev + 1 : 0));
    } catch (error: any) {
      setSubmitError(
        error?.data?.message ?? "Couldn't analyze that recording. Try again.",
      );
    } finally {
      dispatch(setSubmitting(false));
    }
  };

  const handleTryAgain = () => {
    const previousNote = targetNote;
    dispatch(resetAuralSession());
    setMicError(null);
    setSubmitError(null);
    setSelectedRating(0);
    setFeedbackComment("");
    setFeedbackSubmitted(false);
    setFeedbackSubmitError(null);

    const note = pickRandomNote(previousNote);
    dispatch(setTargetNote(note));
    handlePlayTone(note);
  };

  const handleSubmitFeedback = async () => {
    if (!lastAttemptId || selectedRating === 0) return;

    setFeedbackSubmitError(null);
    try {
      await submitFeedback({
        feedbackable_type: "aural_attempt",
        feedbackable_id: lastAttemptId,
        rating: selectedRating,
        comment: feedbackComment.trim() || undefined,
      }).unwrap();
      setFeedbackSubmitted(true);
    } catch {
      setFeedbackSubmitError("Couldn't submit feedback. Try again.");
    }
  };

  const hasResult = feedbackPreview !== null;
  const isInTune =
    centsDeviationPreview !== null &&
    Math.abs(centsDeviationPreview) <= IN_TUNE_THRESHOLD_CENTS;
  const resultTier =
    centsDeviationPreview !== null ? getResultTier(centsDeviationPreview) : null;
  const gaugeMarkerPercent =
    centsDeviationPreview !== null
      ? ((Math.max(-GAUGE_RANGE_CENTS, Math.min(GAUGE_RANGE_CENTS, centsDeviationPreview)) +
          GAUGE_RANGE_CENTS) /
          (GAUGE_RANGE_CENTS * 2)) *
        100
      : 50;

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

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>FREE PRACTICE</Text>
            <Text style={styles.heading}>Pitch Practice</Text>
          </View>

          {streak > 0 ? (
            <Animated.View
              entering={FadeInDown.duration(300).springify().damping(12)}
              style={styles.streakBadge}
            >
              <Flame size={16} color={colors.gold} />
              <Text style={styles.streakBadgeText}>{streak}</Text>
            </Animated.View>
          ) : null}
        </View>

        <Text style={styles.subheading}>
          Listen to the note, then sing it back for instant feedback.
        </Text>

        {!hasResult ? (
          <>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ear size={16} color={colors.textPrimary} />
                <Text style={styles.cardTitle}>This round&apos;s note</Text>
              </View>

              <View style={styles.noteDisplay}>
                <Text style={styles.noteDisplayText}>
                  {notePitchClass(targetNote)}
                </Text>
              </View>

              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => handlePlayTone(targetNote)}
                  disabled={recordingState === "recording" || isPlayingTone}
                  style={({ pressed }) => [
                    styles.replayButton,
                    pressed && styles.recordButtonPressed,
                  ]}
                >
                  <Volume2 size={16} color={colors.ink} />
                  <Text style={styles.replayButtonText}>
                    {isPlayingTone ? "Playing…" : "Hear it again"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleNewNote}
                  disabled={recordingState === "recording" || isPlayingTone}
                  style={({ pressed }) => [
                    styles.replayButton,
                    pressed && styles.recordButtonPressed,
                  ]}
                >
                  <Text style={styles.replayButtonText}>New note</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              {micError ? (
                <Text style={styles.formMessageError}>{micError}</Text>
              ) : null}
              {submitError ? (
                <Text style={styles.formMessageError}>{submitError}</Text>
              ) : null}

              <Animated.View style={pulseStyle}>
                {recordingState !== "recording" ? (
                  <Pressable
                    onPress={handleStartRecording}
                    style={({ pressed }) => [
                      styles.recordButton,
                      pressed && styles.recordButtonPressed,
                    ]}
                  >
                    <Mic size={18} color={colors.onInk} />
                    <Text style={styles.recordButtonText}>
                      Sing &ldquo;{notePitchClass(targetNote)}&rdquo;
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={handleStopRecording}
                    style={({ pressed }) => [
                      styles.stopButton,
                      pressed && styles.recordButtonPressed,
                    ]}
                  >
                    <Square size={18} color={colors.onInk} />
                    <Text style={styles.recordButtonText}>
                      Listening… tap to stop
                    </Text>
                  </Pressable>
                )}
              </Animated.View>

              {recordingState === "stopped" ? (
                <Pressable
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.saveButtonPressed,
                    isSubmitting && styles.saveButtonDisabled,
                  ]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={colors.onInk} />
                  ) : (
                    <Text style={styles.saveButtonText}>Get feedback</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <>
          <Animated.View
            entering={FadeInDown.duration(450).springify().damping(14)}
            style={styles.card}
          >
            <Text style={styles.resultEmoji}>{resultTier?.emoji}</Text>
            <Text style={styles.resultTitle}>{resultTier?.title}</Text>

            <View style={styles.gaugeTrack}>
              <View style={styles.gaugeCenterZone} />
              <View
                style={[
                  styles.gaugeMarker,
                  { left: `${gaugeMarkerPercent}%` },
                  isInTune ? styles.gaugeMarkerGood : styles.gaugeMarkerOff,
                ]}
              />
            </View>
            <View style={styles.gaugeLabelsRow}>
              <Text style={styles.gaugeLabel}>FLAT</Text>
              <Text style={styles.gaugeLabel}>IN TUNE</Text>
              <Text style={styles.gaugeLabel}>SHARP</Text>
            </View>

            <Text style={styles.bodyText}>{feedbackPreview}</Text>

            {streak > 1 ? (
              <Text style={styles.streakLine}>
                🔥 {streak} in a row - keep it going!
              </Text>
            ) : null}

            <View style={styles.feedbackDivider} />

            {feedbackSubmitted ? (
              <Text style={styles.feedbackThanksText}>
                Thanks for the feedback!
              </Text>
            ) : (
              <View style={styles.feedbackSection}>
                <Text style={styles.feedbackPrompt}>
                  Was that critique helpful?
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
              onPress={handleTryAgain}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.saveButtonPressed,
              ]}
            >
              <Text style={styles.saveButtonText}>Try again</Text>
            </Pressable>
          </Animated.View>

          <FlowCheckinCard />
          </>
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
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    streakBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginTop: 4,
    },
    streakBadgeText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
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
    noteDisplay: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 20,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    noteDisplayText: {
      fontFamily: "Georgia",
      fontSize: 40,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
    },
    replayButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    replayButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.ink,
    },
    formMessageError: {
      fontSize: 13,
      color: colors.danger,
      marginBottom: 12,
    },
    recordButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 8,
      backgroundColor: colors.ink,
      paddingVertical: 15,
    },
    stopButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 8,
      backgroundColor: colors.danger,
      paddingVertical: 15,
    },
    recordButtonPressed: {
      opacity: 0.9,
    },
    recordButtonText: {
      color: colors.onInk,
      fontSize: 16,
      fontWeight: "700",
    },
    saveButton: {
      borderRadius: 8,
      backgroundColor: colors.ink,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 12,
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
      marginBottom: 20,
    },
    gaugeTrack: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "visible",
      justifyContent: "center",
    },
    gaugeCenterZone: {
      position: "absolute",
      left: "40%",
      width: "20%",
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.border,
    },
    gaugeMarker: {
      position: "absolute",
      top: -5,
      width: 20,
      height: 20,
      borderRadius: 10,
      marginLeft: -10,
      borderWidth: 3,
      borderColor: colors.surface,
    },
    gaugeMarkerGood: {
      backgroundColor: colors.success,
    },
    gaugeMarkerOff: {
      backgroundColor: colors.danger,
    },
    gaugeLabelsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
      marginBottom: 18,
    },
    gaugeLabel: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.6,
      color: colors.textMuted,
    },
    streakLine: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.gold,
      textAlign: "center",
      marginBottom: 16,
    },
    bodyText: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textPrimary,
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
