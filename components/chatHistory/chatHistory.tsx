import type { TutorConversationSummary } from "@/store/services/tutorAPI";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";
import React, { useMemo } from "react";
import {
    ActivityIndicator,
    Animated,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

type ChatHistoryProps = {
  conversations: TutorConversationSummary[];
  isLoading?: boolean;
  activeConversationId?: string | null;
  deletingConversationId?: string | null;
  onClose: () => void;
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
};

type ConversationRowProps = {
  conversation: TutorConversationSummary;
  isActive: boolean;
  isDeleting: boolean;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  styles: ReturnType<typeof createStyles>;
};

const formatTimestamp = (isoTime: string) => {
  const date = new Date(isoTime);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

function ConversationRow({
  conversation,
  isActive,
  isDeleting,
  onSelectConversation,
  onDeleteConversation,
  styles,
}: ConversationRowProps) {
  const translateX = React.useRef(new Animated.Value(0)).current;

  const resetPosition = React.useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 24,
    }).start();
  }, [translateX]);

  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
      onPanResponderMove: (_, gestureState) => {
        const clamped = Math.max(0, Math.min(gestureState.dx, 84));
        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (!isDeleting && gestureState.dx >= 64) {
          resetPosition();
          onDeleteConversation(conversation.conversation_id);
          return;
        }

        resetPosition();
      },
      onPanResponderTerminate: resetPosition,
    }),
  ).current;

  return (
    <Animated.View
      style={{ transform: [{ translateX }] }}
      {...panResponder.panHandlers}
    >
      <Pressable
        onPress={() => onSelectConversation(conversation.conversation_id)}
        style={({ pressed }) => [
          styles.chatRow,
          isActive && styles.chatRowActive,
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Open ${conversation.title}`}
      >
        <View style={styles.chatRowInner}>
          <View style={styles.chatTextWrap}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {conversation.title || "Untitled conversation"}
            </Text>
            <Text style={styles.chatMeta}>
              {formatTimestamp(
                conversation.updated_at || conversation.created_at,
              )}
            </Text>
          </View>

          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onDeleteConversation(conversation.conversation_id);
            }}
            disabled={isDeleting}
            style={({ pressed }) => [
              styles.deleteButton,
              isDeleting && styles.deleteButtonDisabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${conversation.title}`}
          >
            <Text style={styles.deleteText}>{isDeleting ? "..." : "x"}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function ChatHistory({
  conversations,
  isLoading = false,
  activeConversationId = null,
  deletingConversationId = null,
  onClose,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
}: ChatHistoryProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Conversations</Text>
          <Text style={styles.subtitle}>Your past chats with AURA.</Text>
        </View>

        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Close conversations"
        >
          <Text style={styles.closeText}>x</Text>
        </Pressable>
      </View>

      <Pressable
        onPress={onNewChat}
        style={({ pressed }) => [
          styles.newChatButton,
          pressed && styles.newChatButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Start new chat"
      >
        <Text style={styles.newChatText}>+ New chat</Text>
      </Pressable>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.textSecondary} />
            <Text style={styles.stateText}>Loading conversations...</Text>
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.stateText}>No past conversations yet.</Text>
          </View>
        ) : (
          conversations.map((conversation) => {
            const isActive =
              activeConversationId === conversation.conversation_id;
            const isDeleting =
              deletingConversationId === conversation.conversation_id;
            return (
              <ConversationRow
                key={conversation.conversation_id}
                conversation={conversation}
                isActive={isActive}
                isDeleting={isDeleting}
                onSelectConversation={onSelectConversation}
                onDeleteConversation={onDeleteConversation}
                styles={styles}
              />
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 34,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 14,
  },
  closeButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  closeText: {
    fontSize: 30,
    lineHeight: 30,
    color: colors.textSecondary,
  },
  newChatButton: {
    marginTop: 4,
    marginBottom: 14,
    height: 36,
    borderRadius: 6,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  newChatButtonPressed: {
    opacity: 0.82,
  },
  newChatText: {
    color: colors.onInk,
    fontWeight: "600",
    fontSize: 12,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
    gap: 2,
  },
  chatRow: {
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 8,
  },
  chatRowInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  chatTextWrap: {
    flex: 1,
  },
  chatRowActive: {
    backgroundColor: colors.surfaceAlt,
  },
  chatTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
  },
  chatMeta: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  deleteButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteText: {
    fontSize: 12,
    lineHeight: 12,
    color: colors.textMuted,
    fontWeight: "700",
  },
  centerState: {
    marginTop: 16,
    alignItems: "center",
    gap: 10,
  },
  stateText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  pressed: {
    opacity: 0.75,
  },
  });
