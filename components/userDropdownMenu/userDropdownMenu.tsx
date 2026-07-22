import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSelector } from "react-redux";
import PlatformIcon from "../platformIcon/platformIcon";
import { useLogoutMutation } from "../../store/services/authAPI";
import type { RootState } from "../../store/store";
import { useThemeColors } from "../../hooks/useThemeColors";
import type { ThemeColors } from "../../constants/Colors";

type MenuRowProps = {
  label: string;
  ios: React.ComponentProps<typeof SymbolView>["name"];
  name: React.ComponentProps<typeof PlatformIcon>["name"];
  onPress?: () => void;
  disabled?: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
};

function MenuRow({ label, ios, name, onPress, disabled, colors, styles }: MenuRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.menuRow,
        pressed && styles.menuRowPressed,
      ]}
    >
      <PlatformIcon ios={ios} name={name} color={colors.textPrimary} size={16} />
      <Text style={styles.menuLabel}>{label}</Text>
    </Pressable>
  );
}

type UserDropdownMenuProps = {
  onRequestClose?: () => void;
};

export default function UserDropdownMenu({ onRequestClose }: UserDropdownMenuProps) {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useSelector((state: RootState) => state.auth.user);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const displayName = user?.name?.trim() || "User";
  const displayEmail = user?.email?.trim() || "No email";

  const handleViewProfile = () => {
    onRequestClose?.();
    router.push("/profile");
  };

  const handleOpenSettings = () => {
    onRequestClose?.();
    router.push("/settings");
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
    <View style={styles.container}>
      <View style={styles.profileSection}>
        <Text style={styles.nameText}>{displayName}</Text>
        <Text style={styles.emailText}>{displayEmail}</Text>
      </View>

      <View style={styles.separator} />

      <MenuRow
        label="View profile"
        ios="person"
        name="person"
        onPress={handleViewProfile}
        colors={colors}
        styles={styles}
      />

      <MenuRow
        label="Settings"
        ios="gearshape"
        name="settings"
        onPress={handleOpenSettings}
        colors={colors}
        styles={styles}
      />

      <View style={styles.separator} />

      <MenuRow
        label={isLoggingOut ? "Signing out..." : "Sign out"}
        ios="rectangle.portrait.and.arrow.right"
        name="logout"
        onPress={handleLogout}
        disabled={isLoggingOut}
        colors={colors}
        styles={styles}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      minWidth: 224,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },

    profileSection: {
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 10,
    },
    nameText: {
      fontSize: 18,
      lineHeight: 18,
      fontWeight: "700",
      color: colors.textPrimary,
      fontFamily: "Georgia",
    },
    emailText: {
      marginTop: 2,
      fontSize: 13,
      color: colors.textSecondary,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
    },
    menuRow: {
      minHeight: 44,
      paddingHorizontal: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.surface,
    },
    menuRowPressed: {
      backgroundColor: colors.surfaceAlt,
    },
    menuLabel: {
      fontSize: 18,
      lineHeight: 18,
      color: colors.textPrimary,
      fontFamily: "Georgia",
    },
  });
