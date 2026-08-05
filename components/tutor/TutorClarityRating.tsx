import { useSubmitFeedbackMutation } from "@/store/services/feedbackAPI";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const SCALE_VALUES = [1, 2, 3, 4, 5];

// Cognitive-load proxy for the Generative Tutor specifically - FlowCheckinCard
// (components/flowCheckin/flowCheckinCard.tsx) covers Free Practice/
// Transcription but is deliberately scoped away from the AI Tutor chat, so
// this closes that gap: one rating per tutor reply, single tap (no separate
// submit step - it's a low-stakes, repeats-every-turn signal, not a
// once-per-session survey), reusing the same polymorphic feedback endpoint
// aural attempts already use (feedbackable_type: "tutor_message").
export default function TutorClarityRating({
  messageId,
}: {
  messageId: string;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [submitFeedback, { isLoading }] = useSubmitFeedbackMutation();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (submitted) {
    return <Text style={styles.thanksText}>Thanks for the feedback.</Text>;
  }

  const handleRate = async (value: number) => {
    setError(null);
    try {
      await submitFeedback({
        feedbackable_type: "tutor_message",
        feedbackable_id: messageId,
        rating: value,
      }).unwrap();
      setSubmitted(true);
    } catch {
      setError("Couldn't submit that. Try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.question}>How clear was that explanation?</Text>
      <View style={styles.scaleRow}>
        {SCALE_VALUES.map((value) => (
          <Pressable
            key={value}
            onPress={() => handleRate(value)}
            disabled={isLoading}
            style={styles.scaleButton}
            accessibilityRole="button"
            accessibilityLabel={`Rate clarity ${value} out of 5`}
          >
            <Text style={styles.scaleButtonText}>{value}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.scaleLabelsRow}>
        <Text style={styles.scaleLabel}>Too much jargon</Text>
        <Text style={styles.scaleLabel}>Crystal clear</Text>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    question: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textMuted,
      marginBottom: 6,
    },
    scaleRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 4,
    },
    scaleButton: {
      width: 26,
      height: 26,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    scaleButtonText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    scaleLabelsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    scaleLabel: {
      fontSize: 10,
      color: colors.textMuted,
    },
    thanksText: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      fontSize: 11,
      color: colors.textMuted,
    },
    errorText: {
      fontSize: 11,
      color: colors.danger,
      marginTop: 4,
    },
  });
