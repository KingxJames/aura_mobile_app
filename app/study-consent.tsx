import {
  useDeclineStudyMutation,
  useEnrollInStudyMutation,
  useGetStudyStatusQuery,
  useMarkStudyPromptSeenMutation,
} from "@/store/services/studyAPI";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";
import { useRouter } from "expo-router";
import { ArrowLeft, Check, EyeOff, Shuffle, Users } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function StudyConsentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [hasAgreed, setHasAgreed] = useState(false);
  const [status, setStatus] = useState<
    | "idle"
    | "enrolled"
    | "already_enrolled"
    | "declined"
    | "already_declined"
    | "error"
  >("idle");
  const [enrollInStudy, { isLoading }] = useEnrollInStudyMutation();
  const [declineStudy, { isLoading: isDeclining }] = useDeclineStudyMutation();
  const [markPromptSeen] = useMarkStudyPromptSeenMutation();
  const { data: statusData, isLoading: isCheckingStatus } =
    useGetStudyStatusQuery();

  // Purely informational now (analytics: "was this ever shown") - no longer
  // what gates re-showing this screen. That's enrolled/declined, an actual
  // recorded decision, not just having viewed the page once.
  useEffect(() => {
    markPromptSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Skip straight to the confirmation view if the status check finds the
  // user already made a decision (either way) - don't make them re-run the
  // consent form just to hit a 409 on submit.
  useEffect(() => {
    if (statusData?.enrolled) {
      setStatus("already_enrolled");
    } else if (statusData?.declined) {
      setStatus("already_declined");
    }
  }, [statusData?.enrolled, statusData?.declined]);

  // A decision (join or decline) has already been recorded server-side, as
  // opposed to just having seen this page - only then is it safe to let the
  // user navigate away, since StudyConsentGuard (app/_layout.tsx) will bounce
  // an undecided account straight back here regardless.
  const hasDecided = Boolean(statusData?.enrolled || statusData?.declined);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/grades");
    }
  };

  const handleJoin = async () => {
    try {
      await enrollInStudy({ consent: true }).unwrap();
      setStatus("enrolled");
    } catch (error: any) {
      if (error?.status === 409) {
        setStatus("already_enrolled");
      } else {
        setStatus("error");
      }
    }
  };

  const handleDecline = async () => {
    try {
      await declineStudy().unwrap();
      setStatus("declined");
    } catch (error: any) {
      if (error?.status === 409) {
        setStatus("already_enrolled");
      } else {
        setStatus("error");
      }
    }
  };

  const isDone =
    status === "enrolled" ||
    status === "already_enrolled" ||
    status === "declined" ||
    status === "already_declined";
  const isEnrolledOutcome =
    status === "enrolled" || status === "already_enrolled";

  // Once a decision is confirmed (either just now, or already on file), move
  // on automatically: enrolling goes to the one-time baseline (pretest) if
  // it hasn't been done yet, declining (or having never enrolled) goes
  // straight into the app. Waits for statusData to actually reflect the
  // decision (the post-mutation refetch) rather than firing on the local
  // status alone, so it doesn't race ahead on stale pre-decision data.
  useEffect(() => {
    if (!isDone || !hasDecided) return;
    if (statusData?.enrolled) {
      router.replace(
        statusData.baseline_required ? "/study-baseline" : "/(tabs)/grades",
      );
    } else if (statusData?.declined) {
      router.replace("/(tabs)/grades");
    }
  }, [isDone, hasDecided, statusData, router]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {hasDecided ? (
          <Pressable
            onPress={handleBack}
            style={styles.breadcrumb}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ArrowLeft size={15} color={colors.textSecondary} />
            <Text style={styles.breadcrumbText}>Settings</Text>
          </Pressable>
        ) : null}

        <Text style={styles.eyebrow}>RESEARCH STUDY</Text>
        <Text style={styles.heading}>Help Improve Aura</Text>
        <Text style={styles.subheading}>
          An optional study on AI-assisted practice feedback.
        </Text>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Users size={16} color={colors.textPrimary} />
            <Text style={styles.cardTitle}>What this involves</Text>
          </View>

          <Text style={styles.bodyText}>
            Aura is running a research study (a randomized controlled trial,
            lasting approximately 2-3 weeks) evaluating whether AI-generated,
            adaptive feedback improves pitch accuracy and transcription skill
            for beginner music students, compared to the app&apos;s standard,
            fixed feedback.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Shuffle size={16} color={colors.textPrimary} />
            <Text style={styles.cardTitle}>Random assignment &amp; blinding</Text>
          </View>

          <Text style={styles.bodyText}>
            If you choose to participate, you will be randomly assigned to
            one of two feedback and learning pathways within the app:
          </Text>
          <Text style={styles.bodyText}>
            • One pathway provides fixed, pre-written feedback and a
            consistent exercise sequence.{"\n"}• The other pathway provides
            AI-generated, personalized feedback and an adaptive exercise
            sequence that responds to your performance.
          </Text>
          <Text style={styles.bodyText}>
            You will not be told which pathway you have been assigned to, and
            you will remain blind to your condition for the entire study.
            This is standard research practice - it keeps the results from
            being influenced by expectation, and it does not affect your
            ability to use Aura normally.
          </Text>

          <View style={styles.cardTitleRow}>
            <EyeOff size={16} color={colors.textPrimary} />
            <Text style={styles.cardTitle}>What we collect</Text>
          </View>
          <Text style={styles.bodyText}>
            We&apos;ll record your practice attempts (audio, pitch accuracy,
            and timing) and any optional feedback you choose to leave, for
            research analysis.
          </Text>

          <Text style={styles.bodyText}>
            Participation is completely voluntary. Declining doesn&apos;t
            affect your normal use of Aura, and you can stop participating at
            any time, for any reason, without penalty.
          </Text>

          <Text style={styles.disclaimerText}>
            This study has been reviewed under [Institution]&apos;s research
            ethics guidelines. Questions? Contact [email].
          </Text>
        </View>

        {isCheckingStatus ? (
          <View style={styles.card}>
            <ActivityIndicator color={colors.ink} />
          </View>
        ) : !isDone ? (
          <>
            <Pressable
              onPress={() => setHasAgreed((prev) => !prev)}
              style={styles.consentRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: hasAgreed }}
            >
              <View
                style={[
                  styles.checkbox,
                  hasAgreed && styles.checkboxChecked,
                ]}
              >
                {hasAgreed ? <Check size={14} color={colors.onInk} /> : null}
              </View>
              <Text style={styles.consentText}>
                I have read the above and agree to participate.
              </Text>
            </Pressable>

            {status === "error" ? (
              <Text style={styles.formMessageError}>
                Something went wrong. Please try again.
              </Text>
            ) : null}

            <Pressable
              onPress={handleJoin}
              disabled={!hasAgreed || isLoading || isDeclining}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.saveButtonPressed,
                (!hasAgreed || isLoading || isDeclining) &&
                  styles.saveButtonDisabled,
              ]}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.onInk} />
              ) : (
                <Text style={styles.saveButtonText}>Join the study</Text>
              )}
            </Pressable>

            <Pressable
              onPress={handleDecline}
              disabled={isLoading || isDeclining}
              style={({ pressed }) => [
                styles.declineButton,
                pressed && styles.declineButtonPressed,
                (isLoading || isDeclining) && styles.saveButtonDisabled,
              ]}
            >
              {isDeclining ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <Text style={styles.declineButtonText}>
                  No thanks, don&apos;t include me
                </Text>
              )}
            </Pressable>
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {isEnrolledOutcome
                ? status === "already_enrolled"
                  ? "You're already part of this study"
                  : "You're enrolled"
                : status === "already_declined"
                  ? "You've already made your choice"
                  : "No problem"}
            </Text>
            <Text style={styles.bodyText}>
              {isEnrolledOutcome
                ? "Thanks for helping improve Aura. Just keep using the app as you normally would."
                : "You're not part of the study. Everything else in Aura works exactly the same."}
            </Text>
          </View>
        )}
      </ScrollView>
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
      marginBottom: 14,
    },
    disclaimerText: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
      fontStyle: "italic",
    },
    consentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 16,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxChecked: {
      backgroundColor: colors.ink,
      borderColor: colors.ink,
    },
    consentText: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
    },
    formMessageError: {
      fontSize: 13,
      color: colors.danger,
      marginBottom: 12,
    },
    saveButton: {
      borderRadius: 8,
      backgroundColor: colors.ink,
      paddingVertical: 15,
      alignItems: "center",
    },
    saveButtonPressed: {
      opacity: 0.9,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.onInk,
      fontSize: 16,
      fontWeight: "700",
    },
    declineButton: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 12,
    },
    declineButtonPressed: {
      opacity: 0.85,
    },
    declineButtonText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
  });
