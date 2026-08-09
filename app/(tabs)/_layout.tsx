import { Tabs } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Moon, Sun } from "lucide-react-native";
import PlatformIcon from "../../components/platformIcon/platformIcon";
import UserDropdownMenu from "../../components/userDropdownMenu/userDropdownMenu";
import { API_HOST } from "../../store/services/config/api";
import { setTheme } from "../../store/features/appUiSlice";
import type { AppDispatch, RootState } from "../../store/store";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";

export const unstable_settings = {
  initialRouteName: "aural",
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);
  const themeMode = useSelector((state: RootState) => state.appUi.theme);
  const systemScheme = useColorScheme();
  const resolvedScheme = themeMode === "system" ? systemScheme : themeMode;
  const isDarkMode = resolvedScheme === "dark";
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const isTablet = width >= 768;
  const isNarrowPhone = width < 390;
  const contentMaxWidth = 680;
  const contentSideInset =
    width > contentMaxWidth ? Math.max(14, (width - contentMaxWidth) / 2) : 14;
  const headerHeight = isTablet ? 96 : 86;
  const actionButtonSize = isTablet ? 44 : 40;
  const actionIconSize = isTablet ? 18 : 16;
  const avatarTextSize = isTablet ? 20 : 18;
  const tabIconSize = isTablet ? 20 : 18;
  const brandSize = isTablet ? 34 : isNarrowPhone ? 26 : 30;
  const brandLineHeight = isTablet ? 38 : isNarrowPhone ? 30 : 34;
  const tabBarBottomPadding = Math.max(insets.bottom, isTablet ? 12 : 8);

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

  const handleToggleTheme = () => {
    dispatch(setTheme(isDarkMode ? "light" : "dark"));
  };

  const closeUserMenu = () => {
    setIsUserMenuOpen(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.gold,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarShowLabel: true,
          tabBarLabelPosition: "below-icon",
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarItemStyle: styles.tabBarItem,
          headerTransparent: true,
          headerBackground: () => (
            <View style={styles.headerBackground}>
              <View
                style={[
                  styles.headerBackgroundInner,
                  {
                    marginHorizontal: contentSideInset,
                  },
                ]}
              />
            </View>
          ),
          tabBarStyle: [
            styles.tabBar,
            isTablet && styles.tabBarTablet,
            {
              paddingBottom: tabBarBottomPadding,
              marginHorizontal: contentSideInset,
            },
          ],
          sceneStyle: styles.scene,
          headerStyle: [styles.header, { height: headerHeight }],
          headerTitleAlign: "center",
          headerTitle: () =>
            isNarrowPhone ? null : (
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                AURAL TUTOR · OP. 1
              </Text>
            ),
          // Branded left-aligned title to match the classical header style.
          headerLeft: () => (
            <Text
              style={[
                styles.headerBrand,
                {
                  marginLeft: contentSideInset,
                  fontSize: brandSize,
                  lineHeight: brandLineHeight,
                },
              ]}
            >
              AURA
            </Text>
          ),
          headerRight: () => (
            <View
              style={[styles.headerActions, { marginRight: contentSideInset }]}
            >
              <Pressable
                onPress={handleToggleTheme}
                style={({ pressed }) => [
                  styles.iconCircleButton,
                  {
                    width: actionButtonSize,
                    height: actionButtonSize,
                    borderRadius: actionButtonSize / 2,
                  },
                  pressed && styles.iconCirclePressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  isDarkMode ? "Switch to light mode" : "Switch to dark mode"
                }
              >
                {isDarkMode ? (
                  <Sun size={actionIconSize} color={colors.textPrimary} />
                ) : (
                  <Moon size={actionIconSize} color={colors.textPrimary} />
                )}
              </Pressable>
              <Pressable
                onPress={handleToggleUserMenu}
                style={({ pressed }) => [
                  styles.avatarButton,
                  {
                    width: actionButtonSize,
                    height: actionButtonSize,
                    borderRadius: actionButtonSize / 2,
                  },
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
                  <Text
                    style={[styles.avatarText, { fontSize: avatarTextSize }]}
                  >
                    {fallbackInitial}
                  </Text>
                )}
              </Pressable>
            </View>
          ),
        }}
      >
        <Tabs.Screen
          name="grades"
          options={{
            title: "Grades",
            tabBarLabel: "Grades",
            tabBarIcon: ({ color }) => (
              <PlatformIcon
                ios="graduationcap.fill"
                name="school"
                color={color}
                size={tabIconSize}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="tutor"
          options={{
            title: "AI Tutor",
            tabBarLabel: "Tutor",
            tabBarIcon: ({ color }) => (
              <PlatformIcon
                ios="waveform.and.mic"
                name="chat"
                color={color}
                size={tabIconSize}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="aural"
          options={{
            title: "Aural Training",
            tabBarLabel: "Aural",
            tabBarIcon: ({ color }) => (
              <PlatformIcon
                ios="hearingdevice.ear"
                name="hearing"
                color={color}
                size={tabIconSize}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="transcriber"
          options={{
            // Hidden from the tab bar - not part of the live participant
            // study. Technical Sub-Question 1 (OMR latency) is answered via
            // a separate offline benchmark instead, so this stays out of
            // participant scope/consent. Route/file stays intact and
            // reachable, easily restorable by removing href: null - the
            // backend's OMR processing_ms telemetry is untouched either way.
            href: null,
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
            style={[
              styles.menuContainer,
              {
                top: insets.top + (isTablet ? 74 : 70),
                right: contentSideInset,
                width: isTablet ? 276 : 248,
              },
            ]}
            onPress={(event) => event.stopPropagation()}
          >
            <UserDropdownMenu onRequestClose={closeUserMenu} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    tabBar: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      height: 64,
      paddingTop: 6,
      elevation: 8,
      shadowColor: "#6C5B42",
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: -2 },
    },
    tabBarTablet: {
      height: 72,
      paddingTop: 8,
    },
    scene: {
      backgroundColor: colors.bg,
    },
    tabBarItem: {
      marginHorizontal: 4,
      marginVertical: 6,
      borderRadius: 16,
      justifyContent: "center",
    },
    tabBarLabel: {
      fontSize: 11,
      lineHeight: 13,
      fontWeight: "700",
      marginTop: 2,
      letterSpacing: 0.2,
    },
    header: {
      elevation: 0,
      shadowOpacity: 0,
      height: 86,
    },
    headerBackground: {
      flex: 1,
      backgroundColor: colors.bg,
      justifyContent: "flex-end",
    },
    headerBackgroundInner: {
      height: 1,
      backgroundColor: colors.border,
    },
    headerBrand: {
      marginLeft: 14,
      fontSize: 30,
      lineHeight: 34,
      fontWeight: "800",
      color: colors.textPrimary,
      letterSpacing: 0.6,
      fontFamily: "Georgia",
    },
    headerActions: {
      marginRight: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    headerSubtitle: {
      fontSize: 10,
      letterSpacing: 2,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    iconCircleButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
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
      backgroundColor: colors.blue,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarButtonPressed: {
      opacity: 0.8,
    },
    avatarText: {
      color: colors.onInk,
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
      width: 248,
      shadowColor: "#000000",
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
  });
