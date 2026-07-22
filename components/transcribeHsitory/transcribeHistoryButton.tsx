import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions } from "react-native";
import PlatformIcon from "../platformIcon/platformIcon";
import { useThemeColors } from "../../hooks/useThemeColors";
import type { ThemeColors } from "../../constants/Colors";

interface TranscribeHistoryButtonProps {
  onPress?: () => void;
}

export default function TranscribeHistoryButton({
  onPress,
}: TranscribeHistoryButtonProps) {
  // Grab the window dimensions to handle tablet scaling fluidly
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
      <PlatformIcon
        ios="clock.arrow.circlepath"
        name="history"
        color={colors.textPrimary} // Deep charcoal matching the icon outline
        size={isTablet ? 18 : 15}
      />

      {/* BUTTON LABEL */}
      <Text style={[styles.buttonText, { fontSize: isTablet ? 16 : 14 }]}>
        History
      </Text>
    </Pressable>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    buttonBase: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6, // Keeps explicit visual space between icon and text layout
      borderWidth: 1,
      borderColor: colors.border, // Soft muted border profile token
      backgroundColor: colors.bg, // Cream matching your primary interface background color
    },
    buttonText: {
      color: colors.blue, // Elegant blue shade pulled directly from text layout properties
      fontWeight: "500",
    },
  });
