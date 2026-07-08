import { markTopicCompleted, recordTopicAttempt } from "@/lib/topicProgress";
import {
    useGetQuizByIdQuery,
    useGetTopicDebriefMutation,
    useSubmitQuizAnswerMutation,
    type QuizQuestion,
} from "@/store/services/curriculumAPI";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    ArrowLeft,
    Check,
    Flame,
    Lightbulb,
    Sparkles,
    Trophy,
    X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import Animated, {
    FadeIn,
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAX_QUESTIONS_PER_SESSION = 10;

type ActiveQuestion = {
  id: number;
  prompt: string;
  options: string[];
  hint: string | null;
};

// The seeded question bank always lists the correct answer as options[0],
// so option order must be shuffled before display or it gives the answer away.
function shuffleOptions(options: string[]): string[] {
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function toActiveQuestion(question: QuizQuestion): ActiveQuestion {
  return {
    id: question.id,
    prompt: question.question,
    options: shuffleOptions(question.options),
    hint: question.hint ?? null,
  };
}

function tierFor(question: QuizQuestion): "standard" | "advanced" {
  return (question.metadata?.difficulty ?? 1) >= 2 ? "advanced" : "standard";
}

function pickRandomQuestion(
  bank: QuizQuestion[],
  preferTier?: "standard" | "advanced",
  excludeId?: number,
): QuizQuestion | null {
  if (bank.length === 0) return null;
  const excluding = bank.filter((q) => q.id !== excludeId);
  const pool = excluding.length > 0 ? excluding : bank;
  if (preferTier) {
    const tierPool = pool.filter((q) => tierFor(q) === preferTier);
    if (tierPool.length > 0) {
      return tierPool[Math.floor(Math.random() * tierPool.length)];
    }
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function QuizScreen() {
  const { id, topic, topicLabel, gradeId } = useLocalSearchParams<{
    id: string;
    topic?: string;
    topicLabel?: string;
    gradeId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isTablet = width >= 768;
  const isNarrowPhone = width < 390;
  const contentMaxWidth = isTablet ? 760 : 680;
  const contentInset =
    width > contentMaxWidth ? Math.max(16, (width - contentMaxWidth) / 2) : 16;
  const scrollInnerWidth = Math.min(width - contentInset * 2, contentMaxWidth);

  const {
    data: quiz,
    isLoading: isQuizLoading,
    isError: isQuizError,
  } = useGetQuizByIdQuery(id);
  const [submitAnswer, { isLoading: isSubmitting }] =
    useSubmitQuizAnswerMutation();
  const [getTopicDebrief, { isLoading: isDebriefLoading }] =
    useGetTopicDebriefMutation();

  const questionPool = useMemo(() => {
    if (!quiz) return [];
    if (!topic) return quiz.content_jsonb;
    return quiz.content_jsonb.filter((q) => q.metadata?.topic === topic);
  }, [quiz, topic]);

  const totalQuestions = useMemo(
    () =>
      questionPool.length > 0
        ? Math.min(MAX_QUESTIONS_PER_SESSION, questionPool.length)
        : MAX_QUESTIONS_PER_SESSION,
    [questionPool],
  );

  const [phase, setPhase] = useState<"question" | "results">("question");
  const [questionNumber, setQuestionNumber] = useState(1);
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(
    null,
  );
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [correctOption, setCorrectOption] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [streak, setStreak] = useState(0);
  const [tier, setTier] = useState<"standard" | "advanced">("standard");
  const [correctCount, setCorrectCount] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [debriefMessage, setDebriefMessage] = useState<string | null>(null);

  const shake = useSharedValue(0);

  useEffect(() => {
    if (questionPool.length > 0 && !activeQuestion) {
      const first = pickRandomQuestion(questionPool, "standard");
      if (first) setActiveQuestion(toActiveQuestion(first));
    }
  }, [questionPool, activeQuestion]);

  useEffect(() => {
    if (phase === "results" && quiz && topic) {
      markTopicCompleted(String(quiz.id), topic);
      recordTopicAttempt(String(quiz.id), topic, correctCount, totalQuestions);

      getTopicDebrief({
        quiz_id: Number(quiz.id),
        topic,
        correct_count: correctCount,
        total_questions: totalQuestions,
        current_streak: streak,
        tier,
      })
        .unwrap()
        .then((res) => setDebriefMessage(res.message))
        .catch(() => setDebriefMessage(null));
    }
    // Fires once per results screen; correctCount/streak/tier are already
    // settled to their final values by the time phase flips to "results".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, quiz, topic]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: withTiming(`${(questionNumber / totalQuestions) * 100}%`, {
      duration: 350,
    }),
  }));

  const handleSelect = useCallback(
    async (option: string) => {
      if (!activeQuestion || selectedOption || !quiz) return;

      setSubmitError(null);
      setSelectedOption(option);

      try {
        const res = await submitAnswer({
          quiz_id: Number(quiz.id),
          question_id: activeQuestion.id,
          user_answer: option,
        }).unwrap();

        setCorrectOption(res.correctAnswer);
        setStreak(res.currentStreak);
        setTier(res.allocatedTier);
        if (res.isCorrect) {
          setCorrectCount((prev) => prev + 1);
        } else {
          shake.value = withSequence(
            withTiming(-8, { duration: 50 }),
            withTiming(8, { duration: 90 }),
            withTiming(-6, { duration: 90 }),
            withTiming(0, { duration: 70 }),
          );
        }

        setTimeout(() => {
          const next =
            questionNumber >= totalQuestions
              ? null
              : pickRandomQuestion(
                  questionPool,
                  res.allocatedTier,
                  activeQuestion.id,
                );

          if (!next) {
            setPhase("results");
            return;
          }

          setQuestionNumber((prev) => prev + 1);
          setActiveQuestion(toActiveQuestion(next));
          setSelectedOption(null);
          setCorrectOption(null);
          setShowHint(false);
        }, 1400);
      } catch {
        setSelectedOption(null);
        setSubmitError("Couldn't submit that answer. Try again.");
      }
    },
    [
      activeQuestion,
      selectedOption,
      quiz,
      questionNumber,
      totalQuestions,
      questionPool,
      submitAnswer,
      shake,
    ],
  );

  const handleRestart = useCallback(() => {
    const first = pickRandomQuestion(questionPool, "standard");
    if (!first) return;
    setPhase("question");
    setQuestionNumber(1);
    setActiveQuestion(toActiveQuestion(first));
    setSelectedOption(null);
    setCorrectOption(null);
    setShowHint(false);
    setCorrectCount(0);
    setStreak(0);
    setTier("standard");
    setDebriefMessage(null);
  }, [questionPool]);

  if (isQuizLoading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color="#D79A1B" size="large" />
        <Text style={styles.centerStateText}>Loading your quiz…</Text>
      </View>
    );
  }

  if (isQuizError || !quiz) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.centerStateText}>
          Couldn&apos;t load this quiz.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={[styles.topBar, { paddingHorizontal: contentInset }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Close quiz"
        >
          <ArrowLeft size={20} color="#101A2A" />
        </Pressable>
        <Text
          style={[
            styles.topBarTitle,
            { fontSize: isTablet ? 17 : isNarrowPhone ? 14 : 16 },
          ]}
          numberOfLines={1}
        >
          {topicLabel ?? quiz.title}
        </Text>
        <View style={styles.streakBadge}>
          <Flame
            size={14}
            color={streak > 0 ? "#D79A1B" : "#B6AC98"}
            fill={streak > 0 ? "#D79A1B" : "transparent"}
          />
          <Text style={styles.streakText}>{streak}</Text>
        </View>
      </View>

      {phase === "question" && (
        <>
          <View
            style={[styles.progressRow, { paddingHorizontal: contentInset }]}
          >
            <View
              style={[
                styles.progressTrack,
                { maxWidth: scrollInnerWidth - 72 },
              ]}
            >
              <Animated.View style={[styles.progressFill, progressStyle]} />
            </View>
            <Text
              style={[styles.progressLabel, { fontSize: isTablet ? 13 : 12 }]}
            >
              {Math.min(questionNumber, totalQuestions)} / {totalQuestions}
            </Text>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.questionScroll,
              {
                paddingHorizontal: contentInset,
                paddingTop: isTablet ? 24 : 16,
                paddingBottom: isTablet ? 80 : 48,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {activeQuestion && (
              <Animated.View
                key={activeQuestion.id}
                entering={FadeInDown.duration(320).springify().damping(18)}
                style={[
                  shakeStyle,
                  {
                    width: "100%",
                    maxWidth: scrollInnerWidth,
                    alignSelf: "center",
                  },
                ]}
              >
                <LinearGradient
                  colors={["#16253A", "#0F1B2C"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.questionCard,
                    {
                      borderRadius: isTablet ? 18 : 16,
                      paddingHorizontal: isTablet ? 22 : 18,
                      paddingTop: isTablet ? 20 : 16,
                      paddingBottom: isTablet ? 22 : 18,
                    },
                  ]}
                >
                  <View style={styles.tierBadge}>
                    <Text style={styles.tierBadgeText}>
                      {tier === "advanced" ? "ADVANCED" : "STANDARD"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.questionText,
                      {
                        fontSize: isTablet ? 22 : isNarrowPhone ? 17 : 19,
                        lineHeight: isTablet ? 30 : isNarrowPhone ? 24 : 26,
                      },
                    ]}
                  >
                    {activeQuestion.prompt}
                  </Text>

                  {activeQuestion.hint && (
                    <Pressable
                      onPress={() => setShowHint((prev) => !prev)}
                      accessibilityRole="button"
                      accessibilityLabel={showHint ? "Hide hint" : "Show hint"}
                      style={styles.hintToggle}
                    >
                      <Lightbulb size={14} color="#FFE8B8" />
                      <Text style={styles.hintToggleText}>
                        {showHint ? "Hide hint" : "Need a hint?"}
                      </Text>
                    </Pressable>
                  )}
                  {showHint && activeQuestion.hint && (
                    <Animated.Text
                      entering={FadeIn.duration(180)}
                      style={styles.hintText}
                    >
                      {activeQuestion.hint}
                    </Animated.Text>
                  )}
                </LinearGradient>

                <View style={[styles.optionsList, { gap: isTablet ? 12 : 10 }]}>
                  {activeQuestion.options.map((option) => {
                    const isSelected = selectedOption === option;
                    const isCorrectOption =
                      correctOption !== null && option === correctOption;
                    const isWrongSelection =
                      isSelected && correctOption !== null && !isCorrectOption;

                    return (
                      <Pressable
                        key={option}
                        onPress={() => handleSelect(option)}
                        disabled={!!selectedOption || isSubmitting}
                        accessibilityRole="button"
                        accessibilityLabel={`Answer: ${option}`}
                        style={({ pressed }) => [
                          styles.optionRow,
                          {
                            paddingVertical: isTablet ? 16 : 14,
                            borderRadius: isTablet ? 14 : 12,
                          },
                          isCorrectOption && styles.optionRowCorrect,
                          isWrongSelection && styles.optionRowWrong,
                          pressed && !selectedOption && styles.optionRowPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            { fontSize: isTablet ? 16 : 15 },
                            (isCorrectOption || isWrongSelection) &&
                              styles.optionTextOnColor,
                          ]}
                        >
                          {option}
                        </Text>
                        {isCorrectOption && <Check size={18} color="#F5F1E8" />}
                        {isWrongSelection && <X size={18} color="#F5F1E8" />}
                      </Pressable>
                    );
                  })}
                </View>

                {submitError && (
                  <Text style={styles.submitError}>{submitError}</Text>
                )}
              </Animated.View>
            )}
          </ScrollView>
        </>
      )}

      {phase === "results" && (
        <ScrollView
          contentContainerStyle={[
            styles.resultsScroll,
            {
              paddingHorizontal: contentInset,
              paddingVertical: isTablet ? 54 : 40,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInDown.duration(420).springify().damping(14)}
            style={[
              styles.resultsCard,
              {
                maxWidth: isTablet ? 520 : 360,
                paddingVertical: isTablet ? 36 : 32,
                paddingHorizontal: isTablet ? 30 : 24,
              },
            ]}
          >
            <Trophy size={isTablet ? 54 : 48} color="#D79A1B" />
            <Text
              style={[styles.resultsHeading, { fontSize: isTablet ? 26 : 22 }]}
            >
              {topicLabel ? `${topicLabel} complete!` : "Quiz complete!"}
            </Text>
            <Text
              style={[styles.resultsScore, { fontSize: isTablet ? 52 : 44 }]}
            >
              {correctCount}/{totalQuestions}
            </Text>
            <Text style={styles.resultsSubtext}>questions correct</Text>

            <View
              style={[
                styles.resultsBadgeRow,
                {
                  flexWrap: isTablet ? "nowrap" : "wrap",
                  justifyContent: "center",
                },
              ]}
            >
              <View style={styles.resultsBadge}>
                <Flame size={14} color="#D79A1B" fill="#D79A1B" />
                <Text style={styles.resultsBadgeText}>
                  Best streak {streak}
                </Text>
              </View>
              <View style={styles.resultsBadge}>
                <Text style={styles.resultsBadgeText}>
                  {tier === "advanced" ? "Advanced tier" : "Standard tier"}
                </Text>
              </View>
            </View>

            {(isDebriefLoading || debriefMessage) && (
              <Animated.View
                entering={FadeIn.duration(250)}
                style={styles.debriefCard}
              >
                <View style={styles.debriefHeader}>
                  <Sparkles size={13} color="#D79A1B" />
                  <Text style={styles.debriefHeaderText}>FROM AURA</Text>
                </View>
                {isDebriefLoading ? (
                  <ActivityIndicator color="#D79A1B" size="small" />
                ) : (
                  <Text style={styles.debriefText}>{debriefMessage}</Text>
                )}
              </Animated.View>
            )}

            <Pressable onPress={handleRestart} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Try again</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                gradeId ? router.replace(`/grade/${gradeId}`) : router.back()
              }
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>
                {gradeId ? "Back to path" : "Back to grades"}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5EFE3",
  },
  centerScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#F5EFE3",
  },
  centerStateText: {
    color: "#2E425E",
    fontSize: 14,
  },
  retryButton: {
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
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#D9CBB6",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#CFC5B5",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    flex: 1,
    color: "#101A2A",
    fontFamily: "Georgia",
    fontSize: 16,
    fontWeight: "700",
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F5F1E8",
    borderWidth: 1,
    borderColor: "#D2C5B0",
  },
  streakText: {
    color: "#101A2A",
    fontSize: 12,
    fontWeight: "700",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E5DCC7",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#D79A1B",
  },
  progressLabel: {
    color: "#2E425E",
    fontSize: 12,
    fontWeight: "700",
  },
  questionScroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  questionCard: {
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
  },
  tierBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(245,241,232,0.14)",
    marginBottom: 10,
  },
  tierBadgeText: {
    color: "#D79A1B",
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  questionText: {
    color: "#F5F1E8",
    fontFamily: "Georgia",
    fontSize: 19,
    lineHeight: 26,
  },
  hintToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  hintToggleText: {
    color: "#FFE8B8",
    fontSize: 12,
    fontWeight: "700",
  },
  hintText: {
    color: "#D9CFE0",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    fontStyle: "italic",
  },
  optionsList: {
    marginTop: 16,
    gap: 10,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D2C5B0",
    backgroundColor: "#F5F1E8",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionRowPressed: {
    opacity: 0.85,
  },
  optionRowCorrect: {
    backgroundColor: "#2F7A4F",
    borderColor: "#2F7A4F",
  },
  optionRowWrong: {
    backgroundColor: "#B23B3B",
    borderColor: "#B23B3B",
  },
  optionText: {
    color: "#101A2A",
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },
  optionTextOnColor: {
    color: "#F5F1E8",
  },
  submitError: {
    marginTop: 12,
    textAlign: "center",
    color: "#B23B3B",
    fontSize: 12,
  },
  resultsScroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  resultsCard: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D2C5B0",
    backgroundColor: "#F5F1E8",
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 4,
  },
  resultsHeading: {
    marginTop: 12,
    color: "#101A2A",
    fontFamily: "Georgia",
    fontSize: 22,
    fontWeight: "700",
  },
  resultsScore: {
    marginTop: 8,
    color: "#16253A",
    fontFamily: "Georgia",
    fontSize: 44,
  },
  resultsSubtext: {
    color: "#5A6B85",
    fontSize: 13,
    marginBottom: 12,
  },
  resultsBadgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  resultsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#EFE6D4",
  },
  resultsBadgeText: {
    color: "#101A2A",
    fontSize: 12,
    fontWeight: "700",
  },
  debriefCard: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D2C5B0",
    backgroundColor: "#EFE6D4",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  debriefHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  debriefHeaderText: {
    color: "#D79A1B",
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  debriefText: {
    color: "#2A3C58",
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    width: "100%",
    borderRadius: 10,
    backgroundColor: "#16253A",
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: {
    color: "#F5F1E8",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    width: "100%",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#2E425E",
    fontSize: 14,
    fontWeight: "600",
  },
});
