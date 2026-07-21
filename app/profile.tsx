import { buildMultipartBody } from "@/lib/multipart";
import { setUser } from "@/store/features/authSlice";
import { useLogoutMutation, useUploadAvatarMutation } from "@/store/services/authAPI";
import { API_HOST } from "@/store/services/config/api";
import type { RootState } from "@/store/store";
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
  const user = useSelector((state: RootState) => state.auth.user);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const [uploadAvatar, { isLoading: isUploadingAvatar }] = useUploadAvatarMutation();

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

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.breadcrumb}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={15} color="#8C8270" />
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
            placeholderTextColor="#8f8a7d"
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
                  <ActivityIndicator color="#16253A" />
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
            placeholderTextColor="#8f8a7d"
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
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>LESSONS</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>STREAK</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>MOCK EXAMS</Text>
          </View>
        </View>

        <View style={styles.footerRow}>
          <Pressable
            onPress={() => router.push("/(tabs)/grades")}
            style={styles.footerLink}
          >
            <Text style={styles.footerLinkText}>Browse curriculum</Text>
            <ChevronRight size={15} color="#16253A" />
          </Pressable>

          <Pressable
            onPress={handleLogout}
            disabled={isLoggingOut}
            style={({ pressed }) => [
              styles.footerLink,
              pressed && { opacity: 0.7 },
            ]}
          >
            <LogOut size={15} color="#8C8270" />
            <Text style={styles.signOutText}>
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5EFE3",
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
    color: "#8C8270",
    fontSize: 13,
    fontWeight: "600",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "#D79A1B",
  },
  heading: {
    fontFamily: "Georgia",
    fontSize: 30,
    fontWeight: "700",
    color: "#1B1A17",
    marginTop: 4,
    marginBottom: 18,
  },
  card: {
    backgroundColor: "#EFE9DC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D9CBB6",
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
    color: "#1B1A17",
  },
  emailText: {
    fontSize: 13,
    color: "#6d675a",
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1B1A17",
    marginBottom: 6,
    marginTop: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#d7d0c2",
    borderRadius: 8,
    backgroundColor: "#f6f3ec",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#111827",
    fontSize: 15,
    marginBottom: 14,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  uploadButton: {
    borderWidth: 1,
    borderColor: "#d7d0c2",
    borderRadius: 8,
    backgroundColor: "#f6f3ec",
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  uploadButtonPressed: {
    opacity: 0.8,
  },
  uploadButtonText: {
    color: "#16253A",
    fontSize: 15,
    fontWeight: "700",
  },
  saveButton: {
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: "#101E2F",
    paddingVertical: 15,
    alignItems: "center",
  },
  saveButtonPressed: {
    opacity: 0.9,
  },
  saveButtonText: {
    color: "#FFFFFF",
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
    borderColor: "#D9CBB6",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1B1A17",
  },
  statLabel: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "#8C8270",
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
    color: "#16253A",
  },
  signOutText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8C8270",
  },
});
