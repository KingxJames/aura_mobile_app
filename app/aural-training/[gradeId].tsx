import { getCompletedAuralModules } from "@/lib/auralModuleProgress";
import type { AuralModuleType } from "@/store/services/auralTrainingAPI";
import { useGetCurriculumQuery } from "@/store/services/curriculumAPI";
import type { ThemeColors } from "@/constants/Colors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    Activity,
    ArrowLeft,
    Check,
    Ear,
    Flame,
    Lock,
    Mic,
    Music2,
    Repeat,
    Star,
    Volume2,
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
    FadeInDown,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Flat XP award per completed lesson - matches XP_PER_TOPIC in app/grade/[id].tsx
// so the Aural path feels consistent with the theory quiz path.
const XP_PER_MODULE = 40;
const MAX_STARS = 3;

type NodeStatus = "locked" | "current" | "completed";

type AuralModuleDef = {
  type: AuralModuleType;
  label: string;
  description: string;
  icon: typeof Music2;
};

// Fixed lesson path for Grade 1 - the only grade with generation rules on
// the backend so far (see AuralExerciseGeneratorService). Other grades show
// a "coming soon" state instead of this path - see the screen body below.
const AURAL_MODULES: AuralModuleDef[] = [
  {
    type: "pulse_metre",
    label: "Pulse & Metre",
    description: "Tap along to the beat, then name the time signature.",
    icon: Activity,
  },
  {
    type: "echo_singing",
    label: "Echo Singing",
    description: "Listen to a short phrase, then sing it back.",
    icon: Mic,
  },
  {
    type: "spot_difference",
    label: "Spotting the Difference",
    description: "Two playbacks, one changed note - find where it happened.",
    icon: Ear,
  },
  {
    type: "musical_features",
    label: "Musical Features",
    description: "Identify the dynamics and articulation you hear.",
    icon: Volume2,
  },
];

function AuralModuleCard({
  moduleDef,
  status,
  index,
  isTablet,
  onPress,
  colors,
  styles,
}: {
  moduleDef: AuralModuleDef;
  status: NodeStatus;
  index: number;
  isTablet: boolean;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const Icon = moduleDef.icon;
  const badgeSize = isTablet ? 56 : 48;
  const iconSize = isTablet ? 24 : 20;

  const badgeColors =
    status === "completed"
      ? ([colors.success, colors.success] as const)
      : status === "current"
        ? ([colors.blue, colors.blue] as const)
        : ([colors.border, colors.border] as const);

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
            <Lock size={iconSize - 2} color={colors.textMuted} />
          ) : status === "completed" ? (
            <Check size={iconSize} color={colors.onInk} />
          ) : (
            <Icon size={iconSize} color={colors.onInk} />
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
        accessibilityLabel={`${moduleDef.label}${status === "locked" ? " (locked)" : ""}`}
      >
        <Text
          style={[styles.cardTitle, status === "locked" && styles.cardTitleLocked]}
        >
          {moduleDef.label}
        </Text>
        <Text
          style={[
            styles.cardDescription,
            status === "locked" && styles.cardTitleLocked,
          ]}
        >
          {moduleDef.description}
        </Text>

        {status === "locked" ? (
          <View style={styles.lockedFooter}>
            <Lock size={12} color={colors.textMuted} />
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
              accessibilityLabel={`Replay ${moduleDef.label}`}
            >
              <Repeat size={13} color={colors.onInk} />
              <Text style={styles.replayButtonText}>
                Replay · +{XP_PER_MODULE} XP
              </Text>
            </Pressable>
            <View style={styles.doneBadge}>
              <Check size={13} color={colors.success} />
              <Text style={styles.doneBadgeText}>Done</Text>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={onPress}
            style={styles.startButton}
            accessibilityRole="button"
            accessibilityLabel={`Start ${moduleDef.label}`}
          >
            <Text style={styles.startButtonText}>
              Start lesson · +{XP_PER_MODULE} XP
            </Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function AuralGradePathScreen() {
  const { gradeId } = useLocalSearchParams<{ gradeId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isTablet = width >= 768;
  const contentMaxWidth = isTablet ? 760 : 680;
  const contentInset =
    width > contentMaxWidth ? Math.max(16, (width - contentMaxWidth) / 2) : 16;
  const scrollInnerWidth = Math.min(width - contentInset * 2, contentMaxWidth);

  const { data: grades, isLoading, isError } = useGetCurriculumQuery();
  const grade = useMemo(
    () => grades?.find((g) => String(g.id) === gradeId),
    [grades, gradeId],
  );

  const [completedModules, setCompletedModules] = useState<AuralModuleType[]>(
    [],
  );

  useFocusEffect(
    useCallback(() => {
      if (!gradeId) return;
      let cancelled = false;
      getCompletedAuralModules(gradeId).then((completed) => {
        if (!cancelled) setCompletedModules(completed);
      });
      return () => {
        cancelled = true;
      };
    }, [gradeId]),
  );

  const statusFor = (index: number): NodeStatus => {
    const key = AURAL_MODULES[index].type;
    if (completedModules.includes(key)) return "completed";
    if (index === 0) return "current";
    const prevCompleted = completedModules.includes(
      AURAL_MODULES[index - 1].type,
    );
    return prevCompleted ? "current" : "locked";
  };

  const handleOpenModule = (moduleDef: AuralModuleDef) => {
    if (!gradeId) return;
    router.push({
      pathname: "/aural-training/exercise",
      params: {
        moduleType: moduleDef.type,
        gradeId,
        moduleLabel: moduleDef.label,
      },
    });
  };

  const completedCount = AURAL_MODULES.filter((m) =>
    completedModules.includes(m.type),
  ).length;
  const percent = Math.round((completedCount / AURAL_MODULES.length) * 100);
  const xp = completedCount * XP_PER_MODULE;
  const maxXp = AURAL_MODULES.length * XP_PER_MODULE;
  const filledStars = Math.round(
    (completedCount / AURAL_MODULES.length) * MAX_STARS,
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
        <ActivityIndicator color={colors.blue} size="large" />
        <Text style={styles.centerStateText}>Loading grade…</Text>
      </View>
    );
  }

  if (isError || !grade) {
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

  // Only Grade 1 has generated content on the backend right now.
  if (grade.level_number !== 1) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.breadcrumb, { marginLeft: contentInset, marginTop: 16 }]}
          accessibilityRole="button"
          accessibilityLabel="Back to Aural Training"
        >
          <ArrowLeft size={15} color={colors.textSecondary} />
          <Text style={styles.breadcrumbText}>Aural Training</Text>
        </Pressable>
        <View style={styles.centerScreen}>
          <Text style={styles.centerStateText}>
            Grade {grade.level_number} Aural Training is coming soon.
          </Text>
        </View>
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
          accessibilityLabel="Back to Aural Training"
        >
          <ArrowLeft size={15} color={colors.textSecondary} />
          <Text style={styles.breadcrumbText}>Aural Training</Text>
        </Pressable>

        <View style={[styles.headingBlock, { maxWidth: scrollInnerWidth }]}>
          <View style={styles.levelPill}>
            <Text style={styles.levelPillText}>LEVEL {grade.level_number}</Text>
          </View>
          <Text
            style={[styles.gradeHeading, { fontSize: isTablet ? 34 : 28 }]}
          >
            {grade.title} · Aural
          </Text>
          <Text
            style={[styles.gradeTagline, { fontSize: isTablet ? 15 : 14 }]}
          >
            Ear-training games for pulse, pitch, memory, and expression.
          </Text>
        </View>

        <View style={[styles.progressSection, { maxWidth: scrollInnerWidth }]}>
          <View style={styles.progressTopRow}>
            <Text style={styles.progressLabel}>PROGRESS</Text>
            <View style={styles.xpPill}>
              <Flame size={12} color={colors.blue} fill={colors.blue} />
              <Text style={styles.xpPillText}>{xp} XP</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressTrackFillWrap, progressBarStyle]}>
              <LinearGradient
                colors={[colors.blue, colors.ink] as const}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.progressFill}
              />
            </Animated.View>
          </View>

          <View style={styles.progressStatsRow}>
            <Text style={styles.progressStatsText}>
              {completedCount} / {AURAL_MODULES.length} Lessons · {percent}%
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
                color={i < filledStars ? colors.blue : colors.border}
                fill={i < filledStars ? colors.blue : "transparent"}
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
          {AURAL_MODULES.map((moduleDef, index) => (
            <AuralModuleCard
              key={moduleDef.type}
              moduleDef={moduleDef}
              index={index}
              status={statusFor(index)}
              isTablet={isTablet}
              onPress={() => handleOpenModule(moduleDef)}
              colors={colors}
              styles={styles}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centerScreen: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: colors.bg,
    },
    centerStateText: { color: colors.textPrimary, fontSize: 14, textAlign: "center" },
    retryButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.ink,
    },
    retryButtonText: { color: colors.onInk, fontSize: 13, fontWeight: "700" },
    scrollContent: { paddingTop: 12, alignItems: "center" },
    breadcrumb: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      marginBottom: 18,
    },
    breadcrumbText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
    headingBlock: { width: "100%", marginBottom: 22 },
    levelPill: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      // Decorative light-blue chip background - not covered by the theme
      // token set, left as a fixed literal (see report).
      backgroundColor: "#DCEEF9",
      marginBottom: 8,
    },
    levelPillText: {
      color: colors.blue,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1,
    },
    gradeHeading: {
      color: colors.textPrimary,
      fontFamily: "Georgia",
      fontWeight: "700",
    },
    gradeTagline: {
      color: colors.textPrimary,
      fontStyle: "italic",
      marginTop: 4,
      lineHeight: 20,
    },
    progressSection: {
      width: "100%",
      marginBottom: 28,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceAlt,
    },
    progressTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    progressLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
    xpPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      // Same decorative light-blue chip as levelPill above - fixed literal.
      backgroundColor: "#DCEEF9",
    },
    xpPillText: { color: colors.blue, fontSize: 11, fontWeight: "700" },
    progressTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    progressTrackFillWrap: { height: "100%" },
    progressFill: { flex: 1 },
    progressStatsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
    },
    progressStatsText: { color: colors.textPrimary, fontSize: 12, fontWeight: "600" },
    starsRow: { flexDirection: "row", gap: 6, marginTop: 12 },
    questPill: {
      alignSelf: "flex-start",
      marginTop: 14,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: colors.ink,
    },
    questPillText: {
      color: colors.onInk,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.8,
    },
    path: { width: "100%" },
    cardRow: { flexDirection: "row", gap: 12 },
    railColumn: { alignItems: "center", width: 56 },
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
      borderColor: colors.border,
    },
    card: {
      flex: 1,
      marginBottom: 20,
      padding: 16,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.surfaceAlt,
    },
    cardLocked: { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
    cardCurrent: { borderColor: colors.blue, borderWidth: 1.5 },
    cardTitle: {
      color: colors.textPrimary,
      fontFamily: "Georgia",
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 8,
    },
    cardTitleLocked: { color: colors.textMuted },
    cardDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginBottom: 12,
    },
    lockedFooter: { flexDirection: "row", alignItems: "center", gap: 6 },
    lockedFooterText: { color: colors.textMuted, fontSize: 11, fontStyle: "italic" },
    cardFooterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    replayButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.ink,
    },
    replayButtonText: { color: colors.onInk, fontSize: 12, fontWeight: "700" },
    doneBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      // Decorative light-green "done" chip background - not covered by the
      // theme token set, left as a fixed literal (see report).
      backgroundColor: "#E3F0E6",
    },
    doneBadgeText: { color: colors.success, fontSize: 12, fontWeight: "700" },
    startButton: {
      alignSelf: "flex-start",
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: colors.blue,
    },
    startButtonText: { color: colors.onInk, fontSize: 12, fontWeight: "700" },
  });
