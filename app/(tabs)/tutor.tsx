import React, { useState } from "react";
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import ChatHistoryButton from "./../../components/chatHistory/chatHistoryButton";

// Import hooks generated from your tutorApi file
import {
  useGetTutorHistoryQuery,
  useSendTutorMessageMutation,
} from "./../../store/services/tutorAPI"; // Adjust this relative import path to point directly to your tutorApi file

const USER_ID = 1; // Replace with your globally shared profile auth user state identifier

export default function TutorScreen() {
  const [inputText, setInputText] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);

  // 1. RTK QUERY READ HOOK: Automatically fetches historical data logs when conversationId swaps
  const {
    data: historyLogs = [],
    isFetching: isHistoryLoading
  } = useGetTutorHistoryQuery(
    { userId: USER_ID, conversationId },
    { skip: !conversationId } // Skips running network query if it's a completely new chat session
  );

  // 2. RTK QUERY MUTATION HOOK: Exposes action triggers and transmission status indicators
  const [sendTutorMessage, { isLoading: isSending }] = useSendTutorMessageMutation();

  const handleHistoryPress = () => {
    // Trigger your visual history drawer/modal layout element to open here
    console.log("History toggle tapped. Open drawer displaying past thread sessions.");
  };

  const handleNewPress = () => {
    setConversationId(null);
    setInputText("");
    console.log("Resetting conversation local state context to start clean.");
  };

  const handleSendMessage = async () => {
    if (inputText.trim().length === 0 || isSending) return;

    const userMessage = inputText.trim();
    setInputText(""); // Fast optimistic input box clearing optimization

    try {
      // unwrap() unpacks the raw backend response or throws caught errors down to catch blocks
      const payload = await sendTutorMessage({
        user_id: USER_ID,
        message: userMessage,
        ...(conversationId && { conversation_id: conversationId }), // Only appends property if it exists
      }).unwrap();

      if (payload.success) {
        setConversationId(payload.conversation_id); // Secure the conversation UUID reference key
      }
    } catch (error: any) {
      console.error("RTK Query Chat Dispatch Error:", error);
      Alert.alert("Aura Failed to Respond", error?.data?.message || "Check your local server connectivity.");
    }
  };

  // Determine the display message for your card container
  const displayMessage =
    conversationId && historyLogs.length > 0
      ? historyLogs[historyLogs.length - 1]?.content // Displays the latest conversation entry
      : "Welcome to AURA. Ask me anything about music theory — intervals, key signatures, rhythm — or pick a lesson from the curriculum and we'll work through it together.";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F4EFE6",
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
          width: "100%",
          maxWidth: 680,
          backgroundColor: "transparent",
          borderWidth: 1,
          borderColor: "#CBC2B4",
          borderRadius: 20,
          padding: 24,
          minHeight: 120,
          justifyContent: isHistoryLoading ? "center" : "flex-start",
        }}
      >
        {isHistoryLoading ? (
          <ActivityIndicator size="small" color="#9A958C" />
        ) : (
          <Text
            style={{
              fontSize: 15,
              lineHeight: 24,
              color: "#1C1B17",
              fontWeight: "400",
            }}
          >
            {displayMessage}
          </Text>
        )}
      </View>

      {/* BOTTOM CONTROL FOOTER INTERACTIVE ELEMENT */}
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
              backgroundColor: "transparent",
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
              style={{
                fontSize: 15,
                color: "#1C1B17",
                padding: 0,
              }}
            />
          </View>

          <TouchableOpacity
            onPress={handleSendMessage}
            activeOpacity={0.7}
            disabled={isSending || inputText.trim().length === 0}
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: isSending || inputText.trim().length === 0 ? "#C4BEB3" : "#9A958C",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#F4EFE6" />
            ) : (
              <View style={{ transform: [{ rotate: "45deg" }], marginTop: -2, marginLeft: -3 }}>
                <Text style={{ color: "#F4EFE6", fontSize: 18, fontWeight: "bold" }}>➔</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}