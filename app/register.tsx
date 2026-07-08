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

      router.replace("/(tabs)/grades");
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
            placeholderTextColor="#8f8a7d"
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
            placeholderTextColor="#8f8a7d"
            style={styles.input}
            value={email}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="Create a password"
            placeholderTextColor="#8f8a7d"
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
              <ActivityIndicator color="#ffffff" />
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
    fontSize: 36,
    letterSpacing: 0.8,
    color: "#171b24",
    fontFamily: Platform.select({ ios: "Times New Roman", android: "serif" }),
    fontWeight: "700",
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
    backgroundColor: "#f3f0e8",
    borderWidth: 1,
    borderColor: "#ddd6c8",
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  cardTablet: {
    maxWidth: 480,
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
    fontSize: 42,
    lineHeight: 46,
    fontFamily: Platform.select({ ios: "Times New Roman", android: "serif" }),
    marginBottom: 8,
  },
  subtitle: {
    color: "#5b5a55",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  label: {
    color: "#403d34",
    fontSize: 13,
    marginBottom: 6,
    marginTop: 10,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#c9c2b4",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  createButton: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: "#0f1f36",
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
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: {
    color: "#c1440e",
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  linkRow: {
    marginTop: 16,
    textAlign: "center",
    color: "#5f5a4f",
    fontSize: 14,
  },
  linkStrong: {
    color: "#111827",
    fontWeight: "700",
  },
});
