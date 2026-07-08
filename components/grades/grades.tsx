import { useGetCurriculumQuery, type Grade } from "@/store/services/curriculumAPI";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronRight, Music2, Sparkles } from "lucide-react-native";
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

const GRADE_THEMES = [
  {
    colors: ["#16253A", "#0F1B2C"] as const,
    text: "#F5F1E8",
    accent: "#D79A1B",
    badgeBg: "rgba(245,241,232,0.14)",
  },
  {
    colors: ["#D79A1B", "#B97D12"] as const,
    text: "#1B1A17",
    accent: "#16253A",
    badgeBg: "rgba(27,26,23,0.12)",
  },
  {
    colors: ["#178CCF", "#0F5E8C"] as const,
    text: "#F5F1E8",
    accent: "#FFE8B8",
    badgeBg: "rgba(245,241,232,0.16)",
  },
  {
    colors: ["#4A2545", "#2C1530"] as const,
    text: "#F5F1E8",
    accent: "#E3B23C",
    badgeBg: "rgba(245,241,232,0.14)",
  },
];

type GradeCardProps = {
  grade: Grade;
  index: number;
};

function GradeCard({ grade, index }: GradeCardProps) {
  const router = useRouter();
  const theme = GRADE_THEMES[index % GRADE_THEMES.length];
  const scale = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const quizzes = grade.quizzes ?? [];
  const quizCount = quizzes.length;
  const questionCount = quizzes.reduce(
    (sum, quiz) => sum + (quiz.content_jsonb?.length ?? 0),
    0,
  );

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
          onPress={() => router.push(`/grade/${grade.id}`)}
          onPressIn={() => {
            scale.value = withSpring(0.97, { damping: 14 });
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 14 });
          }}
          accessibilityRole="button"
          accessibilityLabel={`Grade ${grade.level_number}, ${grade.title}`}
        >
          <LinearGradient
            colors={theme.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            <View style={styles.cardTopRow}>
              <View>
                <Text style={[styles.gradeLabel, { color: theme.accent }]}>
                  GRADE
                </Text>
                <Text style={[styles.gradeNumber, { color: theme.text }]}>
                  {grade.level_number}
                </Text>
              </View>
              <ChevronRight size={22} color={theme.text} />
            </View>

            <Text style={[styles.gradeTitle, { color: theme.text }]}>
              {grade.title}
            </Text>
            <Text
              style={[styles.gradeTeaser, { color: theme.text }]}
              numberOfLines={2}
            >
              {grade.syllabus_focus}
            </Text>

            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: theme.badgeBg }]}>
                <Music2 size={12} color={theme.text} />
                <Text style={[styles.badgeText, { color: theme.text }]}>
                  {quizCount} {quizCount === 1 ? "quiz" : "quizzes"}
                </Text>
              </View>
              {questionCount > 0 && (
                <View
                  style={[styles.badge, { backgroundColor: theme.badgeBg }]}
                >
                  <Sparkles size={12} color={theme.text} />
                  <Text style={[styles.badgeText, { color: theme.text }]}>
                    {questionCount} questions
                  </Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export default function Grades() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const {
    data: grades,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useGetCurriculumQuery();

  const totalQuizzes =
    grades?.reduce((sum, grade) => sum + (grade.quizzes?.length ?? 0), 0) ?? 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          tintColor="#D79A1B"
        />
      }
    >
      <View
        style={[styles.contentColumn, isTablet && styles.contentColumnTablet]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Your Grades</Text>
          <Text style={styles.subheading}>
            {grades?.length ?? 0} grade levels · {totalQuizzes} quizzes
          </Text>
        </View>

        {isLoading && (
          <View style={styles.centerState}>
            <ActivityIndicator color="#D79A1B" size="large" />
            <Text style={styles.centerStateText}>
              Tuning up your curriculum…
            </Text>
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
              <GradeCard key={grade.id} grade={grade} index={index} />
            ))}
          </View>
        )}

        <Text style={styles.quote}>
          &ldquo;Music is the arithmetic of sounds.&rdquo; - Debussy
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5EFE3",
  },
  contentContainer: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 96,
    paddingBottom: 92,
  },
  contentColumn: {
    width: "100%",
  },
  contentColumnTablet: {
    maxWidth: 680,
  },
  headerRow: {
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  heading: {
    color: "#101A2A",
    fontFamily: "Georgia",
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
  },
  subheading: {
    marginTop: 4,
    color: "#2E425E",
    fontSize: 13,
    lineHeight: 18,
  },
  centerState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 12,
  },
  centerStateText: {
    color: "#2E425E",
    fontSize: 14,
  },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#16253A",
  },
  retryButtonText: {
    color: "#F5F1E8",
    fontSize: 13,
    fontWeight: "700",
  },
  list: {
    gap: 14,
  },
  cardWrapper: {
    width: "100%",
  },
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
  gradeLabel: {
    fontSize: 10,
    letterSpacing: 1.9,
    marginBottom: 2,
    fontWeight: "700",
  },
  gradeNumber: {
    fontFamily: "Georgia",
    fontSize: 36,
    lineHeight: 40,
  },
  gradeTitle: {
    fontFamily: "Georgia",
    fontSize: 18,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 4,
  },
  gradeTeaser: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.88,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
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
