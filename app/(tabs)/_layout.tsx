import { Tabs, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import UserDropdownMenu from "../../components/userDropdownMenu/userDropdownMenu";
import { API_HOST } from "../../store/services/config/api";
import type { RootState } from "../../store/store";

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useSelector((state: RootState) => state.auth.user);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Normalize profile_picture into a fully-qualified URI that Image can load.
  const profileImageUri = useMemo(() => {
    if (typeof user?.profile_picture !== "string") {
      return null;
    }

    const trimmed = user.profile_picture.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
      return trimmed;
    }

    if (trimmed.startsWith("//")) {
      return `https:${trimmed}`;
    }

    if (trimmed.startsWith("/")) {
      return `${API_HOST}${trimmed}`;
    }

    return `${API_HOST}/${trimmed}`;
  }, [user?.profile_picture]);

  const fallbackInitial =
    user?.name?.trim()?.charAt(0)?.toUpperCase() ||
    user?.email?.trim()?.charAt(0)?.toUpperCase() ||
    "U";

  // Reset image-error state whenever the stored profile picture changes.
  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [profileImageUri]);

  const handleToggleUserMenu = () => {
    setIsUserMenuOpen((prev) => !prev);
  };

  const closeUserMenu = () => {
    setIsUserMenuOpen(false);
  };

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#D79A1B",
          tabBarInactiveTintColor: "#6E665B",
          headerTransparent: true,
          headerBackground: () => <View style={styles.headerBackground} />,
          tabBarStyle: styles.tabBar,
          headerStyle: styles.header,
          headerTitle: "",
          // Branded left-aligned title to match the classical header style.
          headerLeft: () => <Text style={styles.headerBrand}>AURA</Text>,
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.iconCircleButton,
                  pressed && styles.iconCirclePressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Theme"
              >
                <SymbolView
                  name={{
                    ios: "moon",
                    android: "dark_mode",
                    web: "dark_mode",
                  }}
                  tintColor="#1B1A17"
                  size={16}
                />
              </Pressable>

              <Pressable
                onPress={handleToggleUserMenu}
                style={({ pressed }) => [
                  styles.avatarButton,
                  pressed && styles.avatarButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Profile"
              >
                {/* Show profile image when available; fall back to user initial on failure. */}
                {profileImageUri && !avatarLoadFailed ? (
                  <Image
                    source={{ uri: profileImageUri }}
                    style={styles.avatarImage}
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : (
                  <Text style={styles.avatarText}>{fallbackInitial}</Text>
                )}
              </Pressable>
            </View>
          ),
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{
                  ios: "house.fill",
                  android: "home",
                  web: "home",
                }}
                tintColor={color}
                size={24}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="grades"
          options={{
            title: "Grades",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{
                  ios: "graduationcap.fill",
                  android: "school",
                  web: "school",
                }}
                tintColor={color}
                size={24}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="tutor"
          options={{
            title: "AI Tutor",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{
                  ios: "waveform.and.mic",
                  android: "chat",
                  web: "chat",
                }}
                tintColor={color}
                size={24}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="aural"
          options={{
            title: "Aural Training",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{
                  ios: "hearingdevice.ear",
                  android: "hearing",
                  web: "hearing",
                }}
                tintColor={color}
                size={24}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="transcriber"
          options={{
            title: "Transcriber",
            tabBarIcon: ({ color }) => (
              <SymbolView
                name={{
                  ios: "camera.metering.matrix",
                  android: "photo_camera",
                  web: "photo_camera",
                }}
                tintColor={color}
                size={24}
              />
            ),
          }}
        />
      </Tabs>

      <Modal
        transparent
        animationType="fade"
        visible={isUserMenuOpen}
        onRequestClose={closeUserMenu}
      >
        <Pressable style={styles.menuBackdrop} onPress={closeUserMenu}>
          <Pressable
            style={[styles.menuContainer, { top: insets.top + 70 }]}
            onPress={(event) => event.stopPropagation()}
          >
            <UserDropdownMenu />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#F5EFE3",
    borderTopColor: "#D9CBB6",
    borderTopWidth: 1,
    height: 68,
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingBottom: 8,
    paddingTop: 6,
    elevation: 0,
    shadowOpacity: 0,
  },
  header: {
    elevation: 0,
    shadowOpacity: 0,
    height: 86,
  },
  headerBackground: {
    flex: 1,
    backgroundColor: "#F5EFE3",
    borderBottomColor: "#D9CBB6",
    borderBottomWidth: 1,
  },
  headerBrand: {
    marginLeft: 14,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    color: "#1B1A17",
    letterSpacing: 0.6,
    fontFamily: "Georgia",
  },
  headerActions: {
    marginRight: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#CFC5B5",
    backgroundColor: "#F5EFE3",
    alignItems: "center",
    justifyContent: "center",
  },
  iconCirclePressed: {
    opacity: 0.75,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#178CCF",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarButtonPressed: {
    opacity: 0.8,
  },
  avatarText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  menuBackdrop: {
    flex: 1,
  },
  menuContainer: {
    position: "absolute",
    right: 14,
    width: 248,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
