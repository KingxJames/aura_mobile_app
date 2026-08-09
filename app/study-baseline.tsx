import {
  useCompleteBaselineMutation,
  useGetBaselineStatusQuery,
  useGetBaselineTranscriptionExerciseMutation,
  useSubmitBaselinePitchAttemptMutation,
  useSubmitBaselineTranscriptionAttemptMutation,
} from "@/store/services/studyAPI";
import { SEQUENCE_TONE_ASSETS } from "@/constants/sequenceTones";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import {
  CheckCircle2,
  ClipboardList,
  Delete,
  Mic,
  Music,
  Square,
  Trash2,
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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const PITCH_CLASSES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

// Rhythm isn't scored (mirrors ordinary Transcription) - fixed placeholder
// duration, the backend's validation just requires the field present.
const SUBMITTED_NOTE_DURATION_BEATS = 1.0;

type SubmittedNote = { note_name: string; octave: number; duration_beats: number };
type NoteEvent = { note_name: string; octave: number; duration_beats: number };

// Same platform shim as aural-practice.tsx: RN FormData wants { uri, name,
// type }, Expo web wants a real Blob resolved from the recording's blob: URI.
async function resolveAudioFormPart(
  uri: string,
  nativeFileName: string,
  nativeType: string,
): Promise<{ part: { uri: string; name: string; type: string } | Blob; fileName: string }> {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    const blob = await response.blob();
    return { part: blob, fileName: "study-baseline.webm" };
  }
  return {
    part: { uri, name: nativeFileName, type: nativeType },
    fileName: nativeFileName,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function StudyBaselineScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: status, isFetching: isLoadingStatus } =
    useGetBaselineStatusQuery();
  const [submitPitchAttempt, { isLoading: isSubmittingPitch }] =
    useSubmitBaselinePitchAttemptMutation();
  const [fetchTranscriptionExercise, { isLoading: isLoadingExercise }] =
    useGetBaselineTranscriptionExerciseMutation();
  const [submitTranscriptionAttempt, { isLoading: isSubmittingTranscription }] =
    useSubmitBaselineTranscriptionAttemptMutation();
  const [completeBaseline, { isLoading: isFinishing }] =
    useCompleteBaselineMutation();

  // Pitch-trial recording state
  const [recordingState, setRecordingState] = useState<
    "idle" | "recording" | "stopped"
  >("idle");
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [isPlayingTone, setIsPlayingTone] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [pitchSubmitError, setPitchSubmitError] = useState<string | null>(null);

  // Transcription-item state
  const [exercise, setExercise] = useState<{
    exercise_id: number;
    note_sequence: NoteEvent[];
  } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);
  const [builtSequence, setBuiltSequence] = useState<SubmittedNote[]>([]);
  const [selectedOctave, setSelectedOctave] = useState(4);
  const [transcriptionSubmitError, setTranscriptionSubmitError] = useState<
    string | null
  >(null);
  const [transcriptionResult, setTranscriptionResult] = useState<{
    correctnessPct: number;
  } | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const toneSoundRef = useRef<Audio.Sound | null>(null);
  const sequenceSoundsRef = useRef<Audio.Sound[]>([]);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    return () => {
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      toneSoundRef.current?.unloadAsync().catch(() => {});
      sequenceSoundsRef.current.forEach((s) => s.unloadAsync().catch(() => {}));
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

  // Already finished (e.g. reloaded this screen after finishing) - nothing to do here.
  useEffect(() => {
    if (status?.completed) {
      router.replace("/(tabs)/aural");
    }
  }, [status?.completed, router]);

  const pitchPhaseActive =
    !!status && !status.completed && status.pitch_trials_done < status.pitch_trials_required;
  const currentTargetNote = pitchPhaseActive
    ? status!.pitch_targets[status!.pitch_trials_done]
    : null;

  const transcriptionPhaseActive =
    !!status &&
    !status.completed &&
    status.pitch_trials_done >= status.pitch_trials_required &&
    !status.transcription_done &&
    transcriptionResult === null;

  // Resume case: both parts were already recorded server-side (e.g. a
  // previous session submitted the transcription item but the app closed
  // before /complete ran) but this fresh page load has no local
  // transcriptionResult to show a score for. Nothing left to do but finalize
  // - there's no re-doable step here, so this auto-advances rather than
  // asking the user to click through a screen with nothing new to show them.
  const readyToFinish =
    !!status &&
    !status.completed &&
    status.pitch_trials_done >= status.pitch_trials_required &&
    status.transcription_done &&
    transcriptionResult === null;

  const handlePlayTone = async (key: string) => {
    try {
      if (recordingState === "recording") return;
      await toneSoundRef.current?.unloadAsync().catch(() => {});

      const asset = SEQUENCE_TONE_ASSETS[key];
      if (!asset) return;

      const { sound } = await Audio.Sound.createAsync(asset);
      toneSoundRef.current = sound;
      setIsPlayingTone(true);
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) {
          setIsPlayingTone(false);
        }
      });
      await sound.playAsync();
    } catch {
      setIsPlayingTone(false);
    }
  };

  // Play the target note as soon as a new pitch trial becomes current.
  useEffect(() => {
    if (currentTargetNote) {
      handlePlayTone(currentTargetNote);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTargetNote]);

  const handleStartRecording = async () => {
    setMicError(null);
    setPitchSubmitError(null);
    try {
      const { status: permStatus } = await Audio.requestPermissionsAsync();
      if (permStatus !== "granted") {
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
      setRecordingState("recording");
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
        setRecordedUri(uri);
        setRecordingState("stopped");
      }
    } catch {
      setMicError("Couldn't save that recording. Try again.");
    }
  };

  const handleSubmitPitch = async () => {
    if (!recordedUri) return;

    setPitchSubmitError(null);
    try {
      const { part, fileName } = await resolveAudioFormPart(
        recordedUri,
        "study-baseline.m4a",
        "audio/m4a",
      );

      await submitPitchAttempt({
        audioFile: part,
        audioFileName: fileName,
      }).unwrap();

      // Status refetches automatically (invalidatesTags) and advances to the
      // next fixed target note - no local trial counter to keep in sync.
      setRecordingState("idle");
      setRecordedUri(null);
    } catch (error: any) {
      setPitchSubmitError(
        error?.data?.message ?? "Couldn't process that recording. Try again.",
      );
    }
  };

  const playSequence = async (notes: NoteEvent[]) => {
    setIsPlayingSequence(true);
    const beatMs = 60000 / 100; // fixed 100bpm playback tempo

    for (const note of notes) {
      const key = `${note.note_name}${note.octave}`;
      const asset = SEQUENCE_TONE_ASSETS[key];
      if (asset) {
        try {
          const { sound } = await Audio.Sound.createAsync(asset);
          sequenceSoundsRef.current.push(sound);
          sound.playAsync();
        } catch {
          // Missing/failed tone asset - keep going rather than derail the round.
        }
      }
      await sleep(note.duration_beats * beatMs);
    }

    setIsPlayingSequence(false);
  };

  const playNotePreview = (pitchClass: string, octave: number) => {
    const key = `${pitchClass}${octave}`;
    const asset = SEQUENCE_TONE_ASSETS[key];
    if (!asset) return;

    Audio.Sound.createAsync(asset)
      .then(({ sound }) => {
        sequenceSoundsRef.current.push(sound);
        sound.playAsync();
      })
      .catch(() => {});
  };

  const handleLoadTranscriptionExercise = async () => {
    setGenError(null);
    try {
      const res = await fetchTranscriptionExercise().unwrap();
      setExercise({
        exercise_id: res.data.exercise_id,
        note_sequence: res.data.note_sequence,
      });
      playSequence(res.data.note_sequence);
    } catch (error: any) {
      setGenError(
        error?.data?.message ?? "Couldn't load the exercise. Try again.",
      );
    }
  };

  // Fetch (or resume) the single fixed baseline transcription item as soon as
  // the pitch trials are done - idempotent server-side, so a reload mid-phase
  // just returns the same exercise again rather than generating a new one.
  useEffect(() => {
    if (transcriptionPhaseActive && !exercise && !isLoadingExercise) {
      handleLoadTranscriptionExercise();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcriptionPhaseActive]);

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

  const handleSubmitTranscription = async () => {
    if (!exercise || builtSequence.length === 0) return;

    setTranscriptionSubmitError(null);
    try {
      const res = await submitTranscriptionAttempt({
        exercise_id: exercise.exercise_id,
        note_sequence: builtSequence,
      }).unwrap();

      setTranscriptionResult({ correctnessPct: res.data.correctness_pct });
    } catch (error: any) {
      setTranscriptionSubmitError(
        error?.data?.message ?? "Couldn't submit that. Try again.",
      );
    }
  };

  const handleFinishBaseline = async () => {
    try {
      await completeBaseline().unwrap();
    } catch {
      // Best-effort - if this particular call fails (e.g. already completed
      // by a previous attempt), the user has still finished everything they
      // need to client-side, so proceed to the app regardless.
    }
    router.replace("/(tabs)/aural");
  };

  useEffect(() => {
    if (readyToFinish) {
      handleFinishBaseline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToFinish]);

  const showLoadingCard = isLoadingStatus && !status;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>RESEARCH STUDY</Text>
        <Text style={styles.heading}>Quick Baseline Check</Text>
        <Text style={styles.subheading}>
          Before your regular practice begins, we need a quick snapshot of
          where you're starting from - this only happens once.
        </Text>

        {showLoadingCard || readyToFinish ? (
          <View style={styles.card}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : transcriptionResult !== null ? (
          <View style={styles.card}>
            <CheckCircle2 size={32} color={colors.success} style={styles.centerIcon} />
            <Text style={styles.resultTitle}>Baseline complete</Text>
            <Text style={styles.bodyText}>
              Thanks - that's everything we need to get started. Your regular
              practice is unlocked now.
            </Text>
            <Pressable
              onPress={handleFinishBaseline}
              disabled={isFinishing}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.saveButtonPressed,
                isFinishing && styles.saveButtonDisabled,
              ]}
            >
              {isFinishing ? (
                <ActivityIndicator color={colors.onInk} />
              ) : (
                <Text style={styles.saveButtonText}>Continue to Aura</Text>
              )}
            </Pressable>
          </View>
        ) : pitchPhaseActive ? (
          <>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <ClipboardList size={16} color={colors.textPrimary} />
                <Text style={styles.cardTitle}>Pitch check</Text>
              </View>
              <Text style={styles.progressText}>
                Trial {status!.pitch_trials_done + 1} of{" "}
                {status!.pitch_trials_required}
              </Text>
              <View style={styles.unlockProgressTrack}>
                <View
                  style={[
                    styles.unlockProgressFill,
                    {
                      width: `${(status!.pitch_trials_done / status!.pitch_trials_required) * 100}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.bodyText}>
                Listen to the note, then sing it back. There's no scoring
                shown here - just sing naturally.
              </Text>

              <Pressable
                onPress={() => currentTargetNote && handlePlayTone(currentTargetNote)}
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
            </View>

            <View style={styles.card}>
              {micError ? (
                <Text style={styles.formMessageError}>{micError}</Text>
              ) : null}
              {pitchSubmitError ? (
                <Text style={styles.formMessageError}>{pitchSubmitError}</Text>
              ) : null}

              <Animated.View style={pulseStyle}>
                {recordingState !== "recording" ? (
                  <Pressable
                    onPress={handleStartRecording}
                    disabled={isSubmittingPitch}
                    style={({ pressed }) => [
                      styles.recordButton,
                      pressed && styles.recordButtonPressed,
                    ]}
                  >
                    <Mic size={18} color={colors.onInk} />
                    <Text style={styles.recordButtonText}>Sing the note</Text>
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
                  onPress={handleSubmitPitch}
                  disabled={isSubmittingPitch}
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.saveButtonPressed,
                    isSubmittingPitch && styles.saveButtonDisabled,
                  ]}
                >
                  {isSubmittingPitch ? (
                    <ActivityIndicator color={colors.onInk} />
                  ) : (
                    <Text style={styles.saveButtonText}>Submit</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Music size={16} color={colors.textPrimary} />
                <Text style={styles.cardTitle}>One quick transcription</Text>
              </View>
              <Text style={styles.bodyText}>
                Last step - listen to a short pattern once, then notate it
                using the note buttons below.
              </Text>

              {genError ? (
                <Text style={styles.formMessageError}>{genError}</Text>
              ) : null}

              {isLoadingExercise && !exercise ? (
                <ActivityIndicator color={colors.ink} />
              ) : exercise ? (
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
              ) : null}
            </View>

            {exercise ? (
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

                {transcriptionSubmitError ? (
                  <Text style={styles.formMessageError}>
                    {transcriptionSubmitError}
                  </Text>
                ) : null}

                <Pressable
                  onPress={handleSubmitTranscription}
                  disabled={isSubmittingTranscription || builtSequence.length === 0}
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.saveButtonPressed,
                    (isSubmittingTranscription || builtSequence.length === 0) &&
                      styles.saveButtonDisabled,
                  ]}
                >
                  {isSubmittingTranscription ? (
                    <ActivityIndicator color={colors.onInk} />
                  ) : (
                    <Text style={styles.saveButtonText}>Submit</Text>
                  )}
                </Pressable>
              </View>
            ) : null}
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
      paddingTop: 14,
      paddingBottom: 60,
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
      marginBottom: 12,
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
      marginBottom: 14,
    },
    progressText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 8,
    },
    unlockProgressTrack: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
      marginBottom: 14,
    },
    unlockProgressFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.gold,
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
      marginBottom: 4,
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
    centerIcon: {
      alignSelf: "center",
      marginBottom: 10,
    },
    resultTitle: {
      fontFamily: "Georgia",
      fontSize: 22,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: 10,
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
      marginTop: 12,
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
      marginBottom: 4,
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
  });
