import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";
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

const USER_ID = 1;
const STORAGE_KEY = "@aura_active_conversation_id";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function TutorScreen() {
  const [inputText, setInputText] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStorageLoading, setIsStorageLoading] = useState(true);

  // 💡 STATE CONTROLS FOR SIDEBAR OVERLAY
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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
      { userId: USER_ID, conversationId },
      { skip: isStorageLoading || !conversationId },
    );

  // 💡 FIX: Force the chat feed to be empty if conversationId is null!
  const historyLogs = conversationId ? fetchedLogs : [];

  // 💡 2. FETCH ALL PAST THREAD SUMMARIES FOR THE SIDE PANEL
  const { data: conversationsList = [], isLoading: isListLoading } =
    useGetTutorConversationsQuery({ userId: USER_ID });

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

    // 3. Close the history panel drawer so the user sees the fresh screen
    setIsHistoryOpen(false);

    console.log(
      "Resetting conversation context to start a brand clean session.",
    );
  };

  const handleSelectConversation = (id: string) => {
    updateConversationId(id);
    setIsHistoryOpen(false); // Close sidebar view when thread selected
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await deleteConversation({
        userId: USER_ID,
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
    setInputText("");

    try {
      const payload = await sendTutorMessage({
        user_id: USER_ID,
        message: userMessage,
        ...(conversationId && { conversation_id: conversationId }),
      }).unwrap();

      if (payload.success) {
        await updateConversationId(payload.conversation_id);
      }
    } catch (error: any) {
      console.error("RTK Query Chat Dispatch Error:", error);
    }
  };

  const welcomeMessage =
    "Welcome to AURA. Ask me anything about music theory — intervals, key signatures, rhythm — or pick a lesson from the curriculum and we'll work through it together.";

  const chatFeedData = [
    { id: "welcome-card", role: "assistant", content: welcomeMessage },
    ...historyLogs,
  ];

  const showSpinner = isStorageLoading || isHistoryLoading;

  return (
    <View style={{ flex: 1, backgroundColor: "#F4EFE6" }}>
      {/* MAIN CONVERSATION SCREEN CONTAINER */}
      <View
        style={{
          flex: 1,
          paddingTop: 100,
          paddingHorizontal: 24,
        }}
      >
        {/* ACTION CONTROLS */}
        <View style={{ width: "100%", marginBottom: 20 }}>
          <ChatHistoryButton
            onHistoryPress={handleHistoryPress}
            onNewPress={handleNewPress}
          />
        </View>

        {/* CHAT DISPLAY ASSISTANT CONTAINER */}
        <View
          style={{
            flex: 1,
            marginBottom: 160,
            width: "100%",
            maxWidth: 680,
            backgroundColor: "transparent",
            borderColor: "#CBC2B4",
            borderRadius: 20,
            padding: 16,
            justifyContent: showSpinner ? "center" : "flex-start",
          }}
        >
          {showSpinner ? (
            <ActivityIndicator size="small" color="#9A958C" />
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

                return (
                  <View
                    style={{
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      backgroundColor: isUser ? "#1C2024" : "transparent",
                      borderWidth: isUser ? 0 : 1,
                      borderColor: "#CBC2B4",
                      borderRadius: 20,
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      marginBottom: 16,
                      maxWidth: "85%",
                    }}
                  >
                    {isUser ? (
                      <Text
                        style={{
                          fontSize: 15,
                          lineHeight: 24,
                          color: "#FFFFFF",
                        }}
                      >
                        {item.content}
                      </Text>
                    ) : (
                      <Markdown
                        style={{
                          body: {
                            fontSize: 15,
                            lineHeight: 24,
                            color: "#1C1B17",
                          },
                          heading3: {
                            fontSize: 18,
                            fontWeight: "bold",
                            color: "#1C1B17",
                          },
                          strong: { fontWeight: "700" },
                        }}
                        rules={{
                          image: () => null,
                          image_inline: () => null,
                        }}
                      >
                        {item.content}
                      </Markdown>
                    )}
                  </View>
                );
              }}
            />
          )}
        </View>

        {/* BOTTOM INPUT FOOTER */}
        <View
          style={{
            position: "absolute",
            bottom: 90,
            left: 24,
            right: 24,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: "100%",
              height: 1,
              backgroundColor: "#E2DACB",
              marginBottom: 20,
            }}
          />
          <View
            style={{
              width: "100%",
              maxWidth: 680,
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
                borderColor: "#CBC2B4",
                paddingHorizontal: 20,
                justifyContent: "center",
              }}
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask AURA..."
                placeholderTextColor="#A39A8B"
                editable={!isSending}
                onSubmitEditing={handleSendMessage}
                style={{ fontSize: 15, color: "#1C1B17", padding: 0 }}
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
                    ? "#C4BEB3"
                    : "#9A958C",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#F4EFE6", fontSize: 18 }}>➔</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 💡 SIDE PANEL DROPDOWN / OVERLAY SHEET LAYOUT */}
      {isHistoryOpen && (
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: SCREEN_WIDTH * 0.8, // Takes up 80% width profile layout
            zIndex: 999,
          }}
        >
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
      )}

      {/* BACKGROUND DISMISS LAYER CLOSES THE PANEL ON CLICK */}
      {isHistoryOpen && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsHistoryOpen(false)}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: SCREEN_WIDTH * 0.8,
            right: 0,
            backgroundColor: "rgba(0,0,0,0.3)",
            zIndex: 998,
          }}
        />
      )}
    </View>
  );
}
