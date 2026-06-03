import ChatHistory from "@/components/chatHistory/chatHistory";

import ChatHistoryButton from "@/components/chatHistory/chatHistoryButton";

import { setCurrentConversationId } from "@/store/features/tutorSlice";

import {
  useDeleteConversationMutation,
  useGetTutorConversationsQuery,
  useGetTutorHistoryQuery,
  useSendTutorMessageMutation,
} from "@/store/services/tutorAPI";

import { SymbolView } from "expo-symbols";

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useDispatch, useSelector } from "react-redux";

import type { RootState } from "../../store/store";

type MessageBlock =
  | { type: "paragraph"; text: string }
  | { type: "bullet"; text: string }
  | { type: "code"; text: string };

const parseMessageBlocks = (text: string): MessageBlock[] => {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const blocks: MessageBlock[] = [];

  let paragraphLines: string[] = [];
  let codeLines: string[] = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    const paragraph = paragraphLines.join(" ").trim();
    if (paragraph) {
      blocks.push({ type: "paragraph", text: paragraph });
    }
    paragraphLines = [];
  };

  const flushCode = () => {
    const code = codeLines.join("\n").trimEnd();
    if (code) {
      blocks.push({ type: "code", text: code });
    }
    codeLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        flushCode();
        inCodeBlock = false;
      } else {
        flushParagraph();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line.replace(/^\s+/, ""));
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (/^([*-])\s+/.test(trimmed)) {
      flushParagraph();
      blocks.push({
        type: "bullet",
        text: trimmed.replace(/^([*-])\s+/, ""),
      });
      continue;
    }

    paragraphLines.push(trimmed);
  }

  flushParagraph();

  if (inCodeBlock) {
    flushCode();
  }

  return blocks;
};

const renderInlineFormatting = (text: string) => {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*)/g;
  const segments = text.split(regex);

  segments.forEach((segment, index) => {
    if (!segment) {
      return;
    }

    if (segment.startsWith("**") && segment.endsWith("**")) {
      parts.push(
        <Text key={`${segment}-${index}`} style={{ fontWeight: "700" }}>
          {segment.slice(2, -2)}
        </Text>,
      );
      return;
    }

    parts.push(segment);
  });

  return parts;
};

const RenderMessageContent = ({
  text,
  textStyle,
}: {
  text: string;
  textStyle: object;
}) => {
  const blocks = useMemo(() => parseMessageBlocks(text), [text]);

  return (
    <View style={styles.messageContentContainer}>
      {blocks.map((block, index) => {
        if (block.type === "code") {
          return (
            <View key={`${block.type}-${index}`} style={styles.codeBlock}>
              <Text style={[styles.messageText, textStyle, styles.codeText]}>
                {block.text}
              </Text>
            </View>
          );
        }

        if (block.type === "bullet") {
          return (
            <View key={`${block.type}-${index}`} style={styles.bulletRow}>
              <Text
                style={[styles.messageText, textStyle, styles.bulletMarker]}
              >
                •
              </Text>
              <Text style={[styles.messageText, textStyle, styles.bulletText]}>
                {renderInlineFormatting(block.text)}
              </Text>
            </View>
          );
        }

        return (
          <Text
            key={`${block.type}-${index}`}
            style={[styles.messageText, textStyle, styles.paragraphText]}
          >
            {renderInlineFormatting(block.text)}
          </Text>
        );
      })}
    </View>
  );
};

export default function TutorScreen() {
  const dispatch = useDispatch();

  const insets = useSafeAreaInsets();

  const user = useSelector((state: RootState) => state.auth.user);

  const accessToken = useSelector((state: RootState) => state.auth.accessToken);

  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );

  const currentConversationId = useSelector(
    (state: RootState) => state.tutorUi.currentConversationId,
  );

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [draftMessage, setDraftMessage] = useState("");

  const [deletingConversationId, setDeletingConversationId] = useState<
    string | null
  >(null);
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [typedAiPreview, setTypedAiPreview] = useState("");
  const [typingSourceText, setTypingSourceText] = useState("");

  const scrollRef = useRef<ScrollView | null>(null);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const numericUserId = useMemo(() => {
    if (!user?.id) {
      return null;
    }

    const parsed = Number(user.id);

    return Number.isFinite(parsed) ? parsed : null;
  }, [user?.id]);

  const canUseTutorApi =
    numericUserId !== null && Boolean(accessToken) && isAuthenticated;

  const { data: conversations = [], isFetching: isFetchingConversations } =
    useGetTutorConversationsQuery(
      { userId: numericUserId ?? 0 },

      { skip: !canUseTutorApi },
    );

  const { data: historyMessages = [], isFetching: isFetchingMessages } =
    useGetTutorHistoryQuery(
      {
        userId: numericUserId ?? 0,

        conversationId: currentConversationId,
      },

      {
        skip: !canUseTutorApi || !currentConversationId,
      },
    );

  const visibleMessages = currentConversationId ? historyMessages : [];

  const [sendTutorMessage, { isLoading: isSending }] =
    useSendTutorMessageMutation();

  const [deleteConversation] = useDeleteConversationMutation();

  const clearTypingAnimation = () => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }

    setIsAiTyping(false);
  };

  const startTypingPreview = (text: string) => {
    clearTypingAnimation();

    const words = text.trim().split(/\s+/);
    if (!words.length || !words[0]) {
      setTypedAiPreview("");
      setTypingSourceText("");
      return;
    }

    setTypingSourceText(text.trim());
    setTypedAiPreview("");
    setIsAiTyping(true);

    let index = 0;
    typingIntervalRef.current = setInterval(() => {
      index += 1;

      setTypedAiPreview(words.slice(0, index).join(" "));

      if (index >= words.length) {
        clearTypingAnimation();
      }
    }, 70);
  };

  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!typingSourceText || isAiTyping) {
      return;
    }

    const hasSyncedTypedMessage = visibleMessages.some(
      (message) =>
        message.message_type === "ai" &&
        message.content.trim() === typingSourceText.trim(),
    );

    if (hasSyncedTypedMessage) {
      setTypedAiPreview("");
      setTypingSourceText("");
    }
  }, [isAiTyping, typingSourceText, visibleMessages]);

  const openHistoryPanel = () => {
    setIsHistoryOpen(true);
  };

  const closeHistoryPanel = () => {
    setIsHistoryOpen(false);
  };

  const handleNewChat = () => {
    dispatch(setCurrentConversationId(null));

    setDraftMessage("");
    setIsAwaitingResponse(false);
    setTypedAiPreview("");
    setTypingSourceText("");
    clearTypingAnimation();

    scrollRef.current?.scrollTo({ y: 0, animated: true });

    setIsHistoryOpen(false);
  };

  const handleSelectConversation = (conversationId: string) => {
    dispatch(setCurrentConversationId(conversationId));

    setIsAwaitingResponse(false);
    setTypedAiPreview("");
    setTypingSourceText("");
    clearTypingAnimation();

    setIsHistoryOpen(false);
  };

  const handleDeleteConversation = (conversationId: string) => {
    if (!canUseTutorApi || numericUserId === null || deletingConversationId) {
      return;
    }

    const deleteSelectedConversation = async () => {
      setDeletingConversationId(conversationId);

      try {
        await deleteConversation({
          userId: numericUserId,

          conversationId,
        }).unwrap();

        if (conversationId === currentConversationId) {
          dispatch(setCurrentConversationId(null));
        }
      } finally {
        setDeletingConversationId(null);
      }
    };

    void deleteSelectedConversation();
  };

  const handleSend = () => {
    const trimmed = draftMessage.trim();

    if (!trimmed || !canUseTutorApi || isSending || numericUserId === null) {
      return;
    }

    const sendMessage = async () => {
      setDraftMessage("");
      setIsAwaitingResponse(true);
      setTypedAiPreview("");
      setTypingSourceText("");
      clearTypingAnimation();

      try {
        const result = await sendTutorMessage({
          user_id: numericUserId,

          message: trimmed,

          conversation_id: currentConversationId ?? undefined,
        }).unwrap();

        if (result.conversation_id) {
          dispatch(setCurrentConversationId(result.conversation_id));
        }

        setIsAwaitingResponse(false);

        if (result.response?.trim()) {
          startTypingPreview(result.response);
        }
      } catch {
        setIsAwaitingResponse(false);
        setTypedAiPreview("");
        setTypingSourceText("");
        clearTypingAnimation();
        setDraftMessage(trimmed);
      }
    };

    void sendMessage();
  };

  return (
    <View style={styles.container}>
      <View style={styles.actionsRow}>
        <ChatHistoryButton
          onHistoryPress={openHistoryPanel}
          onNewPress={handleNewChat}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={[styles.messagesArea, { marginBottom: 74 + insets.bottom + 52 }]}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() =>
          scrollRef.current?.scrollToEnd({ animated: true })
        }
        keyboardShouldPersistTaps="handled"
      >
        {!currentConversationId && (
          <View style={styles.welcomeBubble}>
            <Text style={styles.welcomeText}>
              Welcome to AURA. Ask me anything about music theory - intervals,
              key signatures, rhythm - or pick a lesson from the curriculum and
              we&apos;ll work through it together.
            </Text>
          </View>
        )}

        {isFetchingMessages && currentConversationId ? (
          <View style={styles.centerState}>
            <ActivityIndicator color="#1D2430" />

            <Text style={styles.stateText}>Loading messages...</Text>
          </View>
        ) : (
          visibleMessages.map((message) => {
            const isUser = message.message_type === "user";

            return (
              <View
                key={message.id}
                style={[
                  styles.messageRow,

                  isUser ? styles.messageRowUser : styles.messageRowAi,
                ]}
              >
                {isUser ? (
                  <View
                    style={[styles.messageBubble, styles.messageBubbleUser]}
                  >
                    <Text style={[styles.messageText, styles.messageTextUser]}>
                      {message.content}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.messageBubble, styles.messageBubbleAi]}>
                    <RenderMessageContent
                      text={message.content}
                      textStyle={styles.messageTextAi}
                    />
                  </View>
                )}
              </View>
            );
          })
        )}

        {isAwaitingResponse && (
          <View style={[styles.messageRow, styles.messageRowAi]}>
            <View style={[styles.messageBubble, styles.messageBubbleAi]}>
              <View style={styles.typingLoaderRow}>
                <ActivityIndicator color="#1D2430" size="small" />
                <Text style={[styles.messageText, styles.messageTextAi]}>
                  AURA is typing...
                </Text>
              </View>
            </View>
          </View>
        )}

        {!!typedAiPreview && !isAwaitingResponse && (
          <View style={[styles.messageRow, styles.messageRowAi]}>
            <View style={[styles.messageBubble, styles.messageBubbleAi]}>
              <RenderMessageContent
                text={typedAiPreview}
                textStyle={styles.messageTextAi}
              />
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.composerWrap, { bottom: 74 + insets.bottom }]}>
        <View style={styles.composerRow}>
          <TextInput
            value={draftMessage}
            onChangeText={setDraftMessage}
            placeholder="Ask AURA..."
            placeholderTextColor="#8E9197"
            style={styles.input}
            accessibilityLabel="Ask Aura"
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />

          <Pressable
            onPress={handleSend}
            disabled={!draftMessage.trim() || isSending || !canUseTutorApi}
            style={({ pressed }) => [
              styles.sendButton,

              (!draftMessage.trim() || isSending || !canUseTutorApi) &&
                styles.sendButtonDisabled,

              pressed && styles.sendButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
          >
            <SymbolView
              name={{
                ios: "paperplane",

                android: "send",

                web: "send",
              }}
              tintColor="#F7F7F7"
              size={18}
            />
          </Pressable>
        </View>
      </View>

      <Modal
        transparent
        visible={isHistoryOpen}
        animationType="fade"
        onRequestClose={closeHistoryPanel}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeHistoryPanel}>
          <Pressable
            style={styles.panelContainer}
            onPress={(event) => event.stopPropagation()}
          >
            <ChatHistory
              conversations={conversations}
              isLoading={isFetchingConversations}
              activeConversationId={currentConversationId}
              deletingConversationId={deletingConversationId}
              onClose={closeHistoryPanel}
              onNewChat={handleNewChat}
              onSelectConversation={handleSelectConversation}
              onDeleteConversation={handleDeleteConversation}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,

    backgroundColor: "#F5EFE3",

    paddingTop: 96,

    paddingHorizontal: 12,

    position: "relative",
  },

  actionsRow: {
    width: "100%",

    paddingHorizontal: 2,
  },

  messagesArea: {
    flex: 1,

    width: "100%",

    marginTop: 12,
  },

  messagesContent: {
    paddingBottom: 16,

    gap: 10,
  },

  welcomeBubble: {
    maxWidth: "86%",

    borderWidth: 1,

    borderColor: "#CFC4B0",

    borderRadius: 16,

    paddingHorizontal: 16,

    paddingVertical: 14,

    backgroundColor: "#F5EFE3",
  },

  welcomeText: {
    color: "#071B3A",

    fontSize: 14,

    lineHeight: 26,

    fontFamily: "Georgia",
  },

  centerState: {
    marginTop: 20,

    alignItems: "center",

    gap: 10,
  },

  stateText: {
    color: "#5A6675",

    fontSize: 13,
  },

  messageRow: {
    width: "100%",

    flexDirection: "row",
  },

  messageRowAi: {
    justifyContent: "flex-start",
  },

  messageRowUser: {
    justifyContent: "flex-end",
  },

  messageBubble: {
    maxWidth: "86%",

    borderRadius: 16,

    paddingHorizontal: 14,

    paddingVertical: 10,

    borderWidth: 1,
  },

  messageBubbleAi: {
    backgroundColor: "#F5EFE3",

    borderColor: "#CFC4B0",
  },

  messageBubbleUser: {
    backgroundColor: "#142138",

    borderColor: "#142138",
  },

  messageText: {
    fontSize: 14,

    lineHeight: 21,
  },

  messageTextAi: {
    color: "#071B3A",
  },

  messageTextUser: {
    color: "#F5F6F8",
  },

  messageContentContainer: {
    gap: 8,
  },

  paragraphText: {
    lineHeight: 22,
  },

  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  bulletMarker: {
    width: 12,
    textAlign: "center",
    lineHeight: 22,
  },

  bulletText: {
    flex: 1,
    lineHeight: 22,
  },

  codeBlock: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D9CFBC",
    backgroundColor: "#F8F4EC",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  codeText: {
    fontFamily: "Courier New",
    fontSize: 13,
    lineHeight: 18,
  },

  typingLoaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  composerWrap: {
    position: "absolute",

    left: 12,

    right: 12,

    borderTopWidth: 1,

    borderTopColor: "#D1C5B2",

    paddingTop: 10,

    paddingBottom: 10,

    backgroundColor: "#F5EFE3",

    zIndex: 2,
  },

  composerRow: {
    width: "100%",

    flexDirection: "row",

    alignItems: "center",

    gap: 8,
  },

  input: {
    flex: 1,

    height: 40,

    borderWidth: 1,

    borderColor: "#CBC0AF",

    borderRadius: 16,

    paddingHorizontal: 16,

    color: "#1A1A1A",

    fontSize: 13,

    backgroundColor: "#F5EFE3",
  },

  sendButton: {
    width: 40,

    height: 40,

    borderRadius: 20,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: "#A2A5A7",
  },

  sendButtonDisabled: {
    opacity: 0.55,
  },

  sendButtonPressed: {
    opacity: 0.75,
  },

  modalBackdrop: {
    flex: 1,

    backgroundColor: "rgba(0, 0, 0, 0.22)",

    flexDirection: "row",
  },

  panelContainer: {
    width: "86%",

    maxWidth: 380,

    height: "100%",

    backgroundColor: "#EFEBE3",
  },
});
