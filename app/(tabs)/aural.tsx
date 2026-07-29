import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";
import { useRouter } from "expo-router";
import { Mic, PenLine } from "lucide-react-native";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// Grade 1-5 curriculum modules (AuralGrades) are temporarily hidden here -
// not deleted, just not linked from this tab - while Free Practice is the
// only aural-training surface being actively developed. Restore by going
// back to rendering <AuralGrades> (see git history) when the curriculum
// content is revisited.
export default function AuralScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <Text style={styles.eyebrow}>AURAL TRAINING</Text>
        <Text style={styles.heading}>Ear Training</Text>
        <Text style={styles.subheading}>
          Sharpen your pitch by ear, one note at a time.
        </Text>
      </View>

      <Pressable
        onPress={() => router.push("/aural-practice")}
        style={({ pressed }) => [
          styles.practiceCard,
          pressed && styles.practiceCardPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Free Practice: pitch matching"
      >
        <View style={styles.practiceIconCircle}>
          <Mic size={22} color={colors.onInk} />
        </View>
        <View style={styles.practiceTextColumn}>
          <Text style={styles.practiceTitle}>Free Practice</Text>
          <Text style={styles.practiceSubtitle}>
            Pick a note, listen to it, then sing it back for instant feedback
          </Text>
        </View>
      </Pressable>

      <Pressable
        onPress={() => router.push("/aural-transcription")}
        style={({ pressed }) => [
          styles.transcriptionCard,
          pressed && styles.practiceCardPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Transcription: notate a heard pattern"
      >
        <View style={styles.transcriptionIconCircle}>
          <PenLine size={22} color={colors.ink} />
        </View>
        <View style={styles.practiceTextColumn}>
          <Text style={styles.transcriptionTitle}>Transcription</Text>
          <Text style={styles.transcriptionSubtitle}>
            Listen to a short pattern, then write down what you heard
          </Text>
        </View>
      </Pressable>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    contentContainer: {
      paddingHorizontal: 16,
      paddingTop: 96,
      paddingBottom: 92,
    },
    headerRow: {
      marginBottom: 24,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1.2,
      color: colors.gold,
    },
    heading: {
      fontFamily: "Georgia",
      fontSize: 30,
      fontWeight: "700",
      color: colors.textPrimary,
      marginTop: 4,
    },
    subheading: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    practiceCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 20,
      borderRadius: 16,
      backgroundColor: colors.ink,
    },
    practiceCardPressed: {
      opacity: 0.9,
    },
    practiceIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    practiceTextColumn: {
      flex: 1,
    },
    practiceTitle: {
      fontFamily: "Georgia",
      fontSize: 18,
      fontWeight: "700",
      color: colors.onInk,
    },
    practiceSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.onInk,
      opacity: 0.8,
      marginTop: 4,
    },
    transcriptionCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginTop: 14,
    },
    transcriptionIconCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    transcriptionTitle: {
      fontFamily: "Georgia",
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    transcriptionSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
      marginTop: 4,
    },
  });
