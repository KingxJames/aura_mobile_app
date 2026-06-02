import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import {
  useGoogleSignInMutation,
  useLoginMutation,
} from "../store/services/authAPI";
import { API_HOST } from "../store/services/config/api";
import type { RootState } from "../store/store";

if (Platform.OS !== "web") {
  WebBrowser.maybeCompleteAuthSession();
}

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Sign in failed. Please try again.";
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

  return "Sign in failed. Please check your credentials.";
}

export default function Login() {
  const router = useRouter();
  const [login, { isLoading, error: loginError }] = useLoginMutation();
  const [googleSignIn, { isLoading: isGoogleLoading, error: googleError }] =
    useGoogleSignInMutation();
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [uiError, setUiError] = useState<string | null>(null);

  const isSubmitting = isLoading || isGoogleLoading;

  const errorMessage = useMemo(
    () =>
      uiError ??
      (googleError ? getErrorMessage(googleError) : null) ??
      (loginError ? getErrorMessage(loginError) : null),
    [googleError, loginError, uiError],
  );

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, router]);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim() || isSubmitting) {
      return;
    }

    setUiError(null);

    try {
      const response = await login({
        email: email.trim().toLowerCase(),
        password,
      }).unwrap();

      if (response.success === false) {
        return;
      }

      router.replace("/(tabs)");
    } catch {
      // handled by loginError render state
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSubmitting) return;

    setUiError(null);

    // 1. Create the deep link callback URL safely managed by Expo
    const redirectUri = Linking.createURL("auth/google/callback");
    const startUrl = process.env.EXPO_PUBLIC_GOOGLE_AUTH_START_URL;

    console.log("Redirect URI for Google Sign-In:", redirectUri);
    console.log("Google Auth Start URL:", startUrl);

    if (!startUrl) {
      setUiError(
        "Missing EXPO_PUBLIC_GOOGLE_AUTH_START_URL. Set it to your backend Google auth start endpoint.",
      );
      return;
    }

    // 2. Build out the query parameter payload securely
    const url = `${startUrl}${startUrl.includes("?") ? "&" : "?"}redirect_uri=${encodeURIComponent(redirectUri)}&platform=expo&host=${encodeURIComponent(API_HOST)}`;
    console.log("Constructed Google Auth URL:", url);

    try {
      if (Platform.OS === "web") {
        // Avoid popup polling on web (window.closed), which triggers COOP warnings.
        await Linking.openURL(url);
        return;
      }

      // 3. Kick off the web browser session authentication
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);

      if (result.type !== "success" || !result.url) {
        // User cancelled or explicitly closed the browser webview window
        return;
      }

      // 4. Parse callback URL and extract token.
      const parsedUrl = Linking.parse(result.url);
      const token =
        parsedUrl.queryParams?.google_token ||
        parsedUrl.queryParams?.id_token ||
        parsedUrl.queryParams?.token;

      if (!token) {
        setUiError("Google sign-in returned no authorization token.");
        return;
      }

      // 5. Send token to RTK Query endpoint.
      // NOTE: We stripped `router.replace` from here because your useEffect handles the redirect!
      await googleSignIn({ google_token: token as string }).unwrap();
    } catch (err) {
      // Extract accurate server error messaging if available, otherwise fall back
      setUiError(
        getErrorMessage(err) ?? "Google sign-in failed. Please try again.",
      );
    }
  };

  const handleCreateAccount = () => {
    router.push("/register");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.screen}
      >
        <View style={styles.topBar}>
          <Text style={styles.brand}>AURA</Text>
          <Text style={styles.version}>AURAL TUTOR · OP. 1</Text>
          <Pressable style={styles.topActionButton}>
            <Text style={styles.topActionText}>Sign in</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.kicker}>CONSERVATORY</Text>
          <Text style={styles.heading}>Welcome back.</Text>
          <Text style={styles.subtitle}>
            Sign in to save progress and pick up where you left off.
          </Text>

          <Pressable
            disabled={isSubmitting}
            onPress={handleGoogleSignIn}
            style={({ pressed }) => [
              styles.googleButton,
              isSubmitting && styles.googleButtonDisabled,
              pressed && styles.googleButtonPressed,
            ]}
          >
            <Text style={styles.googleG}>G</Text>
            <Text style={styles.googleText}>Continue with Google</Text>
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@conservatory.com"
            placeholderTextColor="#8f8a7d"
            style={styles.input}
            value={email}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor="#8f8a7d"
            secureTextEntry
            style={styles.input}
            value={password}
          />

          <Pressable
            disabled={isSubmitting}
            onPress={handleSignIn}
            style={({ pressed }) => [
              styles.signInButton,
              isSubmitting && styles.signInButtonDisabled,
              pressed && styles.signInButtonPressed,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.signInButtonText}>Sign in</Text>
            )}
          </Pressable>

          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : null}

          <Pressable>
            <Text style={styles.linkMuted}>Forgot your password?</Text>
          </Pressable>

          <Pressable onPress={handleCreateAccount}>
            <Text style={styles.linkRow}>
              New here? <Text style={styles.linkStrong}>Create an account</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#efece4",
  },
  screen: {
    flex: 1,
    backgroundColor: "#efece4",
  },
  topBar: {
    height: 72,
    borderBottomWidth: 1,
    borderBottomColor: "#d4cfc2",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    fontSize: 24,
    letterSpacing: 0.8,
    color: "#171b24",
    fontFamily: Platform.select({ ios: "Times New Roman", android: "serif" }),
    fontWeight: "700",
  },
  version: {
    flex: 1,
    textAlign: "center",
    marginHorizontal: 10,
    fontSize: 10,
    letterSpacing: 2,
    color: "#5f5a4f",
    fontWeight: "600",
  },
  topActionButton: {
    borderWidth: 1,
    borderColor: "#bbb4a5",
    borderRadius: 22,
    paddingVertical: 9,
    paddingHorizontal: 16,
    backgroundColor: "#f8f6f0",
  },
  topActionText: {
    fontWeight: "700",
    color: "#111827",
    fontSize: 14,
  },
  card: {
    marginTop: 22,
    marginHorizontal: 16,
    borderRadius: 16,
    backgroundColor: "#f3f0e8",
    borderWidth: 1,
    borderColor: "#ddd6c8",
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 2,
    color: "#c48020",
    fontWeight: "700",
    marginBottom: 8,
  },
  heading: {
    color: "#0f1f36",
    fontSize: 48,
    lineHeight: 52,
    fontFamily: Platform.select({ ios: "Times New Roman", android: "serif" }),
    marginBottom: 8,
  },
  subtitle: {
    color: "#263247",
    fontSize: 31,
    lineHeight: 36,
    marginBottom: 22,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#d7d0c2",
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 18,
    backgroundColor: "#f8f5ee",
  },
  googleButtonPressed: {
    opacity: 0.9,
  },
  googleButtonDisabled: {
    opacity: 0.7,
  },
  googleG: {
    color: "#d4342f",
    fontWeight: "700",
    fontSize: 22,
  },
  googleText: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "600",
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#d6d0c3",
  },
  orText: {
    marginHorizontal: 12,
    color: "#6d675a",
    letterSpacing: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  label: {
    color: "#101827",
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d7d0c2",
    borderRadius: 8,
    backgroundColor: "#f6f3ec",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#111827",
    fontSize: 22,
    marginBottom: 14,
  },
  signInButton: {
    marginTop: 2,
    borderRadius: 8,
    backgroundColor: "#0f1b2c",
    paddingVertical: 14,
    alignItems: "center",
  },
  signInButtonPressed: {
    opacity: 0.9,
  },
  signInButtonDisabled: {
    opacity: 0.8,
  },
  signInButtonText: {
    color: "#ffffff",
    fontSize: 27,
    fontWeight: "700",
  },
  errorText: {
    marginTop: 12,
    textAlign: "center",
    color: "#9b1c1c",
    fontSize: 13,
    fontWeight: "600",
  },
  linkMuted: {
    marginTop: 16,
    textAlign: "center",
    color: "#565e6b",
    fontSize: 14,
  },
  linkRow: {
    marginTop: 12,
    textAlign: "center",
    color: "#2f3848",
    fontSize: 18,
  },
  linkStrong: {
    color: "#0f1b2c",
    fontWeight: "700",
  },
});
