import { SymbolView } from "expo-symbols";
import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions } from "react-native";

interface TranscribeHistoryButtonProps {
  onPress?: () => void;
}

export default function TranscribeHistoryButton({
  onPress,
}: TranscribeHistoryButtonProps) {
  // Grab the window dimensions to handle tablet scaling fluidly
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="View past transcriptions history"
      style={({ pressed }) => [
        styles.buttonBase,
        {
          paddingVertical: isTablet ? 10 : 7,
          paddingHorizontal: isTablet ? 20 : 14,
          borderRadius: isTablet ? 24 : 20,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {/* HISTORY VECTOR ICON */}
      <SymbolView
        name={{
          ios: "clock.arrow.circlepath",
          android: "history",
          web: "history",
        }}
        tintColor="#1E293B" // Deep charcoal matching the icon outline
        size={isTablet ? 18 : 15}
      />

      {/* BUTTON LABEL */}
      <Text style={[styles.buttonText, { fontSize: isTablet ? 16 : 14 }]}>
        History
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  buttonBase: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6, // Keeps explicit visual space between icon and text layout
    borderWidth: 1,
    borderColor: "#DCD5C9", // Soft muted border profile token
    backgroundColor: "#FAF6EE", // Cream matching your primary interface background color
  },
  buttonText: {
    color: "#0261FF", // Elegant blue shade pulled directly from text layout properties
    fontWeight: "500",
  },
});
