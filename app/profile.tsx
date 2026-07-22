import { buildMultipartBody } from "@/lib/multipart";
import { setUser } from "@/store/features/authSlice";
import { useLogoutMutation, useUploadAvatarMutation } from "@/store/services/authAPI";
import { API_HOST } from "@/store/services/config/api";
import { useGetStudentProgressQuery } from "@/store/services/curriculumAPI";
import type { RootState } from "@/store/store";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { useRouter } from "expo-router";
import { ArrowLeft, ChevronRight, LogOut } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";

export default function ProfileScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useSelector((state: RootState) => state.auth.user);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const [uploadAvatar, { isLoading: isUploadingAvatar }] = useUploadAvatarMutation();
  const { data: progress, isLoading: isLoadingProgress } = useGetStudentProgressQuery(
    { userId: Number(user?.id) },
    { skip: !user?.id },
  );

  const lessonsCompleted = progress?.length ?? 0;
  const bestStreak = progress?.length
    ? Math.max(...progress.map((p) => p.current_streak))
    : 0;

  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [bio, setBio] = useState("");

  const isGoogleUser = user?.provider === "google";

  const avatarImageUri = useMemo(() => {
    const trimmed = user?.profile_picture?.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    if (trimmed.startsWith("/")) return `${API_HOST}${trimmed}`;
    return trimmed;
  }, [user?.profile_picture]);

  const fallbackInitial =
    displayName.trim().charAt(0).toUpperCase() ||
    user?.email?.trim()?.charAt(0)?.toUpperCase() ||
    "U";

  const handleSave = () => {
    if (!user) return;
    dispatch(
      setUser({
        ...user,
        name: displayName.trim() || user.name,
      }),
    );
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Photo library access is needed to set a profile picture.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];

    try {
      let fileBytes: Uint8Array;
      if (Platform.OS === "web") {
        const res = await fetch(asset.uri);
        fileBytes = new Uint8Array(await res.arrayBuffer());
      } else {
        const file = new File(asset.uri);
        fileBytes = file.bytesSync();
      }

      const { body, boundary } = buildMultipartBody(
        "avatar",
        fileBytes,
        asset.fileName || "avatar.jpg",
        asset.mimeType || "image/jpeg",
      );

      await uploadAvatar({ body, boundary }).unwrap();
    } catch {
      Alert.alert(
        "Upload failed",
        "Could not update your profile picture. Please try again.",
      );
    }
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

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/grades");
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
        <Text style={styles.heading}>Your Profile</Text>

        <View style={styles.card}>
          <View style={styles.identityRow}>
            <View style={styles.avatarCircle}>
              {avatarImageUri ? (
                <Image source={{ uri: avatarImageUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>{fallbackInitial}</Text>
              )}
            </View>
            <View style={styles.identityText}>
              <Text style={styles.nameText}>{user?.name ?? "Aura Scholar"}</Text>
              <Text style={styles.emailText}>{user?.email ?? "No email"}</Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Display name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            style={styles.textInput}
          />

          {!isGoogleUser ? (
            <>
              <Text style={styles.fieldLabel}>Profile picture</Text>
              <Pressable
                onPress={handlePickAvatar}
                disabled={isUploadingAvatar}
                style={({ pressed }) => [
                  styles.uploadButton,
                  pressed && styles.uploadButtonPressed,
                ]}
              >
                {isUploadingAvatar ? (
                  <ActivityIndicator color={colors.ink} />
                ) : (
                  <Text style={styles.uploadButtonText}>Upload photo</Text>
                )}
              </Pressable>
            </>
          ) : null}

          <Text style={styles.fieldLabel}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Pianist · Grade 3 · loves Satie"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={4}
            style={[styles.textInput, styles.textArea]}
          />

          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.saveButtonPressed,
            ]}
          >
            <Text style={styles.saveButtonText}>Save changes</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>
              {isLoadingProgress ? "…" : lessonsCompleted}
            </Text>
            <Text style={styles.statLabel}>LESSONS</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>
              {isLoadingProgress ? "…" : bestStreak}
            </Text>
            <Text style={styles.statLabel}>STREAK</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Pressable
            onPress={() => router.push("/(tabs)/grades")}
            style={styles.footerLink}
          >
            <Text style={styles.footerLinkText}>Browse curriculum</Text>
            <ChevronRight size={15} color={colors.ink} />
          </Pressable>

          <Pressable
            onPress={handleLogout}
            disabled={isLoggingOut}
            style={({ pressed }) => [
              styles.footerLink,
              pressed && { opacity: 0.7 },
            ]}
          >
            <LogOut size={15} color={colors.textSecondary} />
            <Text style={styles.signOutText}>
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </Text>
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
      marginBottom: 18,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
    },
    identityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      marginBottom: 20,
    },
    avatarCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#EFC896",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImage: {
      width: "100%",
      height: "100%",
    },
    avatarInitial: {
      fontSize: 22,
      fontWeight: "700",
      color: "#8A5A2B",
    },
    identityText: {
      flex: 1,
    },
    nameText: {
      fontFamily: "Georgia",
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    emailText: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 6,
      marginTop: 4,
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
    textArea: {
      minHeight: 90,
      textAlignVertical: "top",
    },
    uploadButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.surfaceAlt,
      paddingVertical: 12,
      alignItems: "center",
      marginBottom: 14,
    },
    uploadButtonPressed: {
      opacity: 0.8,
    },
    uploadButtonText: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: "700",
    },
    saveButton: {
      marginTop: 4,
      borderRadius: 8,
      backgroundColor: colors.ink,
      paddingVertical: 15,
      alignItems: "center",
    },
    saveButtonPressed: {
      opacity: 0.9,
    },
    saveButtonText: {
      color: colors.onInk,
      fontSize: 16,
      fontWeight: "700",
    },
    statsRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 20,
    },
    statTile: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    statValue: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    statLabel: {
      marginTop: 6,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.8,
      color: colors.textSecondary,
    },
    footerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 24,
    },
    footerLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    footerLinkText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.ink,
    },
    signOutText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
  });
