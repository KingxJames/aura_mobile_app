import {
  useGetAttritionReportQuery,
  useGetEnrollmentSummaryQuery,
  useGetParticipantProgressQuery,
} from "@/store/services/studyAPI";
import type { RootState } from "@/store/store";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";
import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  Minus,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react-native";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";

export default function StudyAdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useSelector((state: RootState) => state.auth.user);
  const isAdmin = Boolean(user?.is_admin);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/grades");
    }
  };

  // Backend also enforces this (EnsureIsAdmin, 403s non-admin tokens) - this
  // is just so a non-researcher account never even sees the request fire.
  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = useGetEnrollmentSummaryQuery(undefined, { skip: !isAdmin });
  const {
    data: attrition,
    isLoading: isAttritionLoading,
    error: attritionError,
  } = useGetAttritionReportQuery(undefined, { skip: !isAdmin });
  const {
    data: progress,
    isLoading: isProgressLoading,
    error: progressError,
  } = useGetParticipantProgressQuery(undefined, { skip: !isAdmin });

  if (!isAdmin) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.centeredContent}>
          <Text style={styles.deniedTitle}>Not available</Text>
          <Pressable onPress={handleBack} style={styles.outlineButton}>
            <Text style={styles.outlineButtonText}>Go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const summaryData = summary?.data;
  const attritionRows = attrition?.data ?? [];
  const atRiskCount = attritionRows.filter((row) => row.at_risk).length;
  const progressRows = progress?.data ?? [];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={handleBack}
          style={styles.breadcrumb}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={15} color={colors.textSecondary} />
          <Text style={styles.breadcrumbText}>Settings</Text>
        </Pressable>

        <Text style={styles.eyebrow}>RESEARCHER ONLY</Text>
        <Text style={styles.heading}>Study Monitor</Text>
        <Text style={styles.subheading}>
          Enrollment and attrition against the study&apos;s targets.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Users size={16} color={colors.textPrimary} />
            <Text style={styles.cardTitle}>Enrollment</Text>
          </View>

          {isSummaryLoading ? (
            <ActivityIndicator color={colors.ink} />
          ) : summaryError || !summaryData ? (
            <Text style={styles.errorText}>Couldn&apos;t load enrollment data.</Text>
          ) : (
            <>
              <View style={styles.statRow}>
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>{summaryData.control_count}</Text>
                  <Text style={styles.statLabel}>Control</Text>
                </View>
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>
                    {summaryData.experimental_count}
                  </Text>
                  <Text style={styles.statLabel}>Experimental</Text>
                </View>
                <View style={styles.statBlock}>
                  <Text style={styles.statValue}>{summaryData.total_enrolled}</Text>
                  <Text style={styles.statLabel}>Total</Text>
                </View>
              </View>

              <Text style={styles.bodyText}>
                Target: {summaryData.target_min}-{summaryData.target_max}{" "}
                participants ({summaryData.floor_per_arm}/arm floor,{" "}
                {summaryData.floor_total} total minimum).
              </Text>

              {summaryData.is_pilot_range ? (
                <View style={styles.badgeWarning}>
                  <AlertTriangle size={13} color={colors.gold} />
                  <Text style={styles.badgeWarningText}>
                    Below the {summaryData.target_min}-participant pilot range
                  </Text>
                </View>
              ) : (
                <View style={styles.badgeSuccess}>
                  <ShieldCheck size={13} color={colors.success} />
                  <Text style={styles.badgeSuccessText}>Within target range</Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <AlertTriangle size={16} color={colors.textPrimary} />
            <Text style={styles.cardTitle}>Attrition</Text>
          </View>

          {isAttritionLoading ? (
            <ActivityIndicator color={colors.ink} />
          ) : attritionError ? (
            <Text style={styles.errorText}>Couldn&apos;t load attrition data.</Text>
          ) : attritionRows.length === 0 ? (
            <Text style={styles.bodyText}>No enrolled participants yet.</Text>
          ) : (
            <>
              <Text style={styles.bodyText}>
                Session floor: {attrition?.session_floor}. {atRiskCount} of{" "}
                {attritionRows.length} participant
                {attritionRows.length === 1 ? "" : "s"} at risk.
              </Text>

              {attritionRows.map((row) => (
                <View
                  key={row.user_id}
                  style={[
                    styles.participantRow,
                    row.at_risk && styles.participantRowAtRisk,
                  ]}
                >
                  <View style={styles.participantHeaderRow}>
                    <Text style={styles.participantName} numberOfLines={1}>
                      {row.name}
                    </Text>
                    {row.at_risk ? (
                      <View style={styles.riskPill}>
                        <Text style={styles.riskPillText}>At risk</Text>
                      </View>
                    ) : (
                      <View style={styles.okPill}>
                        <Text style={styles.okPillText}>On track</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.participantEmail} numberOfLines={1}>
                    {row.email}
                  </Text>
                  <Text style={styles.participantMeta}>
                    {row.study_arm} - {row.sessions_completed} session
                    {row.sessions_completed === 1 ? "" : "s"}
                    {row.enrolled_at
                      ? ` - enrolled ${new Date(
                          row.enrolled_at,
                        ).toLocaleDateString()}`
                      : ""}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <TrendingUp size={16} color={colors.textPrimary} />
            <Text style={styles.cardTitle}>Progress</Text>
          </View>

          {isProgressLoading ? (
            <ActivityIndicator color={colors.ink} />
          ) : progressError ? (
            <Text style={styles.errorText}>Couldn&apos;t load progress data.</Text>
          ) : progressRows.length === 0 ? (
            <Text style={styles.bodyText}>No enrolled participants yet.</Text>
          ) : (
            <>
              <Text style={styles.bodyText}>
                Baseline (pretest) vs. current rolling-average accuracy
                (window of {progress?.rolling_window_n}).
              </Text>

              {progressRows.map((row) => (
                <View key={row.user_id} style={styles.participantRow}>
                  <View style={styles.participantHeaderRow}>
                    <Text style={styles.participantName} numberOfLines={1}>
                      {row.name}
                    </Text>
                  </View>
                  <Text style={styles.participantEmail} numberOfLines={1}>
                    {row.email}
                  </Text>

                  {!row.baseline_completed ? (
                    <Text style={styles.participantMeta}>
                      Baseline not completed yet.
                    </Text>
                  ) : (
                    <>
                      <ProgressMetric
                        label="Pitch accuracy"
                        baselineLabel={
                          row.pitch.baseline_cents !== null
                            ? `${row.pitch.baseline_cents}c`
                            : "-"
                        }
                        currentLabel={
                          row.pitch.current_cents !== null
                            ? `${row.pitch.current_cents}c`
                            : "no practice yet"
                        }
                        improvement={row.pitch.improvement_pct}
                        improvementSuffix="%"
                        colors={colors}
                        styles={styles}
                      />
                      <ProgressMetric
                        label="Transcription"
                        baselineLabel={
                          row.transcription.baseline_pct !== null
                            ? `${row.transcription.baseline_pct}%`
                            : "-"
                        }
                        currentLabel={
                          row.transcription.current_pct !== null
                            ? `${row.transcription.current_pct}%`
                            : "no attempts yet"
                        }
                        improvement={row.transcription.improvement_pts}
                        improvementSuffix=" pts"
                        colors={colors}
                        styles={styles}
                      />
                    </>
                  )}
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// A single baseline -> current accuracy comparison line within a
// participant's Progress card row. Shared between the pitch and
// transcription metrics, which differ only in labels/units.
function ProgressMetric({
  label,
  baselineLabel,
  currentLabel,
  improvement,
  improvementSuffix,
  colors,
  styles,
}: {
  label: string;
  baselineLabel: string;
  currentLabel: string;
  improvement: number | null;
  improvementSuffix: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}) {
  const DeltaIcon =
    improvement === null || Math.abs(improvement) < 0.1
      ? Minus
      : improvement > 0
        ? TrendingUp
        : TrendingDown;
  const deltaColor =
    improvement === null
      ? colors.textMuted
      : improvement > 0.1
        ? colors.success
        : improvement < -0.1
          ? colors.danger
          : colors.textMuted;

  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValueText} numberOfLines={1}>
          {baselineLabel} {"→"} {currentLabel}
        </Text>
        {improvement !== null && (
          <View style={styles.metricDelta}>
            <DeltaIcon size={12} color={deltaColor} />
            <Text style={[styles.metricDeltaText, { color: deltaColor }]}>
              {improvement > 0 ? "+" : ""}
              {improvement}
              {improvementSuffix}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 60,
    },
    centeredContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      paddingHorizontal: 20,
    },
    deniedTitle: {
      fontFamily: "Georgia",
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    outlineButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    outlineButtonText: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: "700",
    },
    breadcrumb: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 14,
      marginBottom: 18,
    },
    breadcrumbText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
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
      marginBottom: 18,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginBottom: 16,
    },
    cardTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    cardTitle: {
      fontFamily: "Georgia",
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    bodyText: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.textPrimary,
      marginBottom: 12,
    },
    errorText: {
      fontSize: 14,
      color: colors.danger,
    },
    statRow: {
      flexDirection: "row",
      marginBottom: 16,
      gap: 12,
    },
    statBlock: {
      flex: 1,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    statValue: {
      fontFamily: "Georgia",
      fontSize: 24,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    statLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    badgeWarning: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
    },
    badgeWarningText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.gold,
    },
    badgeSuccess: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
    },
    badgeSuccessText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.success,
    },
    participantRow: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
    },
    participantRowAtRisk: {
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerSurface,
    },
    participantHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginBottom: 2,
    },
    participantName: {
      flex: 1,
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    participantEmail: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    participantMeta: {
      fontSize: 12,
      color: colors.textMuted,
      textTransform: "capitalize",
    },
    riskPill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: colors.danger,
    },
    riskPillText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.onInk,
    },
    okPill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: colors.success,
    },
    okPillText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.onInk,
    },
    metricRow: {
      marginTop: 8,
    },
    metricLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    metricValueRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    metricValueText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    metricDelta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    metricDeltaText: {
      fontSize: 12,
      fontWeight: "700",
    },
  });
