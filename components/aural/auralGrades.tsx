import { useGetCurriculumQuery, type Grade } from "@/store/services/curriculumAPI";
import type { ThemeColors } from "@/constants/Colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronRight, Ear, Lock } from "lucide-react-native";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

// Only Grade 1 has generation rules on the backend so far (see
// AuralExerciseGeneratorService) - every other grade renders as a locked
// "coming soon" card instead of being tappable.
const AURAL_READY_LEVEL = 1;

type GradeCardProps = {
  grade: Grade;
  index: number;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
};

function AuralGradeCard({ grade, index, colors, styles }: GradeCardProps) {
  const router = useRouter();
  const scale = useSharedValue(1);
  const isReady = grade.level_number === AURAL_READY_LEVEL;

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 80)
        .duration(420)
        .springify()
        .damping(16)}
      style={styles.cardWrapper}
    >
      <Animated.View style={pressStyle}>
        <Pressable
          onPress={() => isReady && router.push(`/aural-training/${grade.id}`)}
          onPressIn={() => {
            if (isReady) scale.value = withSpring(0.97, { damping: 14 });
          }}
          onPressOut={() => {
            if (isReady) scale.value = withSpring(1, { damping: 14 });
          }}
          disabled={!isReady}
          accessibilityRole="button"
          accessibilityLabel={`Grade ${grade.level_number} Aural Training${isReady ? "" : " (coming soon)"}`}
        >
          <LinearGradient
            colors={
              isReady
                ? ([colors.blue, colors.blue] as const)
                : // Second stop for the locked-state gradient isn't covered
                  // by the theme token set - kept as a fixed literal.
                  ([colors.border, "#CBBE9F"] as const)
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardTopRow}>
              <View>
                <Text
                  style={[
                    styles.gradeLabel,
                    // "#FFE8B8" is a one-off decorative accent used only
                    // here on the ready-state gradient - left hardcoded.
                    { color: isReady ? "#FFE8B8" : colors.textMuted },
                  ]}
                >
                  GRADE
                </Text>
                <Text style={[styles.gradeNumber, { color: isReady ? colors.onInk : colors.textMuted }]}>
                  {grade.level_number}
                </Text>
              </View>
              {isReady ? (
                <ChevronRight size={22} color={colors.onInk} />
              ) : (
                <Lock size={20} color={colors.textMuted} />
              )}
            </View>

            <Text style={[styles.gradeTitle, { color: isReady ? colors.onInk : colors.textMuted }]}>
              {grade.title} · Aural
            </Text>
            <Text
              style={[styles.gradeTeaser, { color: isReady ? colors.onInk : colors.textMuted }]}
              numberOfLines={2}
            >
              {isReady
                ? "Pulse, echo singing, spot the difference, and musical features."
                : "Coming soon - Grade 1 Aural Training is available now."}
            </Text>

            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.badge,
                  // Translucent overlay tints don't map onto flat theme
                  // tokens - left as fixed rgba literals.
                  { backgroundColor: isReady ? "rgba(245,241,232,0.16)" : "rgba(91,82,64,0.12)" },
                ]}
              >
                <Ear size={12} color={isReady ? colors.onInk : colors.textMuted} />
                <Text style={[styles.badgeText, { color: isReady ? colors.onInk : colors.textMuted }]}>
                  {isReady ? "4 lessons" : "Locked"}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

type AuralGradesProps = {
  // Rendered between the header and the grade list - lets a parent screen
  // (e.g. the Aural tab) inject extra content without fighting this
  // component's own header-clearance padding / ScrollView ownership.
  children?: React.ReactNode;
};

export default function AuralGrades({ children }: AuralGradesProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    data: grades,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetCurriculumQuery();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          tintColor={colors.blue}
        />
      }
    >
      <View
        style={[styles.contentColumn, isTablet && styles.contentColumnTablet]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Aural Training</Text>
          <Text style={styles.subheading}>
            Ear-training games, organized by grade
          </Text>
        </View>

        {children}

        {isLoading && (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.blue} size="large" />
            <Text style={styles.centerStateText}>Tuning your ear…</Text>
          </View>
        )}

        {isError && !isLoading && (
          <View style={styles.centerState}>
            <Text style={styles.centerStateText}>
              Couldn&apos;t load grades right now.
            </Text>
            <Pressable onPress={() => refetch()} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && !isError && (grades?.length ?? 0) === 0 && (
          <View style={styles.centerState}>
            <Text style={styles.centerStateText}>
              No grades available yet.
            </Text>
          </View>
        )}

        {!isLoading && !isError && (grades?.length ?? 0) > 0 && (
          <View style={styles.list}>
            {grades!.map((grade, index) => (
              <AuralGradeCard
                key={grade.id}
                grade={grade}
                index={index}
                colors={colors}
                styles={styles}
              />
            ))}
          </View>
        )}

        <Text style={styles.quote}>
          &ldquo;Music is the space between the notes.&rdquo; - Debussy
        </Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    contentContainer: {
      alignItems: "center",
      justifyContent: "flex-start",
      paddingHorizontal: 16,
      paddingTop: 96,
      paddingBottom: 92,
    },
    contentColumn: { width: "100%" },
    contentColumnTablet: { maxWidth: 680 },
    headerRow: { marginBottom: 18, paddingHorizontal: 2 },
    heading: {
      color: colors.textPrimary,
      fontFamily: "Georgia",
      fontSize: 24,
      lineHeight: 28,
      fontWeight: "700",
    },
    subheading: { marginTop: 4, color: colors.textPrimary, fontSize: 13, lineHeight: 18 },
    centerState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 48,
      gap: 12,
    },
    centerStateText: { color: colors.textPrimary, fontSize: 14 },
    retryButton: {
      marginTop: 4,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.ink,
    },
    retryButtonText: { color: colors.onInk, fontSize: 13, fontWeight: "700" },
    list: { gap: 14 },
    cardWrapper: { width: "100%" },
    cardGradient: {
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 16,
    },
    cardTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    gradeLabel: { fontSize: 10, letterSpacing: 1.9, marginBottom: 2, fontWeight: "700" },
    gradeNumber: { fontFamily: "Georgia", fontSize: 36, lineHeight: 40 },
    gradeTitle: {
      fontFamily: "Georgia",
      fontSize: 18,
      lineHeight: 22,
      marginTop: 8,
      marginBottom: 4,
    },
    gradeTeaser: { fontSize: 13, lineHeight: 18, opacity: 0.88 },
    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    badgeText: { fontSize: 11, fontWeight: "700" },
    quote: {
      marginTop: 28,
      textAlign: "center",
      color: colors.textPrimary,
      fontFamily: "Georgia",
      fontStyle: "italic",
      fontSize: 13,
      lineHeight: 22,
    },
  });
