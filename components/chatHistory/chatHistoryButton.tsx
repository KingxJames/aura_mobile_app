import { SymbolView } from "expo-symbols";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type ChatHistoryButtonProps = {
  onHistoryPress?: () => void;
  onNewPress?: () => void;
};

export default function ChatHistoryButton({
  onHistoryPress,
  onNewPress,
}: ChatHistoryButtonProps) {
  return (
    <View style={styles.container}>
      <Pressable
        onPress={onHistoryPress}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="History"
      >
        <SymbolView
          name={{
            ios: "clock.arrow.trianglehead.counterclockwise.rotate.90",
            android: "history",
            web: "history",
          }}
          tintColor="#32302A"
          size={14}
        />
        <Text style={styles.buttonText}>HISTORY</Text>
      </Pressable>

      <Pressable
        onPress={onNewPress}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="New chat"
      >
        <Text style={styles.plus}>+</Text>
        <Text style={styles.buttonText}>NEW</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
  },
  button: {
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#CBC2B4",
    backgroundColor: "#F7F3EC",
  },
  buttonPressed: {
    opacity: 0.72,
  },
  plus: {
    fontSize: 13,
    lineHeight: 14,
    fontWeight: "600",
    color: "#32302A",
  },
  buttonText: {
    color: "#32302A",
    fontSize: 11,
    lineHeight: 12,
    letterSpacing: 0.8,
    fontWeight: "600",
  },
});
