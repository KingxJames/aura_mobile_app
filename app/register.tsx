import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRegisterMutation } from "../store/services/authAPI";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Registration failed. Please try again.";
  }

  const maybeError = error as {
    data?: { message?: string };
    message?: string;
  };

  if (maybeError.data?.message) {
    return maybeError.data.message;
  }

  if (maybeError.message) {
    return maybeError.message;
  }

  return "Registration failed. Please check your details.";
}

export default function Register() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [register, { isLoading, error: registerError }] = useRegisterMutation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [uiError, setUiError] = useState<string | null>(null);

  const errorMessage = useMemo(
    () => uiError ?? (registerError ? getErrorMessage(registerError) : null),
    [registerError, uiError],
  );

  const handleCreateAccount = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || isLoading) {
      setUiError("Please complete name, email, and password.");
      return;
    }

    if (password.length < 8) {
      setUiError("Password must be at least 8 characters.");
      return;
    }

    setUiError(null);

    try {
      const response = await register({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      }).unwrap();

      if (response.success === false) {
        setUiError(response.message || "Registration failed. Please try again.");
        return;
      }

      // Brand-new account - guaranteed to never have seen the consent
      // screen, so no need to check study status first.
      router.replace("/study-consent");
    } catch {
      // handled by registerError render state
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.screen}
      >
        <View style={styles.topBar}>
          <Text style={styles.brand}>AURA</Text>
          <Pressable style={styles.topActionButton} onPress={() => router.replace("/login")}>
            <Text style={styles.topActionText}>Sign in</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
        <View style={[styles.card, isTablet && styles.cardTablet]}>
          <Text style={styles.kicker}>CONSERVATORY</Text>
          <Text style={styles.heading}>Create account.</Text>
          <Text style={styles.subtitle}>
            Register to save your progress and access your sessions anywhere.
          </Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={name}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@conservatory.com"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={email}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="Create a password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={styles.input}
            value={password}
          />

          <Pressable
            disabled={isLoading}
            onPress={handleCreateAccount}
            style={({ pressed }) => [
              styles.createButton,
              isLoading && styles.createButtonDisabled,
              pressed && styles.createButtonPressed,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.onInk} />
            ) : (
              <Text style={styles.createButtonText}>Create account</Text>
            )}
          </Pressable>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <Pressable onPress={() => router.replace("/login")}>
            <Text style={styles.linkRow}>
              Already have an account? <Text style={styles.linkStrong}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    topBar: {
      height: 72,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    brand: {
      fontSize: 36,
      letterSpacing: 0.8,
      color: colors.textPrimary,
      fontFamily: Platform.select({ ios: "Times New Roman", android: "serif" }),
      fontWeight: "700",
    },
    topActionButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 22,
      paddingVertical: 9,
      paddingHorizontal: 16,
      backgroundColor: colors.surfaceAlt,
    },
    topActionText: {
      fontWeight: "700",
      color: colors.textPrimary,
      fontSize: 14,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      alignItems: "center",
      paddingBottom: 24,
    },
    card: {
      width: "100%",
      marginTop: 22,
      marginHorizontal: 16,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 18,
      paddingVertical: 20,
    },
    cardTablet: {
      maxWidth: 480,
    },
    kicker: {
      fontSize: 11,
      letterSpacing: 2,
      color: colors.gold,
      fontWeight: "700",
      marginBottom: 8,
    },
    heading: {
      color: colors.textPrimary,
      fontSize: 42,
      lineHeight: 46,
      fontFamily: Platform.select({ ios: "Times New Roman", android: "serif" }),
      marginBottom: 8,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 14,
    },
    label: {
      color: colors.textMuted,
      fontSize: 13,
      marginBottom: 6,
      marginTop: 10,
      fontWeight: "600",
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: colors.surfaceAlt,
      color: colors.textPrimary,
      fontSize: 15,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    createButton: {
      marginTop: 16,
      borderRadius: 12,
      backgroundColor: colors.ink,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    createButtonDisabled: {
      opacity: 0.7,
    },
    createButtonPressed: {
      opacity: 0.9,
    },
    createButtonText: {
      color: colors.onInk,
      fontSize: 16,
      fontWeight: "700",
    },
    errorText: {
      color: colors.danger,
      marginTop: 12,
      fontSize: 13,
      lineHeight: 18,
    },
    linkRow: {
      marginTop: 16,
      textAlign: "center",
      color: colors.textSecondary,
      fontSize: 14,
    },
    linkStrong: {
      color: colors.textPrimary,
      fontWeight: "700",
    },
  });
