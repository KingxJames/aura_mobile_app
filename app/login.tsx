import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#efece4" }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: "#efece4" }}
      >
        {/* Top Bar */}
        <View style={{
          height: 72,
          borderBottomWidth: 1,
          borderBottomColor: "#d4cfc2",
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <Text style={{
            fontSize: 24,
            letterSpacing: 0.8,
            color: "#171b24",
            fontFamily: Platform.select({ ios: "Times New Roman", android: "serif" }),
            fontWeight: "700",
          }}>AURA</Text>

          <Text style={{
            flex: 1,
            textAlign: "center",
            marginHorizontal: 10,
            fontSize: 10,
            letterSpacing: 2,
            color: "#5f5a4f",
            fontWeight: "600",
          }}>AURAL TUTOR · OP. 1</Text>

          <Pressable style={{
            borderWidth: 1,
            borderColor: "#bbb4a5",
            borderRadius: 22,
            paddingVertical: 9,
            paddingHorizontal: 16,
            backgroundColor: "#f8f6f0",
          }}>
            <Text style={{ fontWeight: "700", color: "#111827", fontSize: 14 }}>Sign in</Text>
          </Pressable>
        </View>

        {/* Card Container */}
        <View style={{
          marginTop: 22,
          marginHorizontal: 16,
          borderRadius: 16,
          backgroundColor: "#f3f0e8",
          borderWidth: 1,
          borderColor: "#ddd6c8",
          paddingHorizontal: 18,
          paddingVertical: 20,
        }}>
          <Text style={{ fontSize: 11, letterSpacing: 2, color: "#c48020", fontWeight: "700", marginBottom: 8 }}>
            CONSERVATORY
          </Text>
          <Text style={{
            color: "#0f1f36",
            fontSize: 48,
            lineHeight: 52,
            fontFamily: Platform.select({ ios: "Times New Roman", android: "serif" }),
            marginBottom: 8,
          }}>Welcome back.</Text>
          <Text style={{ color: "#263247", fontSize: 31, lineHeight: 36, marginBottom: 22 }}>
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
              borderColor: "#d7d0c2",
              borderRadius: 8,
              paddingVertical: 14,
              marginBottom: 18,
              backgroundColor: "#f8f5ee",
              opacity: pressed ? 0.9 : isSubmitting ? 0.7 : 1,
            })}
          >
            <Text style={{ color: "#d4342f", fontWeight: "700", fontSize: 22 }}>G</Text>
            <Text style={{ color: "#111827", fontSize: 18, fontWeight: "600" }}>Continue with Google</Text>
          </Pressable>

          {/* OR Separator */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: "#d6d0c3" }} />
            <Text style={{ marginHorizontal: 12, color: "#6d675a", letterSpacing: 2, fontSize: 11, fontWeight: "700" }}>
              OR
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "#d6d0c3" }} />
          </View>

          {/* Form Inputs */}
          <Text style={{ color: "#101827", fontWeight: "700", fontSize: 18, marginBottom: 8, marginTop: 4 }}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@conservatory.com"
            placeholderTextColor="#8f8a7d"
            style={{
              borderWidth: 1,
              borderColor: "#d7d0c2",
              borderRadius: 8,
              backgroundColor: "#f6f3ec",
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: "#111827",
              fontSize: 22,
              marginBottom: 14,
            }}
            value={email}
          />

          <Text style={{ color: "#101827", fontWeight: "700", fontSize: 18, marginBottom: 8, marginTop: 4 }}>Password</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor="#8f8a7d"
            secureTextEntry
            style={{
              borderWidth: 1,
              borderColor: "#d7d0c2",
              borderRadius: 8,
              backgroundColor: "#f6f3ec",
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: "#111827",
              fontSize: 22,
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
              backgroundColor: "#0f1b2c",
              paddingVertical: 14,
              alignItems: "center",
              opacity: pressed ? 0.9 : isSubmitting ? 0.8 : 1,
            })}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={{ color: "#ffffff", fontSize: 27, fontWeight: "700" }}>Sign in</Text>
            )}
          </Pressable>

          {/* Error Message */}
          {errorMessage ? (
            <Text style={{ marginTop: 12, textAlign: "center", color: "#9b1c1c", fontSize: 13, fontWeight: "600" }}>
              {errorMessage}
            </Text>
          ) : null}

          {/* Footer Links */}
          <Pressable>
            <Text style={{ marginTop: 16, textAlign: "center", color: "#565e6b", fontSize: 14 }}>
              Forgot your password?
            </Text>
          </Pressable>

          <Pressable onPress={handleCreateAccount}>
            <Text style={{ marginTop: 12, textAlign: "center", color: "#2f3848", fontSize: 18 }}>
              New here? <Text style={{ color: "#0f1b2c", fontWeight: "700" }}>Create an account</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}