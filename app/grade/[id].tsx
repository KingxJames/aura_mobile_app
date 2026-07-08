import {
    getAllTopicAttempts,
    getCompletedTopics,
    isStrugglingWithTopic,
    type TopicAttemptRecord,
} from "@/lib/topicProgress";
import { groupQuestionsByTopic, type TopicGroup } from "@/lib/topics";
import {
    useGetCurriculumQuery,
    useGetTopicHelpMutation,
} from "@/store/services/curriculumAPI";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    AlignHorizontalDistributeCenter,
    ArrowLeft,
    ArrowLeftRight,
    Check,
    Clock,
    Drum,
    Flag,
    Flame,
    GitBranch,
    KeyRound,
    Layers,
    Lock,
    Music2,
    Music4,
    Piano,
    Repeat,
    Search,
    Shuffle,
    Sparkles,
    Split,
    Star,
    Timer,
    TrendingDown,
    TrendingUp,
    Trophy,
    WandSparkles,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    Pressable,
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
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TOPIC_ICONS: Record<string, typeof Music2> = {
  pitch: Music2,
  rhythm: Drum,
  time_signatures: Clock,
  scales: TrendingUp,
  intervals: ArrowLeftRight,
  bass_clef: Piano,
  key_signatures: KeyRound,
  compound_time: Timer,
  triads: Layers,
  cadences: Flag,
  syncopation: Shuffle,
  minor_scales: TrendingDown,
  chord_inversions: Split,
  ornaments: WandSparkles,
  modulation: GitBranch,
  advanced_rhythm: Drum,
  chromatic_harmony: Music4,
  musical_form: AlignHorizontalDistributeCenter,
  transposition: Repeat,
  score_analysis: Search,
};

// Every completed lesson is worth a flat amount of XP; this also drives
// the progress bar and the "X / Y XP" readout in the quest header.
const XP_PER_TOPIC = 40;
const MAX_STARS = 3;
const MAX_REVIEW_QUESTIONS = 10;

type NodeStatus = "locked" | "current" | "completed";

function TopicCard({
  group,
  status,
  index,
  isStruggling,
  bestScorePercent,
  isTablet,
  onPress,
  onAskAura,
}: {
  group: TopicGroup;
  status: NodeStatus;
  index: number;
  isStruggling: boolean;
  bestScorePercent: number | null;
  isTablet: boolean;
  onPress: () => void;
  onAskAura: () => void;
}) {
  const Icon = TOPIC_ICONS[group.key] ?? Star;
  const badgeSize = isTablet ? 56 : 48;
  const iconSize = isTablet ? 24 : 20;

  const badgeColors =
    status === "completed"
      ? (["#2F7A4F", "#1F5A38"] as const)
      : status === "current"
        ? (["#D79A1B", "#B97D12"] as const)
        : (["#DCD0BA", "#DCD0BA"] as const);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 70).duration(320).springify()}
      style={styles.cardRow}
    >
      <View style={styles.railColumn}>
        <LinearGradient
          colors={badgeColors}
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
            },
          ]}
        >
          {status === "locked" ? (
            <Lock size={iconSize - 2} color="#9C917C" />
          ) : status === "completed" ? (
            <Check size={iconSize} color="#F5F1E8" />
          ) : (
            <Icon size={iconSize} color="#F5F1E8" />
          )}
        </LinearGradient>
        <View style={styles.connector} />
      </View>

      <Pressable
        onPress={onPress}
        disabled={status === "locked"}
        style={[
          styles.card,
          status === "locked" && styles.cardLocked,
          status === "current" && styles.cardCurrent,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${group.label}${status === "locked" ? " (locked)" : ""}`}
      >
        <Text
          style={[styles.cardTitle, status === "locked" && styles.cardTitleLocked]}
        >
          {group.label}
        </Text>

        <View style={styles.tagRow}>
          <View style={styles.tagPill}>
            <Text style={styles.tagPillText}>
              {group.questions.length} question
              {group.questions.length === 1 ? "" : "s"}
            </Text>
          </View>
          {bestScorePercent !== null && (
            <View style={styles.tagPill}>
              <Text style={styles.tagPillText}>Best {bestScorePercent}%</Text>
            </View>
          )}
          {isStruggling && (
            <Pressable
              onPress={onAskAura}
              style={styles.askAuraPill}
              accessibilityRole="button"
              accessibilityLabel={`Ask Aura for help with ${group.label}`}
            >
              <Sparkles size={11} color="#D79A1B" />
              <Text style={styles.askAuraPillText}>Ask Aura</Text>
            </Pressable>
          )}
        </View>

        {status === "locked" ? (
          <View style={styles.lockedFooter}>
            <Lock size={12} color="#9C917C" />
            <Text style={styles.lockedFooterText}>
              Complete the lesson above to unlock
            </Text>
          </View>
        ) : status === "completed" ? (
          <View style={styles.cardFooterRow}>
            <Pressable
              onPress={onPress}
              style={styles.replayButton}
              accessibilityRole="button"
              accessibilityLabel={`Replay ${group.label}`}
            >
              <Repeat size={13} color="#F5F1E8" />
              <Text style={styles.replayButtonText}>
                Replay · +{XP_PER_TOPIC} XP
              </Text>
            </Pressable>
            <View style={styles.doneBadge}>
              <Check size={13} color="#1F5A38" />
              <Text style={styles.doneBadgeText}>Done</Text>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={onPress}
            style={styles.startButton}
            accessibilityRole="button"
            accessibilityLabel={`Start ${group.label}`}
          >
            <Text style={styles.startButtonText}>
              Start lesson · +{XP_PER_TOPIC} XP
            </Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

function FinalReviewCard({
  unlocked,
  questionCount,
  index,
  onPress,
}: {
  unlocked: boolean;
  questionCount: number;
  index: number;
  onPress: () => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 70).duration(320).springify()}
      style={styles.cardRow}
    >
      <View style={styles.railColumn}>
        <View style={[styles.badge, unlocked ? styles.bossBadge : styles.bossBadgeLocked]}>
          {unlocked ? (
            <Trophy size={22} color="#F5F1E8" />
          ) : (
            <Lock size={20} color="#9C917C" />
          )}
        </View>
      </View>

      <Pressable
        onPress={onPress}
        disabled={!unlocked}
        style={styles.bossCardTouchable}
        accessibilityRole="button"
        accessibilityLabel="Final review"
      >
        <LinearGradient
          colors={
            unlocked
              ? (["#16253A", "#3B2A17"] as const)
              : (["#DCD0BA", "#CBBE9F"] as const)
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.bossCard}
        >
          <Text style={[styles.bossEyebrow, !unlocked && styles.bossEyebrowLocked]}>
            {unlocked ? "FINAL REVIEW" : "LOCKED"}
          </Text>
          <Text style={[styles.bossTitle, !unlocked && styles.bossTitleLocked]}>
            The Examination
          </Text>
          <Text
            style={[styles.bossSubtitle, !unlocked && styles.bossSubtitleLocked]}
          >
            {unlocked
              ? `${questionCount} questions · every lesson combined`
              : "Complete every lesson above to unlock"}
          </Text>
          {unlocked && (
            <View style={styles.bossButton}>
              <Trophy size={14} color="#16253A" />
              <Text style={styles.bossButtonText}>Challenge the Examiner</Text>
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

export default function GradeTopicsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isTablet = width >= 768;
  const isNarrowPhone = width < 390;
  const contentMaxWidth = isTablet ? 760 : 680;
  const contentInset =
    width > contentMaxWidth ? Math.max(16, (width - contentMaxWidth) / 2) : 16;
  const scrollInnerWidth = Math.min(width - contentInset * 2, contentMaxWidth);

  const { data: grades, isLoading, isError } = useGetCurriculumQuery();
  const grade = useMemo(
    () => grades?.find((g) => String(g.id) === id),
    [grades, id],
  );
  const quiz = grade?.quizzes?.[0];

  const topics = useMemo(
    () => (quiz ? groupQuestionsByTopic(quiz.content_jsonb) : []),
    [quiz],
  );

  const [completedTopics, setCompletedTopics] = useState<string[]>([]);
  const [attempts, setAttempts] = useState<Record<string, TopicAttemptRecord>>(
    {},
  );
  const [getTopicHelp] = useGetTopicHelpMutation();
  const [helpModal, setHelpModal] = useState<{
    topicLabel: string;
    message: string | null;
    loading: boolean;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!quiz) return;
      let cancelled = false;
      Promise.all([
        getCompletedTopics(String(quiz.id)),
        getAllTopicAttempts(String(quiz.id)),
      ]).then(([completed, attemptsMap]) => {
        if (!cancelled) {
          setCompletedTopics(completed);
          setAttempts(attemptsMap);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [quiz]),
  );

  const handleAskAura = useCallback(
    async (group: TopicGroup) => {
      if (!quiz) return;
      const record = attempts[group.key] ?? null;
      setHelpModal({ topicLabel: group.label, message: null, loading: true });
      try {
        const res = await getTopicHelp({
          quiz_id: Number(quiz.id),
          topic: group.key,
          attempts: record?.attempts ?? 2,
          best_score_percent: record?.bestScorePercent ?? 0,
        }).unwrap();
        setHelpModal({
          topicLabel: group.label,
          message: res.message,
          loading: false,
        });
      } catch {
        setHelpModal({
          topicLabel: group.label,
          message: "Couldn't reach Aura right now — try again in a moment.",
          loading: false,
        });
      }
    },
    [quiz, attempts, getTopicHelp],
  );

  const statusFor = (index: number): NodeStatus => {
    const key = topics[index].key;
    if (completedTopics.includes(key)) return "completed";
    if (index === 0) return "current";
    const prevCompleted = completedTopics.includes(topics[index - 1].key);
    return prevCompleted ? "current" : "locked";
  };

  const handleOpenTopic = (group: TopicGroup) => {
    if (!quiz || !grade) return;
    router.push({
      pathname: "/quiz/[id]",
      params: {
        id: String(quiz.id),
        topic: group.key,
        topicLabel: group.label,
        gradeId: String(grade.id),
      },
    });
  };

  const handleStartFinalReview = () => {
    if (!quiz || !grade) return;
    router.push({
      pathname: "/quiz/[id]",
      params: { id: String(quiz.id), gradeId: String(grade.id) },
    });
  };

  const completedCount = topics.filter((t) =>
    completedTopics.includes(t.key),
  ).length;
  const percent =
    topics.length > 0 ? Math.round((completedCount / topics.length) * 100) : 0;
  const xp = completedCount * XP_PER_TOPIC;
  const maxXp = topics.length * XP_PER_TOPIC;
  const filledStars =
    topics.length > 0 ? Math.round((completedCount / topics.length) * MAX_STARS) : 0;
  const allTopicsCompleted = topics.length > 0 && completedCount === topics.length;
  const reviewQuestionCount = Math.min(
    MAX_REVIEW_QUESTIONS,
    quiz?.content_jsonb.length ?? 0,
  );

  const progressWidth = useSharedValue(0);
  useEffect(() => {
    progressWidth.value = withTiming(percent, { duration: 600 });
  }, [percent, progressWidth]);
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  if (isLoading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color="#D79A1B" size="large" />
        <Text style={styles.centerStateText}>Loading topics…</Text>
      </View>
    );
  }

  if (isError || !grade || !quiz) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.centerStateText}>
          Couldn&apos;t load this grade.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: contentInset,
            paddingBottom: isTablet ? 110 : 88,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.breadcrumb}
          accessibilityRole="button"
          accessibilityLabel="Back to all grades"
        >
          <ArrowLeft size={15} color="#8C8270" />
          <Text style={styles.breadcrumbText}>All grades</Text>
        </Pressable>

        <View style={[styles.headingBlock, { maxWidth: scrollInnerWidth }]}>
          <View style={styles.levelPill}>
            <Text style={styles.levelPillText}>LEVEL {grade.level_number}</Text>
          </View>
          <Text
            style={[styles.gradeHeading, { fontSize: isTablet ? 34 : 28 }]}
          >
            {grade.title}
          </Text>
          <Text
            style={[
              styles.gradeTagline,
              { fontSize: isTablet ? 15 : 14, maxWidth: isNarrowPhone ? 280 : 360 },
            ]}
          >
            {grade.description}
          </Text>
        </View>

        <View style={[styles.progressSection, { maxWidth: scrollInnerWidth }]}>
          <View style={styles.progressTopRow}>
            <Text style={styles.progressLabel}>PROGRESS</Text>
            <View style={styles.xpPill}>
              <Flame size={12} color="#D79A1B" fill="#D79A1B" />
              <Text style={styles.xpPillText}>{xp} XP</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressTrackFillWrap, progressBarStyle]}>
              <LinearGradient
                colors={["#D79A1B", "#16253A"] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.progressFill}
              />
            </Animated.View>
          </View>

          <View style={styles.progressStatsRow}>
            <Text style={styles.progressStatsText}>
              {completedCount} / {topics.length} Lessons · {percent}%
            </Text>
            <Text style={styles.progressStatsText}>
              {xp} / {maxXp} XP
            </Text>
          </View>

          <View style={styles.starsRow}>
            {Array.from({ length: MAX_STARS }).map((_, i) => (
              <Star
                key={i}
                size={18}
                color={i < filledStars ? "#D79A1B" : "#D9CBB6"}
                fill={i < filledStars ? "#D79A1B" : "transparent"}
              />
            ))}
          </View>

          <View style={styles.questPill}>
            <Text style={styles.questPillText}>
              THE QUEST · TAP A LESSON TO BEGIN
            </Text>
          </View>
        </View>

        <View style={[styles.path, { maxWidth: scrollInnerWidth }]}>
          {topics.map((group, index) => (
            <TopicCard
              key={group.key}
              group={group}
              index={index}
              status={statusFor(index)}
              isStruggling={isStrugglingWithTopic(attempts[group.key] ?? null)}
              bestScorePercent={attempts[group.key]?.bestScorePercent ?? null}
              isTablet={isTablet}
              onPress={() => handleOpenTopic(group)}
              onAskAura={() => handleAskAura(group)}
            />
          ))}

          <FinalReviewCard
            unlocked={allTopicsCompleted}
            questionCount={reviewQuestionCount}
            index={topics.length}
            onPress={handleStartFinalReview}
          />
        </View>
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={helpModal !== null}
        onRequestClose={() => setHelpModal(null)}
      >
        <Pressable
          style={[
            styles.modalBackdrop,
            { paddingHorizontal: isTablet ? 48 : 24 },
          ]}
          onPress={() => setHelpModal(null)}
        >
          <Pressable
            style={[styles.modalCard, { maxWidth: isTablet ? 420 : 340 }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Sparkles size={16} color="#D79A1B" />
              <Text style={styles.modalHeaderText}>
                Aura on {helpModal?.topicLabel}
              </Text>
            </View>
            {helpModal?.loading ? (
              <ActivityIndicator
                color="#D79A1B"
                size="small"
                style={styles.modalLoader}
              />
            ) : (
              <Text style={styles.modalMessage}>{helpModal?.message}</Text>
            )}
            <Pressable
              onPress={() => setHelpModal(null)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseButtonText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  scrollContent: {
    paddingTop: 12,
    alignItems: "center",
  },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 18,
  },
  breadcrumbText: {
    color: "#8C8270",
    fontSize: 13,
    fontWeight: "600",
  },
  headingBlock: {
    width: "100%",
    marginBottom: 22,
  },
  levelPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EADFC3",
    marginBottom: 8,
  },
  levelPillText: {
    color: "#8A6A1E",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  gradeHeading: {
    color: "#101A2A",
    fontFamily: "Georgia",
    fontWeight: "700",
  },
  gradeTagline: {
    color: "#2E425E",
    fontStyle: "italic",
    marginTop: 4,
    lineHeight: 20,
  },
  progressSection: {
    width: "100%",
    marginBottom: 28,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAE3D5",
  },
  progressTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progressLabel: {
    color: "#8C8270",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  xpPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#FBF0D9",
  },
  xpPillText: {
    color: "#8A6A1E",
    fontSize: 11,
    fontWeight: "700",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#EFE6D7",
    overflow: "hidden",
  },
  progressTrackFillWrap: {
    height: "100%",
  },
  progressFill: {
    flex: 1,
  },
  progressStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  progressStatsText: {
    color: "#2E425E",
    fontSize: 12,
    fontWeight: "600",
  },
  starsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },
  questPill: {
    alignSelf: "flex-start",
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#16253A",
  },
  questPillText: {
    color: "#F5F1E8",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  path: {
    width: "100%",
  },
  cardRow: {
    flexDirection: "row",
    gap: 12,
  },
  railColumn: {
    alignItems: "center",
    width: 56,
  },
  badge: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.35)",
  },
  connector: {
    flex: 1,
    width: 2,
    minHeight: 24,
    marginVertical: 4,
    borderRadius: 1,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#D9CBB6",
  },
  bossBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#16253A",
  },
  bossBadgeLocked: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#DCD0BA",
  },
  card: {
    flex: 1,
    marginBottom: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAE3D5",
  },
  cardLocked: {
    backgroundColor: "#F7F3EA",
    borderColor: "#E7DFCE",
  },
  cardCurrent: {
    borderColor: "#D79A1B",
    borderWidth: 1.5,
  },
  cardTitle: {
    color: "#101A2A",
    fontFamily: "Georgia",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  cardTitleLocked: {
    color: "#9C917C",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  tagPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F1ECE0",
  },
  tagPillText: {
    color: "#5B5240",
    fontSize: 10,
    fontWeight: "600",
  },
  askAuraPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#F5F1E8",
    borderWidth: 1,
    borderColor: "#D79A1B",
  },
  askAuraPillText: {
    color: "#D79A1B",
    fontSize: 10,
    fontWeight: "700",
  },
  lockedFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lockedFooterText: {
    color: "#9C917C",
    fontSize: 11,
    fontStyle: "italic",
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  replayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#16253A",
  },
  replayButtonText: {
    color: "#F5F1E8",
    fontSize: 12,
    fontWeight: "700",
  },
  doneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#E3F0E6",
  },
  doneBadgeText: {
    color: "#1F5A38",
    fontSize: 12,
    fontWeight: "700",
  },
  startButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#D79A1B",
  },
  startButtonText: {
    color: "#16253A",
    fontSize: 12,
    fontWeight: "700",
  },
  bossCardTouchable: {
    flex: 1,
    marginBottom: 20,
    borderRadius: 18,
    overflow: "hidden",
  },
  bossCard: {
    padding: 18,
  },
  bossEyebrow: {
    color: "#D79A1B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  bossEyebrowLocked: {
    color: "#9C917C",
  },
  bossTitle: {
    color: "#F5F1E8",
    fontFamily: "Georgia",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
  },
  bossTitleLocked: {
    color: "#8A7F69",
  },
  bossSubtitle: {
    color: "#C9BFA8",
    fontSize: 13,
    marginBottom: 14,
  },
  bossSubtitleLocked: {
    color: "#9C917C",
  },
  bossButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F5F1E8",
  },
  bossButtonText: {
    color: "#16253A",
    fontSize: 13,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(16,26,42,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 16,
    backgroundColor: "#F5F1E8",
    borderWidth: 1,
    borderColor: "#D2C5B0",
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  modalHeaderText: {
    color: "#101A2A",
    fontFamily: "Georgia",
    fontSize: 15,
    fontWeight: "700",
  },
  modalLoader: {
    marginVertical: 12,
  },
  modalMessage: {
    color: "#2A3C58",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  modalCloseButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: "#16253A",
  },
  modalCloseButtonText: {
    color: "#F5F1E8",
    fontSize: 13,
    fontWeight: "700",
  },
});
