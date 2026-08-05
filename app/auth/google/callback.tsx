import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import { useGoogleSignInMutation } from "../../../store/services/authAPI";
import { useGetStudyStatusQuery } from "../../../store/services/studyAPI";
import type { RootState } from "../../../store/store";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";

type AuthState = "loading" | "error";

function toSingleValue(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default function GoogleAuthCallbackScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams();
  const [googleSignIn] = useGoogleSignInMutation();
  const [state, setState] = useState<AuthState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );
  // Tracked server-side per account (not a device-local flag), so switching
  // devices or a second account on the same device behaves correctly. Same
  // post-auth redirect logic as login.tsx/index.tsx - this screen is a
  // second entry point (the web OAuth redirect lands here directly, not on
  // login.tsx) that must not skip the consent/baseline gate.
  const { data: studyStatus, isFetching: isCheckingStudyStatus } =
    useGetStudyStatusQuery(undefined, { skip: !isAuthenticated });

  const token = useMemo(() => {
    const maybeGoogleToken = toSingleValue(params.google_token as string | string[] | undefined);
    const maybeIdToken = toSingleValue(params.id_token as string | string[] | undefined);
    const maybeToken = toSingleValue(params.token as string | string[] | undefined);
    return maybeGoogleToken || maybeIdToken || maybeToken;
  }, [params.google_token, params.id_token, params.token]);

  const oauthError = useMemo(() => {
    const err = toSingleValue(params.error as string | string[] | undefined);
    const message = toSingleValue(params.message as string | string[] | undefined);
    return err || message;
  }, [params.error, params.message]);

  useEffect(() => {
    let active = true;

    const completeSignIn = async () => {
      if (oauthError) {
        if (!active) return;
        setState("error");
        setErrorMessage(oauthError);
        return;
      }

      if (!token) {
        if (!active) return;
        setState("error");
        setErrorMessage("Google sign-in returned no authorization token.");
        return;
      }

      try {
        await googleSignIn({ google_token: token }).unwrap();
        // Redirect is handled by the isAuthenticated effect below, once the
        // study-status check resolves - matches login.tsx's pattern so this
        // entry point can't skip the consent/baseline gate.
      } catch (error) {
        if (!active) return;
        const message =
          error && typeof error === "object" && "data" in error
            ? (error as { data?: { message?: string } }).data?.message
            : null;

        setState("error");
        setErrorMessage(message || "Google sign-in failed. Please try again.");
      }
    };

    completeSignIn();

    return () => {
      active = false;
    };
  }, [googleSignIn, oauthError, router, token]);

  useEffect(() => {
    if (!isAuthenticated || isCheckingStudyStatus) return;

    if (!studyStatus?.prompt_seen) {
      router.replace("/study-consent");
    } else if (studyStatus.baseline_required) {
      router.replace("/study-baseline");
    } else {
      router.replace("/(tabs)/grades");
    }
  }, [isAuthenticated, studyStatus, isCheckingStudyStatus, router]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        {state === "loading" ? (
          <>
            <ActivityIndicator size="large" color={colors.blue} />
            <Text style={styles.title}>Completing Google sign-in...</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Sign-in failed</Text>
            <Text style={styles.subtitle}>{errorMessage}</Text>
            <Pressable onPress={() => router.replace("/login")} style={styles.button}>
              <Text style={styles.buttonText}>Back to sign in</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      gap: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: "center",
    },
    button: {
      marginTop: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: colors.blue,
    },
    buttonText: {
      color: colors.onInk,
      fontWeight: "600",
    },
  });
