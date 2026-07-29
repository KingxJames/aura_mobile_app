import { useRouter } from "expo-router";
import { Users } from "lucide-react-native";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useDispatch } from "react-redux";
import { markStudyPromptSeen } from "../../store/features/appUiSlice";
import { useThemeColors } from "../../hooks/useThemeColors";
import type { ThemeColors } from "../../constants/Colors";

type StudyPromptModalProps = {
  onRequestClose: () => void;
};

export default function StudyPromptModal({
  onRequestClose,
}: StudyPromptModalProps) {
  const router = useRouter();
  const dispatch = useDispatch();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const dismiss = () => {
    dispatch(markStudyPromptSeen());
    onRequestClose();
  };

  const handleLearnMore = () => {
    dismiss();
    router.push("/study-consent");
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Users size={22} color={colors.ink} />
      </View>

      <Text style={styles.title}>Help Improve Aura</Text>
      <Text style={styles.body}>
        We&apos;re running an optional research study on AI-assisted practice
        feedback. Interested in taking part?
      </Text>

      <Pressable
        onPress={handleLearnMore}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.primaryButtonPressed,
        ]}
      >
        <Text style={styles.primaryButtonText}>Learn more</Text>
      </Pressable>

      <Pressable
        onPress={dismiss}
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={styles.secondaryButtonText}>Maybe later</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      width: "100%",
      maxWidth: 340,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      padding: 24,
      alignItems: "center",
    },
    iconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
    },
    title: {
      fontFamily: "Georgia",
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
      marginBottom: 8,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 20,
    },
    primaryButton: {
      width: "100%",
      borderRadius: 8,
      backgroundColor: colors.ink,
      paddingVertical: 14,
      alignItems: "center",
      marginBottom: 10,
    },
    primaryButtonPressed: {
      opacity: 0.9,
    },
    primaryButtonText: {
      color: colors.onInk,
      fontSize: 15,
      fontWeight: "700",
    },
    secondaryButton: {
      paddingVertical: 8,
      alignItems: "center",
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },
  });
