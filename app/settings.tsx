import {
  setNotificationsEnabled,
  setTheme,
  type ThemeMode,
} from "@/store/features/appUiSlice";
import {
  useChangePasswordMutation,
  useLogoutMutation,
} from "@/store/services/authAPI";
import {
  useRegisterPushTokenMutation,
  useUnregisterPushTokenMutation,
} from "@/store/services/pushTokenAPI";
import type { RootState } from "@/store/store";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { ArrowLeft, Bell, Lock, Moon, LogOut, User } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

const THEME_OPTIONS: { label: string; value: ThemeMode }[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

async function getDevicePushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    Alert.alert(
      "Physical device required",
      "Push notifications only work on a physical device, not a simulator.",
    );
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId || typeof projectId !== "string") {
    Alert.alert(
      "Not configured yet",
      "Push notifications aren't set up for this build yet. Try again later.",
    );
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    Alert.alert(
      "Couldn't get push token",
      "Something went wrong setting up notifications. Please try again.",
    );
    return null;
  }
}

export default function SettingsScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useSelector((state: RootState) => state.auth.user);
  const theme = useSelector((state: RootState) => state.appUi.theme);
  const notificationsEnabled = useSelector(
    (state: RootState) => state.appUi.notificationsEnabled,
  );
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const [changePassword, { isLoading: isChangingPassword }] =
    useChangePasswordMutation();
  const [registerPushToken] = useRegisterPushTokenMutation();
  const [unregisterPushToken] = useUnregisterPushTokenMutation();

  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isGoogleUser = user?.provider === "google";

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/grades");
    }
  };

  const handleEditProfile = () => {
    router.push("/profile");
  };

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // auth state is cleared in logout onQueryStarted finally
    } finally {
      router.replace("/login");
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account",
      "Account deletion isn't available yet. Please contact support if you'd like your account removed.",
    );
  };

  const handleChangePassword = async () => {
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords don't match." });
      return;
    }

    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      }).unwrap();

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage({ type: "success", text: "Password updated." });
    } catch (error: any) {
      setPasswordMessage({
        type: "error",
        text: error?.data?.message ?? "Couldn't update your password.",
      });
    }
  };

  const handleToggleNotifications = async (nextValue: boolean) => {
    setIsTogglingNotifications(true);
    try {
      if (nextValue) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission required",
            "Enable notifications for Aura in your device settings to get streak reminders.",
          );
          return;
        }

        const token = await getDevicePushToken();
        if (!token) return;

        await registerPushToken({
          token,
          platform: Platform.OS === "ios" ? "ios" : "android",
        }).unwrap();
        dispatch(setNotificationsEnabled(true));
      } else {
        const token = await getDevicePushToken();
        if (token) {
          await unregisterPushToken({ token }).unwrap();
        }
        dispatch(setNotificationsEnabled(false));
      }
    } catch {
      Alert.alert(
        "Something went wrong",
        "Couldn't update your notification preference. Please try again.",
      );
    } finally {
      setIsTogglingNotifications(false);
    }
  };

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
          <Text style={styles.breadcrumbText}>Studio</Text>
        </Pressable>

        <Text style={styles.eyebrow}>STUDIO</Text>
        <Text style={styles.heading}>Settings</Text>
        <Text style={styles.subheading}>Tune the experience to your liking.</Text>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <User size={16} color={colors.textPrimary} />
            <Text style={styles.cardTitle}>Account</Text>
          </View>

          <Text style={styles.fieldLabel}>Signed in as</Text>
          <Text style={styles.emailText}>{user?.email ?? "No email"}</Text>

          <View style={styles.buttonRow}>
            <Pressable
              onPress={handleEditProfile}
              style={({ pressed }) => [
                styles.outlineButton,
                pressed && styles.outlineButtonPressed,
              ]}
            >
              <Text style={styles.outlineButtonText}>Edit profile</Text>
            </Pressable>

            <Pressable
              onPress={handleLogout}
              disabled={isLoggingOut}
              style={({ pressed }) => [
                styles.textLink,
                pressed && { opacity: 0.7 },
              ]}
            >
              <LogOut size={15} color={colors.textSecondary} />
              <Text style={styles.signOutText}>
                {isLoggingOut ? "Signing out..." : "Sign out"}
              </Text>
            </Pressable>
          </View>
        </View>

        {!isGoogleUser ? (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Lock size={16} color={colors.textPrimary} />
              <Text style={styles.cardTitle}>Change password</Text>
            </View>

            <Text style={styles.fieldLabel}>Current password</Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.textInput}
            />

            <Text style={styles.fieldLabel}>New password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.textInput}
            />

            <Text style={styles.fieldLabel}>Confirm new password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={styles.textInput}
            />

            {passwordMessage ? (
              <Text
                style={[
                  styles.formMessage,
                  passwordMessage.type === "error" && styles.formMessageError,
                ]}
              >
                {passwordMessage.text}
              </Text>
            ) : null}

            <Pressable
              onPress={handleChangePassword}
              disabled={
                isChangingPassword ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
              style={({ pressed }) => [
                styles.saveButton,
                pressed && styles.saveButtonPressed,
                (isChangingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword) &&
                  styles.saveButtonDisabled,
              ]}
            >
              {isChangingPassword ? (
                <ActivityIndicator color={colors.onInk} />
              ) : (
                <Text style={styles.saveButtonText}>Update password</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Moon size={16} color={colors.textPrimary} />
            <Text style={styles.cardTitle}>Appearance</Text>
          </View>

          <View style={styles.segmentedControl}>
            {THEME_OPTIONS.map((option) => {
              const isActive = theme === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => dispatch(setTheme(option.value))}
                  style={[
                    styles.segmentedOption,
                    isActive && styles.segmentedOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentedOptionText,
                      isActive && styles.segmentedOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Bell size={16} color={colors.textPrimary} />
            <Text style={styles.cardTitle}>Streak reminders</Text>
          </View>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>
              Get a nudge before you lose your practice streak.
            </Text>
            {isTogglingNotifications ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Switch
                value={notificationsEnabled}
                onValueChange={handleToggleNotifications}
                trackColor={{ false: colors.border, true: colors.ink }}
                thumbColor={colors.onInk}
              />
            )}
          </View>
        </View>

        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Danger zone</Text>
          <Text style={styles.dangerDescription}>
            Permanently delete your account and all associated data.
          </Text>

          <Pressable
            onPress={handleDeleteAccount}
            style={({ pressed }) => [
              styles.dangerButton,
              pressed && styles.dangerButtonPressed,
            ]}
          >
            <Text style={styles.dangerButtonText}>Delete account</Text>
          </Pressable>
        </View>
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
    fieldLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 4,
    },
    emailText: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 18,
    },
    buttonRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    outlineButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    outlineButtonPressed: {
      opacity: 0.8,
    },
    outlineButtonText: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: "700",
    },
    textLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    signOutText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.textPrimary,
      fontSize: 15,
      marginBottom: 14,
    },
    formMessage: {
      fontSize: 13,
      color: colors.success,
      marginBottom: 12,
    },
    formMessageError: {
      color: colors.danger,
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
    segmentedControl: {
      flexDirection: "row",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surfaceAlt,
      padding: 4,
      gap: 4,
    },
    segmentedOption: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      borderRadius: 6,
    },
    segmentedOptionActive: {
      backgroundColor: colors.ink,
    },
    segmentedOptionText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.ink,
    },
    segmentedOptionTextActive: {
      color: colors.onInk,
    },
    toggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
    },
    toggleLabel: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
    },
    dangerCard: {
      backgroundColor: colors.dangerSurface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      padding: 20,
    },
    dangerTitle: {
      fontFamily: "Georgia",
      fontSize: 18,
      fontWeight: "700",
      color: colors.danger,
      marginBottom: 6,
    },
    dangerDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    dangerButton: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      borderRadius: 8,
      backgroundColor: colors.dangerSurface,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    dangerButtonPressed: {
      opacity: 0.8,
    },
    dangerButtonText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: "700",
    },
  });
