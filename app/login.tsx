import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import {
  useGoogleSignInMutation,
  useLoginMutation,
} from "../store/services/authAPI";
import { useGetStudyStatusQuery } from "../store/services/studyAPI";
import { API_HOST } from "../store/services/config/api";
import type { RootState } from "../store/store";
import { useThemeColors } from "@/hooks/useThemeColors";

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
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isSmallPhone = width < 360;
  const [login, { isLoading, error: loginError }] = useLoginMutation();
  const [googleSignIn, { isLoading: isGoogleLoading, error: googleError }] =
    useGoogleSignInMutation();
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );
  // Tracked server-side per account (not a device-local flag), so switching
  // devices or a second account on the same device behaves correctly.
  const { data: studyStatus, isFetching: isCheckingStudyStatus } =
    useGetStudyStatusQuery(undefined, { skip: !isAuthenticated });
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

  // Handles the post-login redirect uniformly for email/password AND Google
  // sign-in (neither submit handler navigates directly - both just wait for
  // isAuthenticated to flip true) - avoids a race against the status query,
  // which only starts fetching once isAuthenticated actually becomes true.
  useEffect(() => {
    if (!isAuthenticated || isCheckingStudyStatus) return;

    if (!studyStatus?.enrolled && !studyStatus?.declined) {
      router.replace("/study-consent");
    } else if (studyStatus.baseline_required) {
      router.replace("/study-baseline");
    } else {
      router.replace("/(tabs)/grades");
    }
  }, [isAuthenticated, studyStatus, isCheckingStudyStatus, router]);

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
      // Redirect is handled by the isAuthenticated effect above, once the
      // study-status check resolves.
    } catch {
      // handled by loginError render state
    }
  };

  const handleGoogleSignIn = async () => {
    if (isSubmitting) return;

    setUiError(null);

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

    const url = `${startUrl}${startUrl.includes("?") ? "&" : "?"}redirect_uri=${encodeURIComponent(redirectUri)}&platform=expo&host=${encodeURIComponent(API_HOST)}`;
    console.log("Constructed Google Auth URL:", url);

    try {
      if (Platform.OS === "web") {
        await Linking.openURL(url);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);

      if (result.type !== "success" || !result.url) {
        return;
      }

      const parsedUrl = Linking.parse(result.url);
      const token =
        parsedUrl.queryParams?.google_token ||
        parsedUrl.queryParams?.id_token ||
        parsedUrl.queryParams?.token;

      if (!token) {
        setUiError("Google sign-in returned no authorization token.");
        return;
      }

      await googleSignIn({ google_token: token as string }).unwrap();
    } catch (err) {
      setUiError(
        getErrorMessage(err) ?? "Google sign-in failed. Please try again.",
      );
    }
  };

  const handleCreateAccount = () => {
    router.push("/register");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: colors.bg }}
      >
        {/* Top Bar */}
        <View style={{
          height: 72,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <Text style={{
            fontSize: 24,
            letterSpacing: 0.8,
            color: colors.textPrimary,
            fontFamily: Platform.select({ ios: "Times New Roman", android: "serif" }),
            fontWeight: "700",
          }}>AURA</Text>

          <Text style={{
            flex: 1,
            textAlign: "center",
            marginHorizontal: 10,
            fontSize: 10,
            letterSpacing: 2,
            color: colors.textSecondary,
            fontWeight: "600",
          }}>AURAL TUTOR · OP. 1</Text>

          <Pressable style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 22,
            paddingVertical: 9,
            paddingHorizontal: 16,
            backgroundColor: colors.surfaceAlt,
          }}>
            <Text style={{ fontWeight: "700", color: colors.textPrimary, fontSize: 14 }}>Sign in</Text>
          </Pressable>
        </View>

        {/* Card Container */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, alignItems: "center", paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
        <View style={{
          width: "100%",
          maxWidth: isTablet ? 480 : undefined,
          marginTop: 22,
          marginHorizontal: 16,
          borderRadius: 16,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 18,
          paddingVertical: 20,
        }}>
          <Text style={{ fontSize: 11, letterSpacing: 2, color: colors.gold, fontWeight: "700", marginBottom: 8 }}>
            CONSERVATORY
          </Text>
          <Text style={{
            color: colors.textPrimary,
            fontSize: isSmallPhone ? 34 : isTablet ? 48 : 42,
            lineHeight: isSmallPhone ? 38 : isTablet ? 54 : 46,
            fontFamily: Platform.select({ ios: "Times New Roman", android: "serif" }),
            marginBottom: 8,
          }}>Welcome back.</Text>
          <Text style={{
            color: colors.textPrimary,
            fontSize: isSmallPhone ? 14 : isTablet ? 18 : 16,
            lineHeight: isSmallPhone ? 20 : isTablet ? 26 : 22,
            marginBottom: 22,
          }}>
            Sign in to save progress and pick up where you left off.
          </Text>

          {/* Google Sign In Button */}
          <Pressable
            disabled={isSubmitting}
            onPress={handleGoogleSignIn}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              paddingVertical: 14,
              marginBottom: 18,
              backgroundColor: colors.surfaceAlt,
              opacity: pressed ? 0.9 : isSubmitting ? 0.7 : 1,
            })}
          >
            <Text style={{ color: "#d4342f", fontWeight: "700", fontSize: 22 }}>G</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "600" }}>Continue with Google</Text>
          </Pressable>

          {/* OR Separator */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ marginHorizontal: 12, color: colors.textSecondary, letterSpacing: 2, fontSize: 11, fontWeight: "700" }}>
              OR
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          {/* Form Inputs */}
          <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 18, marginBottom: 8, marginTop: 4 }}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@conservatory.com"
            placeholderTextColor={colors.textMuted}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              backgroundColor: colors.surfaceAlt,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: colors.textPrimary,
              fontSize: 16,
              marginBottom: 14,
            }}
            value={email}
          />

          <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 18, marginBottom: 8, marginTop: 4 }}>Password</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 8,
              backgroundColor: colors.surfaceAlt,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: colors.textPrimary,
              fontSize: 16,
              marginBottom: 14,
            }}
            value={password}
          />

          {/* standard Sign In Button */}
          <Pressable
            disabled={isSubmitting}
            onPress={handleSignIn}
            style={({ pressed }) => ({
              marginTop: 2,
              borderRadius: 8,
              backgroundColor: colors.ink,
              paddingVertical: 14,
              alignItems: "center",
              opacity: pressed ? 0.9 : isSubmitting ? 0.8 : 1,
            })}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.onInk} />
            ) : (
              <Text style={{ color: colors.onInk, fontSize: 17, fontWeight: "700" }}>Sign in</Text>
            )}
          </Pressable>

          {/* Error Message */}
          {errorMessage ? (
            <Text style={{ marginTop: 12, textAlign: "center", color: colors.danger, fontSize: 13, fontWeight: "600" }}>
              {errorMessage}
            </Text>
          ) : null}

          {/* Footer Links */}
          <Pressable>
            <Text style={{ marginTop: 16, textAlign: "center", color: colors.textSecondary, fontSize: 14 }}>
              Forgot your password?
            </Text>
          </Pressable>

          <Pressable onPress={handleCreateAccount}>
            <Text style={{ marginTop: 12, textAlign: "center", color: colors.textPrimary, fontSize: 18 }}>
              New here? <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>Create an account</Text>
            </Text>
          </Pressable>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}