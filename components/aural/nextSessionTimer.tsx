import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";
import type { RootState } from "@/store/store";
import { useGetAuralAttemptsQuery } from "@/store/services/auraAPI";
import { Clock, Sparkles } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSelector } from "react-redux";

// How long a user should rest between Free Practice sessions before the next
// one is "due". Based on the most recent aural_attempts row, not a calendar
// day boundary - see the "Timer basis" decision in conversation history.
const COOLDOWN_HOURS = 24;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function NextSessionTimer() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: attempts } = useGetAuralAttemptsQuery(
    { userId: Number(userId) },
    { skip: userId == null },
  );

  const [now, setNow] = useState(() => Date.now());

  const lastAttemptAt = useMemo(() => {
    if (!attempts || attempts.length === 0) return null;
    return attempts.reduce(
      (latest, attempt) => Math.max(latest, new Date(attempt.created_at).getTime()),
      0,
    );
  }, [attempts]);

  const nextEligibleAt = lastAttemptAt == null ? null : lastAttemptAt + COOLDOWN_MS;
  const msRemaining = nextEligibleAt == null ? 0 : nextEligibleAt - now;
  const isCoolingDown = msRemaining > 0;

  // Only tick a live clock while a countdown is actually being shown.
  useEffect(() => {
    if (!isCoolingDown) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isCoolingDown]);

  if (lastAttemptAt == null) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        {isCoolingDown ? (
          <Clock size={18} color={colors.textPrimary} />
        ) : (
          <Sparkles size={18} color={colors.textPrimary} />
        )}
      </View>
      <View style={styles.textColumn}>
        {isCoolingDown ? (
          <>
            <Text style={styles.title}>Next session in {formatCountdown(msRemaining)}</Text>
            <Text style={styles.subtitle}>
              Give your ear a rest — come back for your next practice soon.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Ready for your next session</Text>
            <Text style={styles.subtitle}>
              It's been {COOLDOWN_HOURS}+ hours since your last practice.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      marginBottom: 14,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    textColumn: {
      flex: 1,
    },
    title: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.textSecondary,
      marginTop: 2,
    },
  });
