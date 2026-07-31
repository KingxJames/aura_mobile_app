import {
  useGetFlowCheckinStatusQuery,
  useSubmitFlowCheckinMutation,
} from "@/store/services/flowCheckinAPI";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

const SCALE_VALUES = [1, 2, 3, 4, 5];

// Pedagogical Sub-Question 2 (flow / cognitive overload): a short, un-
// validated custom check-in (not a formal psychometric scale) - shown at
// most once per calendar day, the first time a participant finishes an
// Aural Training attempt that day. Deliberately scoped to Free Practice and
// Transcription only, not the AI Tutor chat.
export default function FlowCheckinCard() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { data: status, isLoading: isCheckingStatus } =
    useGetFlowCheckinStatusQuery();
  const [submitFlowCheckin, { isLoading: isSubmitting }] =
    useSubmitFlowCheckinMutation();

  const [absorption, setAbsorption] = useState(0);
  const [challenge, setChallenge] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isCheckingStatus || status?.done_today || submitted) {
    return null;
  }

  const handleSubmit = async () => {
    if (absorption === 0 || challenge === 0) return;

    setError(null);
    try {
      await submitFlowCheckin({
        absorption_rating: absorption,
        challenge_rating: challenge,
      }).unwrap();
      setSubmitted(true);
    } catch {
      setError("Couldn't submit that. Try again.");
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Quick check-in</Text>
      <Text style={styles.subtitle}>
        One-time, once a day - helps us understand your practice experience.
      </Text>

      <Text style={styles.question}>
        How absorbed did you feel during this session?
      </Text>
      <View style={styles.scaleRow}>
        {SCALE_VALUES.map((value) => (
          <Pressable
            key={value}
            onPress={() => setAbsorption(value)}
            style={[
              styles.scaleButton,
              absorption === value && styles.scaleButtonActive,
            ]}
          >
            <Text
              style={[
                styles.scaleButtonText,
                absorption === value && styles.scaleButtonTextActive,
              ]}
            >
              {value}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.scaleLabelsRow}>
        <Text style={styles.scaleLabel}>Not at all</Text>
        <Text style={styles.scaleLabel}>Completely</Text>
      </View>

      <Text style={styles.question}>How mentally demanding did it feel?</Text>
      <View style={styles.scaleRow}>
        {SCALE_VALUES.map((value) => (
          <Pressable
            key={value}
            onPress={() => setChallenge(value)}
            style={[
              styles.scaleButton,
              challenge === value && styles.scaleButtonActive,
            ]}
          >
            <Text
              style={[
                styles.scaleButtonText,
                challenge === value && styles.scaleButtonTextActive,
              ]}
            >
              {value}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.scaleLabelsRow}>
        <Text style={styles.scaleLabel}>Very easy</Text>
        <Text style={styles.scaleLabel}>Very demanding</Text>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        onPress={handleSubmit}
        disabled={absorption === 0 || challenge === 0 || isSubmitting}
        style={({ pressed }) => [
          styles.submitButton,
          pressed && styles.submitButtonPressed,
          (absorption === 0 || challenge === 0 || isSubmitting) &&
            styles.submitButtonDisabled,
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.onInk} />
        ) : (
          <Text style={styles.submitButtonText}>Submit</Text>
        )}
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginBottom: 16,
    },
    title: {
      fontFamily: "Georgia",
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    question: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 10,
    },
    scaleRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 6,
    },
    scaleButton: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    scaleButtonActive: {
      backgroundColor: colors.ink,
      borderColor: colors.ink,
    },
    scaleButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    scaleButtonTextActive: {
      color: colors.onInk,
    },
    scaleLabelsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 18,
    },
    scaleLabel: {
      fontSize: 11,
      color: colors.textMuted,
    },
    errorText: {
      fontSize: 13,
      color: colors.danger,
      marginBottom: 12,
    },
    submitButton: {
      borderRadius: 8,
      backgroundColor: colors.ink,
      paddingVertical: 13,
      alignItems: "center",
    },
    submitButtonPressed: {
      opacity: 0.9,
    },
    submitButtonDisabled: {
      opacity: 0.5,
    },
    submitButtonText: {
      color: colors.onInk,
      fontSize: 14,
      fontWeight: "700",
    },
  });
