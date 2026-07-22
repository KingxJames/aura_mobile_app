import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useGoogleSignInMutation } from "../../../store/services/authAPI";
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
        if (!active) return;
        router.replace("/(tabs)/grades");
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
