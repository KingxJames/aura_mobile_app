import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Markdown from "react-native-markdown-display";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Play } from "lucide-react-native";
import NoteGlyph, {
    ARTICULATION_LABELS,
    DEFAULT_PITCH,
    DYNAMIC_LABELS,
    NOTE_DURATION_BEATS,
    NOTE_LABELS,
    ORNAMENT_LABELS,
    REST_LABELS,
} from "@/components/tutor/NoteGlyph";
import NoteSequence, { type SequenceToken } from "@/components/tutor/NoteSequence";
import IntervalGlyph, { intervalLabel } from "@/components/tutor/IntervalGlyph";
import ChordGlyph, { chordLabel } from "@/components/tutor/ChordGlyph";
import CadenceGlyph, { cadenceLabel } from "@/components/tutor/CadenceGlyph";
import { useThemeColors } from "@/hooks/useThemeColors";
import {
    playTutorCadence,
    playTutorChord,
    playTutorInterval,
    playTutorOrnamentedNote,
    playTutorSequence,
} from "@/lib/audioSynth";
import { parseTutorContent } from "@/lib/tutorContent";
import ChatHistoryButton from "./../../components/chatHistory/chatHistoryButton";

// 💡 IMPORT YOUR NEW CHAT HISTORY PANEL COMPONENT
import ChatHistory from "./../../components/chatHistory/chatHistory";

// Import hooks generated from your tutorApi file
import {
    useDeleteConversationMutation,
    useGetTutorConversationsQuery,
    useGetTutorHistoryQuery,
    useSendTutorMessageMutation,
} from "./../../store/services/tutorAPI";

const STORAGE_KEY = "@aura_active_conversation_id";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

type PendingExchange = {
  user: string;
  assistant: string | null;
};

const TUTOR_MESSAGE_WRAPPER = {
  start: "<aura_tutor_instructions>",
  end: "</aura_tutor_instructions>",
  questionStart: "<student_question>",
  questionEnd: "</student_question>",
} as const;

// The [[note:...]] tag contract (format, allowed keys, when to use it) is
// defined once, server-side, in aura-backend's TutorController::chat
// $systemPrompt - it used to be duplicated here too, out of sync with what
// the backend actually told Gemini, which is how the tag and the "never use
// markdown images" instruction ended up contradicting each other.
const buildTutorMessage = (studentQuestion: string) => {
  const systemInstruction = [
    "You are AURA, a supportive music tutor.",
    "Answer the student's latest question directly in your first sentence.",
    "Do not add identity disclaimers or talk about being an AI unless explicitly asked.",
    "When the question asks what to learn next, provide a concrete practice plan with clear steps.",
    "Keep responses clear, practical, and focused on music learning.",
  ].join(" ");

  return [
    TUTOR_MESSAGE_WRAPPER.start,
    systemInstruction,
    TUTOR_MESSAGE_WRAPPER.end,
    TUTOR_MESSAGE_WRAPPER.questionStart,
    studentQuestion,
    TUTOR_MESSAGE_WRAPPER.questionEnd,
  ].join("\n");
};

const extractStudentQuestion = (message: string) => {
  const startToken = TUTOR_MESSAGE_WRAPPER.questionStart;
  const endToken = TUTOR_MESSAGE_WRAPPER.questionEnd;
  const start = message.indexOf(startToken);
  const end = message.indexOf(endToken);

  if (start === -1 || end === -1 || end <= start) {
    return message;
  }

  return message.slice(start + startToken.length, end).trim();
};

// Shared by the note and sequence captions below - describes a key/time
// signature as trailing text, e.g. ", 3 sharps, 3/4 time".
const describeKeyAndTime = (
  keySignature?: number,
  timeSignature?: { numerator: string; denominator: string },
) => {
  const parts: string[] = [];
  if (keySignature) {
    const n = Math.abs(keySignature);
    parts.push(`${n} ${keySignature > 0 ? "sharp" : "flat"}${n === 1 ? "" : "s"}`);
  }
  if (timeSignature) {
    parts.push(`${timeSignature.numerator}/${timeSignature.denominator} time`);
  }
  return parts;
};

// A tied token's sound continues into the next token rather than re-attacking,
// so consecutive tied tokens collapse into one sustained playback note with
// their durations summed (tutorContent.ts's parser already guarantees a tied
// run shares one pitch, so only the run's total length needs computing here).
// Triplet tokens each take 2/3 of their written duration (3 in the time of 2).
const sequenceTokenBeats = (token: SequenceToken) =>
  NOTE_DURATION_BEATS[token.type] * (token.dotted ? 1.5 : 1) * (token.triplet ? 2 / 3 : 1);

const sequenceToPlaybackNotes = (
  tokens: SequenceToken[],
): { pitch: string | null; durationBeats: number }[] => {
  const notes: { pitch: string | null; durationBeats: number }[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token.rest) {
      notes.push({ pitch: null, durationBeats: sequenceTokenBeats(token) });
      i++;
      continue;
    }
    let totalBeats = sequenceTokenBeats(token);
    let j = i;
    while (true) {
      const current = tokens[j];
      if (current.rest || !current.tied || j + 1 >= tokens.length) break;
      j++;
      totalBeats += sequenceTokenBeats(tokens[j]);
    }
    notes.push({ pitch: token.pitch, durationBeats: totalBeats });
    i = j + 1;
  }
  return notes;
};

export default function TutorScreen() {
  const colors = useThemeColors();
  const [inputText, setInputText] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStorageLoading, setIsStorageLoading] = useState(true);
  const [pendingExchange, setPendingExchange] =
    useState<PendingExchange | null>(null);

  // 💡 STATE CONTROLS FOR SIDEBAR OVERLAY
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Keyed by `${messageId}-${segmentIndex}` so only the tapped note shows a
  // spinner and every other play button in the thread disables while it rings out.
  const [playingNoteKey, setPlayingNoteKey] = useState<string | null>(null);

  const handlePlayNote = async (
    key: string,
    pitch: string,
    durationBeats: number,
    ornament?: "fermata" | "trill" | "turn" | "mordent",
    keySignature: number = 0,
  ) => {
    if (playingNoteKey) return;
    setPlayingNoteKey(key);
    try {
      await playTutorOrnamentedNote(pitch, durationBeats, ornament, keySignature);
    } catch (e) {
      console.error("Failed to play tutor note:", e);
    } finally {
      setPlayingNoteKey(null);
    }
  };

  const handlePlaySequence = async (key: string, tokens: SequenceToken[]) => {
    if (playingNoteKey) return;
    setPlayingNoteKey(key);
    try {
      await playTutorSequence(sequenceToPlaybackNotes(tokens));
    } catch (e) {
      console.error("Failed to play tutor sequence:", e);
    } finally {
      setPlayingNoteKey(null);
    }
  };

  const handlePlayInterval = async (
    key: string,
    pitch1: string,
    pitch2: string,
    intervalType: "harmonic" | "melodic",
  ) => {
    if (playingNoteKey) return;
    setPlayingNoteKey(key);
    try {
      await playTutorInterval(pitch1, pitch2, intervalType, NOTE_DURATION_BEATS.quarter);
    } catch (e) {
      console.error("Failed to play tutor interval:", e);
    } finally {
      setPlayingNoteKey(null);
    }
  };

  const handlePlayChord = async (key: string, pitches: string[]) => {
    if (playingNoteKey) return;
    setPlayingNoteKey(key);
    try {
      await playTutorChord(pitches, NOTE_DURATION_BEATS.quarter);
    } catch (e) {
      console.error("Failed to play tutor chord:", e);
    } finally {
      setPlayingNoteKey(null);
    }
  };

  const handlePlayCadence = async (key: string, chords: string[][]) => {
    if (playingNoteKey) return;
    setPlayingNoteKey(key);
    try {
      await playTutorCadence(chords, NOTE_DURATION_BEATS.quarter);
    } catch (e) {
      console.error("Failed to play tutor cadence:", e);
    } finally {
      setPlayingNoteKey(null);
    }
  };

  const flatListRef = useRef<FlatList>(null);

  // Load conversation ID on mount
  useEffect(() => {
    const loadSavedConversation = async () => {
      try {
        const savedId = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedId) {
          setConversationId(savedId);
        }
      } catch (e) {
        console.error("Failed to load saved chat reference ID:", e);
      } finally {
        setIsStorageLoading(false);
      }
    };
    loadSavedConversation();
  }, []);

  // Save conversation ID when it changes
  const updateConversationId = async (id: string | null) => {
    setConversationId(id);
    try {
      if (id) {
        await AsyncStorage.setItem(STORAGE_KEY, id);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error("Failed to persist chat reference ID:", e);
    }
  };

  const { data: fetchedLogs = [], isFetching: isHistoryLoading } =
    useGetTutorHistoryQuery(
      { conversationId },
      { skip: isStorageLoading || !conversationId },
    );

  // 💡 FIX: Force the chat feed to be empty if conversationId is null!
  const historyLogs = conversationId ? fetchedLogs : [];

  // 💡 2. FETCH ALL PAST THREAD SUMMARIES FOR THE SIDE PANEL
  const { data: conversationsList = [], isLoading: isListLoading } =
    useGetTutorConversationsQuery();

  // 3. SEND MESSAGE MUTATION
  const [sendTutorMessage, { isLoading: isSending }] =
    useSendTutorMessageMutation();

  // 💡 4. DELETE THREAD MUTATION
  const [deleteConversation, { isLoading: isDeleting }] =
    useDeleteConversationMutation();

  const handleHistoryPress = () => {
    setIsHistoryOpen(true); // Open history pane drawer layout
  };

  const handleNewPress = () => {
    // 1. Wipe the conversation ID tracking from both local state and AsyncStorage
    updateConversationId(null);

    // 2. Clear out any text left over in the user input bar
    setInputText("");
    setPendingExchange(null);

    // 3. Close the history panel drawer so the user sees the fresh screen
    setIsHistoryOpen(false);

    console.log(
      "Resetting conversation context to start a brand clean session.",
    );
  };

  const handleSelectConversation = (id: string) => {
    updateConversationId(id);
    setPendingExchange(null);
    setIsHistoryOpen(false); // Close sidebar view when thread selected
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation({
        conversationId: id,
      }).unwrap();
      if (conversationId === id) {
        updateConversationId(null); // Clear out lookahead frame if active thread killed
      }
    } catch (error) {
      Alert.alert("Error", "Could not delete conversation.");
    }
  };

  const handleSendMessage = async () => {
    if (inputText.trim().length === 0 || isSending) return;

    const userMessage = inputText.trim();
    const wrappedUserMessage = buildTutorMessage(userMessage);
    setInputText("");
    // Show the user's message immediately, followed by a "thinking" bubble,
    // instead of waiting for the whole round trip before anything appears.
    setPendingExchange({ user: userMessage, assistant: null });

    try {
      const payload = await sendTutorMessage({
        message: wrappedUserMessage,
        ...(conversationId && { conversation_id: conversationId }),
      }).unwrap();

      if (payload.success) {
        setPendingExchange({ user: userMessage, assistant: payload.response });
        await updateConversationId(payload.conversation_id);
      }
    } catch (error: any) {
      console.error("RTK Query Chat Dispatch Error:", error);
      setPendingExchange(null);
      setInputText(userMessage);
      Alert.alert("Error", "Couldn't send your message. Please try again.");
    }
  };

  const welcomeMessage =
    "Welcome to AURA. Ask me anything about music theory — intervals, key signatures, rhythm — or pick a lesson from the curriculum and we'll work through it together.";

  // Once the invalidated history query refetches and already contains our
  // optimistic exchange, drop the local copies so nothing renders twice.
  const lastHistoryItem = historyLogs[historyLogs.length - 1];
  const pendingSynced =
    !!pendingExchange?.assistant &&
    lastHistoryItem?.content === pendingExchange.assistant &&
    lastHistoryItem?.message_type === "ai";

  const pendingItems =
    pendingExchange && !pendingSynced
      ? [
          {
            id: "pending-user",
            message_type: "user",
            content: pendingExchange.user,
          },
          pendingExchange.assistant
            ? {
                id: "pending-assistant",
                message_type: "ai",
                content: pendingExchange.assistant,
              }
            : { id: "pending-typing", message_type: "ai", content: null },
        ]
      : [];

  const chatFeedData = [
    { id: "welcome-card", role: "assistant", content: welcomeMessage },
    ...historyLogs,
    ...pendingItems,
  ];

  const showSpinner = isStorageLoading || isHistoryLoading;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        {/* MAIN CONVERSATION SCREEN CONTAINER */}
        <View
          style={{
            flex: 1,
            paddingTop: 100,
            paddingHorizontal: 24,
            paddingBottom: 84,
            alignItems: "center",
          }}
        >
          {/* ACTION CONTROLS */}
          <View style={{ width: "100%", maxWidth: 680, marginBottom: 20 }}>
            <ChatHistoryButton
              onHistoryPress={handleHistoryPress}
              onNewPress={handleNewPress}
            />
          </View>

          {/* CHAT DISPLAY ASSISTANT CONTAINER */}
          <View
            style={{
              flex: 1,
              width: "100%",
              maxWidth: 680,
              backgroundColor: "transparent",
              borderColor: colors.border,
              borderRadius: 20,
              padding: 16,
              justifyContent: showSpinner ? "center" : "flex-start",
            }}
          >
            {showSpinner ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <FlatList
                ref={flatListRef}
                data={chatFeedData}
                keyExtractor={(item, index) =>
                  item.id?.toString() || index.toString()
                }
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() =>
                  flatListRef.current?.scrollToEnd({ animated: true })
                }
                renderItem={({ item }) => {
                  const isUser =
                    item.role === "user" ||
                    item.sender === "user" ||
                    item.message_type === "user";
                  const isTyping = item.id === "pending-typing";

                  return (
                    <Animated.View
                      entering={FadeInUp.duration(220).springify().damping(18)}
                      style={{
                        alignSelf: isUser ? "flex-end" : "flex-start",
                        backgroundColor: isUser ? colors.ink : "transparent",
                        borderWidth: isUser ? 0 : 1,
                        borderColor: colors.border,
                        borderRadius: 20,
                        paddingHorizontal: 20,
                        paddingVertical: 14,
                        marginBottom: 16,
                        maxWidth: "85%",
                      }}
                    >
                      {isTyping ? (
                        <ActivityIndicator size="small" color={colors.textMuted} />
                      ) : isUser ? (
                        <Text
                          style={{
                            fontSize: 15,
                            lineHeight: 24,
                            color: colors.onInk,
                          }}
                        >
                          {extractStudentQuestion(item.content)}
                        </Text>
                      ) : (
                        parseTutorContent(item.content).map((segment, index) => {
                          if (segment.type === "text") {
                            // Defends against a real failure mode: when the tutor puts
                            // a [[note:...]]/[[sequence:...]] tag inside a markdown list
                            // item ("- [[sequence:...]]"), the tag is extracted into its
                            // own segment and the leftover bare "-"/"*" renders as an
                            // orphaned empty bullet. The system prompt tells Gemini not
                            // to do this, but LLM instruction-following isn't guaranteed,
                            // so treat a bare list marker the same as a blank segment.
                            const trimmed = segment.value.trim();
                            const isBlank = trimmed.length === 0 || /^[-*•]$/.test(trimmed);
                            return !isBlank ? (
                              <Markdown
                                key={index}
                                style={{
                                  body: {
                                    fontSize: 15,
                                    lineHeight: 24,
                                    color: colors.textPrimary,
                                  },
                                  heading3: {
                                    fontSize: 18,
                                    fontWeight: "bold",
                                    color: colors.textPrimary,
                                  },
                                  strong: { fontWeight: "700" },
                                }}
                                rules={{
                                  image: () => null,
                                  image_inline: () => null,
                                }}
                              >
                                {segment.value}
                              </Markdown>
                            ) : null;
                          }

                          if (segment.type === "sequence") {
                            const sequenceKey = `${item.id}-${index}`;
                            const isPlayingThisSequence = playingNoteKey === sequenceKey;
                            const sequenceCaptionParts = describeKeyAndTime(
                              segment.keySignature,
                              segment.timeSignature,
                            );

                            return (
                              <View
                                key={index}
                                style={{ alignItems: "center", marginVertical: 12 }}
                              >
                                <NoteSequence
                                  tokens={segment.tokens}
                                  clef={segment.clef}
                                  keySignature={segment.keySignature}
                                  timeSignature={segment.timeSignature}
                                  color={colors.textPrimary}
                                />
                                {sequenceCaptionParts.length > 0 && (
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: colors.textMuted,
                                      marginTop: 4,
                                    }}
                                  >
                                    {sequenceCaptionParts.join(", ")}
                                  </Text>
                                )}
                                {segment.play && (
                                  <Pressable
                                    onPress={() => handlePlaySequence(sequenceKey, segment.tokens)}
                                    disabled={!!playingNoteKey}
                                    accessibilityRole="button"
                                    accessibilityLabel="Play phrase"
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 6,
                                      marginTop: 8,
                                      paddingHorizontal: 14,
                                      paddingVertical: 8,
                                      borderRadius: 999,
                                      borderWidth: 1,
                                      borderColor: colors.border,
                                      opacity:
                                        playingNoteKey && !isPlayingThisSequence ? 0.4 : 1,
                                    }}
                                  >
                                    {isPlayingThisSequence ? (
                                      <ActivityIndicator
                                        size="small"
                                        color={colors.textMuted}
                                      />
                                    ) : (
                                      <Play size={13} color={colors.textPrimary} />
                                    )}
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        color: colors.textPrimary,
                                        fontWeight: "600",
                                      }}
                                    >
                                      {isPlayingThisSequence ? "Playing…" : "Play phrase"}
                                    </Text>
                                  </Pressable>
                                )}
                              </View>
                            );
                          }

                          if (segment.type === "interval") {
                            const intervalKey = `${item.id}-${index}`;
                            const isPlayingThisInterval = playingNoteKey === intervalKey;
                            const intervalCaptionParts = describeKeyAndTime(
                              segment.keySignature,
                              segment.timeSignature,
                            );

                            return (
                              <View
                                key={index}
                                style={{ alignItems: "center", marginVertical: 12 }}
                              >
                                <IntervalGlyph
                                  pitch1={segment.pitch1}
                                  pitch2={segment.pitch2}
                                  intervalType={segment.intervalType}
                                  clef={segment.clef}
                                  keySignature={segment.keySignature}
                                  timeSignature={segment.timeSignature}
                                  color={colors.textPrimary}
                                />
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: colors.textMuted,
                                    marginTop: 4,
                                  }}
                                >
                                  {intervalLabel(segment.pitch1, segment.pitch2)} — {segment.pitch1} to {segment.pitch2}
                                  {segment.intervalType === "harmonic" ? " (harmonic)" : " (melodic)"}
                                  {intervalCaptionParts.map((part) => `, ${part}`).join("")}
                                </Text>
                                {segment.play && (
                                  <Pressable
                                    onPress={() =>
                                      handlePlayInterval(
                                        intervalKey,
                                        segment.pitch1,
                                        segment.pitch2,
                                        segment.intervalType,
                                      )
                                    }
                                    disabled={!!playingNoteKey}
                                    accessibilityRole="button"
                                    accessibilityLabel="Play interval"
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 6,
                                      marginTop: 8,
                                      paddingHorizontal: 14,
                                      paddingVertical: 8,
                                      borderRadius: 999,
                                      borderWidth: 1,
                                      borderColor: colors.border,
                                      opacity:
                                        playingNoteKey && !isPlayingThisInterval ? 0.4 : 1,
                                    }}
                                  >
                                    {isPlayingThisInterval ? (
                                      <ActivityIndicator
                                        size="small"
                                        color={colors.textMuted}
                                      />
                                    ) : (
                                      <Play size={13} color={colors.textPrimary} />
                                    )}
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        color: colors.textPrimary,
                                        fontWeight: "600",
                                      }}
                                    >
                                      {isPlayingThisInterval ? "Playing…" : "Play interval"}
                                    </Text>
                                  </Pressable>
                                )}
                              </View>
                            );
                          }

                          if (segment.type === "chord") {
                            const chordKey = `${item.id}-${index}`;
                            const isPlayingThisChord = playingNoteKey === chordKey;
                            const chordCaptionParts = describeKeyAndTime(
                              segment.keySignature,
                              segment.timeSignature,
                            );

                            return (
                              <View
                                key={index}
                                style={{ alignItems: "center", marginVertical: 12 }}
                              >
                                <ChordGlyph
                                  pitches={segment.pitches}
                                  clef={segment.clef}
                                  keySignature={segment.keySignature}
                                  timeSignature={segment.timeSignature}
                                  color={colors.textPrimary}
                                />
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: colors.textMuted,
                                    marginTop: 4,
                                  }}
                                >
                                  {chordLabel(segment.pitches)}
                                  {chordCaptionParts.map((part) => `, ${part}`).join("")}
                                </Text>
                                {segment.play && (
                                  <Pressable
                                    onPress={() => handlePlayChord(chordKey, segment.pitches)}
                                    disabled={!!playingNoteKey}
                                    accessibilityRole="button"
                                    accessibilityLabel="Play chord"
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 6,
                                      marginTop: 8,
                                      paddingHorizontal: 14,
                                      paddingVertical: 8,
                                      borderRadius: 999,
                                      borderWidth: 1,
                                      borderColor: colors.border,
                                      opacity:
                                        playingNoteKey && !isPlayingThisChord ? 0.4 : 1,
                                    }}
                                  >
                                    {isPlayingThisChord ? (
                                      <ActivityIndicator
                                        size="small"
                                        color={colors.textMuted}
                                      />
                                    ) : (
                                      <Play size={13} color={colors.textPrimary} />
                                    )}
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        color: colors.textPrimary,
                                        fontWeight: "600",
                                      }}
                                    >
                                      {isPlayingThisChord ? "Playing…" : "Play chord"}
                                    </Text>
                                  </Pressable>
                                )}
                              </View>
                            );
                          }

                          if (segment.type === "cadence") {
                            const cadenceKey = `${item.id}-${index}`;
                            const isPlayingThisCadence = playingNoteKey === cadenceKey;
                            const cadenceKeySignature = segment.keySignature ?? 0;
                            const cadenceCaptionParts = describeKeyAndTime(
                              segment.keySignature,
                              segment.timeSignature,
                            );

                            return (
                              <View
                                key={index}
                                style={{ alignItems: "center", marginVertical: 12 }}
                              >
                                <CadenceGlyph
                                  chords={segment.chords}
                                  clef={segment.clef}
                                  keySignature={segment.keySignature}
                                  timeSignature={segment.timeSignature}
                                  color={colors.textPrimary}
                                />
                                <Text
                                  style={{
                                    fontSize: 12,
                                    color: colors.textMuted,
                                    marginTop: 4,
                                  }}
                                >
                                  {cadenceLabel(segment.chords, cadenceKeySignature)}
                                  {cadenceCaptionParts.map((part) => `, ${part}`).join("")}
                                </Text>
                                {segment.play && (
                                  <Pressable
                                    onPress={() => handlePlayCadence(cadenceKey, segment.chords)}
                                    disabled={!!playingNoteKey}
                                    accessibilityRole="button"
                                    accessibilityLabel="Play cadence"
                                    style={{
                                      flexDirection: "row",
                                      alignItems: "center",
                                      gap: 6,
                                      marginTop: 8,
                                      paddingHorizontal: 14,
                                      paddingVertical: 8,
                                      borderRadius: 999,
                                      borderWidth: 1,
                                      borderColor: colors.border,
                                      opacity:
                                        playingNoteKey && !isPlayingThisCadence ? 0.4 : 1,
                                    }}
                                  >
                                    {isPlayingThisCadence ? (
                                      <ActivityIndicator
                                        size="small"
                                        color={colors.textMuted}
                                      />
                                    ) : (
                                      <Play size={13} color={colors.textPrimary} />
                                    )}
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        color: colors.textPrimary,
                                        fontWeight: "600",
                                      }}
                                    >
                                      {isPlayingThisCadence ? "Playing…" : "Play cadence"}
                                    </Text>
                                  </Pressable>
                                )}
                              </View>
                            );
                          }

                          const noteClef = segment.clef ?? "treble";
                          const notePitch = segment.pitch ?? DEFAULT_PITCH[noteClef];
                          const noteKey = `${item.id}-${index}`;
                          const isPlayingThisNote = playingNoteKey === noteKey;

                          return (
                            <View
                              key={index}
                              style={{ alignItems: "center", marginVertical: 12 }}
                            >
                              <NoteGlyph
                                type={segment.value}
                                pitch={segment.pitch}
                                clef={segment.clef}
                                rest={segment.rest}
                                dotted={segment.dotted}
                                artic={segment.artic}
                                dynamic={segment.dynamic}
                                ornament={segment.ornament}
                                keySignature={segment.keySignature}
                                timeSignature={segment.timeSignature}
                                color={colors.textPrimary}
                              />
                              <Text
                                style={{
                                  fontSize: 12,
                                  color: colors.textMuted,
                                  marginTop: 4,
                                }}
                              >
                                {segment.dotted ? "Dotted " : ""}
                                {segment.rest ? REST_LABELS[segment.value] : NOTE_LABELS[segment.value]}
                                {!segment.rest && segment.pitch ? ` — ${segment.pitch}` : ""}
                                {!segment.rest && segment.artic ? `, ${ARTICULATION_LABELS[segment.artic]}` : ""}
                                {!segment.rest && segment.dynamic ? `, ${DYNAMIC_LABELS[segment.dynamic]}` : ""}
                                {!segment.rest && segment.ornament ? `, ${ORNAMENT_LABELS[segment.ornament]}` : ""}
                                {describeKeyAndTime(segment.keySignature, segment.timeSignature)
                                  .map((part) => `, ${part}`)
                                  .join("")}
                              </Text>
                              {segment.play && !segment.rest && (
                                <Pressable
                                  onPress={() =>
                                    handlePlayNote(
                                      noteKey,
                                      notePitch,
                                      NOTE_DURATION_BEATS[segment.value] * (segment.dotted ? 1.5 : 1),
                                      segment.ornament,
                                      segment.keySignature ?? 0,
                                    )
                                  }
                                  disabled={!!playingNoteKey}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Play ${notePitch}`}
                                  style={{
                                    flexDirection: "row",
                                    alignItems: "center",
                                    gap: 6,
                                    marginTop: 8,
                                    paddingHorizontal: 14,
                                    paddingVertical: 8,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    opacity:
                                      playingNoteKey && !isPlayingThisNote ? 0.4 : 1,
                                  }}
                                >
                                  {isPlayingThisNote ? (
                                    <ActivityIndicator
                                      size="small"
                                      color={colors.textMuted}
                                    />
                                  ) : (
                                    <Play size={13} color={colors.textPrimary} />
                                  )}
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: colors.textPrimary,
                                      fontWeight: "600",
                                    }}
                                  >
                                    {isPlayingThisNote ? "Playing…" : "Play note"}
                                  </Text>
                                </Pressable>
                              )}
                            </View>
                          );
                        })
                      )}
                    </Animated.View>
                  );
                }}
              />
            )}
          </View>

          {/* BOTTOM INPUT FOOTER */}
          <View style={{ width: "100%", maxWidth: 680, alignItems: "center" }}>
            <View
              style={{
                width: "100%",
                height: 1,
                backgroundColor: colors.border,
                marginTop: 16,
                marginBottom: 16,
              }}
            />
            <View
              style={{
                width: "100%",
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  flex: 1,
                  height: 50,
                  borderRadius: 25,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 20,
                  justifyContent: "center",
                }}
              >
                <TextInput
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Ask AURA..."
                  placeholderTextColor={colors.textMuted}
                  editable={!isSending}
                  onSubmitEditing={handleSendMessage}
                  style={{
                    fontSize: 15,
                    color: colors.textPrimary,
                    padding: 0,
                    outlineWidth: 0,
                  }}
                />
              </View>
              <TouchableOpacity
                onPress={handleSendMessage}
                disabled={isSending || inputText.trim().length === 0}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor:
                    isSending || inputText.trim().length === 0
                      ? colors.border
                      : colors.textMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: colors.bg, fontSize: 18 }}>➔</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* SIDE PANEL DRAWER — rendered in a Modal so it overlays the header and tab bar */}
      <Modal
        transparent
        animationType="fade"
        visible={isHistoryOpen}
        onRequestClose={() => setIsHistoryOpen(false)}
      >
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={{ width: SCREEN_WIDTH * 0.8 }}>
            <ChatHistory
              conversations={conversationsList}
              isLoading={isListLoading}
              activeConversationId={conversationId}
              onClose={() => setIsHistoryOpen(false)}
              onNewChat={handleNewPress}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={handleDeleteConversation}
            />
          </View>

          {/* BACKGROUND DISMISS LAYER CLOSES THE PANEL ON CLICK */}
          <Pressable
            onPress={() => setIsHistoryOpen(false)}
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }}
          />
        </View>
      </Modal>
    </View>
  );
}
