import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import PlatformIcon from "../platformIcon/platformIcon";

type ChatHistoryButtonProps = {
  onHistoryPress?: () => void;
  onNewPress?: () => void;
};

export default function ChatHistoryButton({
  onHistoryPress,
  onNewPress,
}: ChatHistoryButtonProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
        <PlatformIcon
          ios="clock.arrow.trianglehead.counterclockwise.rotate.90"
          name="history"
          color={colors.textPrimary}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  buttonPressed: {
    opacity: 0.72,
  },
  plus: {
    fontSize: 13,
    lineHeight: 14,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  buttonText: {
    color: colors.textPrimary,
    fontSize: 11,
    lineHeight: 12,
    letterSpacing: 0.8,
    fontWeight: "600",
  },
  });
