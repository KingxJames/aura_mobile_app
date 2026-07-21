import { useGetCurriculumQuery, type Grade } from "@/store/services/curriculumAPI";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronRight, Ear, Lock } from "lucide-react-native";
import React from "react";
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
};

function AuralGradeCard({ grade, index }: GradeCardProps) {
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
            colors={isReady ? (["#178CCF", "#0F5E8C"] as const) : (["#DCD0BA", "#CBBE9F"] as const)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardTopRow}>
              <View>
                <Text style={[styles.gradeLabel, { color: isReady ? "#FFE8B8" : "#8A7F69" }]}>
                  GRADE
                </Text>
                <Text style={[styles.gradeNumber, { color: isReady ? "#F5F1E8" : "#5B5240" }]}>
                  {grade.level_number}
                </Text>
              </View>
              {isReady ? (
                <ChevronRight size={22} color="#F5F1E8" />
              ) : (
                <Lock size={20} color="#8A7F69" />
              )}
            </View>

            <Text style={[styles.gradeTitle, { color: isReady ? "#F5F1E8" : "#5B5240" }]}>
              {grade.title} · Aural
            </Text>
            <Text
              style={[styles.gradeTeaser, { color: isReady ? "#F5F1E8" : "#8A7F69" }]}
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
                  { backgroundColor: isReady ? "rgba(245,241,232,0.16)" : "rgba(91,82,64,0.12)" },
                ]}
              >
                <Ear size={12} color={isReady ? "#F5F1E8" : "#8A7F69"} />
                <Text style={[styles.badgeText, { color: isReady ? "#F5F1E8" : "#8A7F69" }]}>
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

export default function AuralGrades() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
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
          tintColor="#178CCF"
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

        {isLoading && (
          <View style={styles.centerState}>
            <ActivityIndicator color="#178CCF" size="large" />
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
              <AuralGradeCard key={grade.id} grade={grade} index={index} />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5EFE3" },
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
    color: "#101A2A",
    fontFamily: "Georgia",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
  },
  subheading: { marginTop: 4, color: "#2E425E", fontSize: 13, lineHeight: 18 },
  centerState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  centerStateText: { color: "#2E425E", fontSize: 14 },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#16253A",
  },
  retryButtonText: { color: "#F5F1E8", fontSize: 13, fontWeight: "700" },
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
    color: "#1F2F4A",
    fontFamily: "Georgia",
    fontStyle: "italic",
    fontSize: 13,
    lineHeight: 22,
  },
});
