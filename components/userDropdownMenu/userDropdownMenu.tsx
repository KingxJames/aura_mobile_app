import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSelector } from "react-redux";
import PlatformIcon from "../platformIcon/platformIcon";
import { useLogoutMutation } from "../../store/services/authAPI";
import type { RootState } from "../../store/store";

type MenuRowProps = {
  label: string;
  ios: React.ComponentProps<typeof SymbolView>["name"];
  name: React.ComponentProps<typeof PlatformIcon>["name"];
  onPress?: () => void;
  disabled?: boolean;
};

function MenuRow({ label, ios, name, onPress, disabled }: MenuRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.menuRow,
        pressed && styles.menuRowPressed,
      ]}
    >
      <PlatformIcon ios={ios} name={name} color="#1f1f1f" size={16} />
      <Text style={styles.menuLabel}>{label}</Text>
    </Pressable>
  );
}

type UserDropdownMenuProps = {
  onRequestClose?: () => void;
};

export default function UserDropdownMenu({ onRequestClose }: UserDropdownMenuProps) {
  const router = useRouter();
  const user = useSelector((state: RootState) => state.auth.user);
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

  const displayName = user?.name?.trim() || "User";
  const displayEmail = user?.email?.trim() || "No email";

  const handleViewProfile = () => {
    onRequestClose?.();
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
      />

      <MenuRow label="Settings" ios="gearshape" name="settings" />

      <View style={styles.separator} />

      <MenuRow
        label={isLoggingOut ? "Signing out..." : "Sign out"}
        ios="rectangle.portrait.and.arrow.right"
        name="logout"
        onPress={handleLogout}
        disabled={isLoggingOut}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 224,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d6d0c4",
    backgroundColor: "#f3f1ec",
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
    color: "#111111",
    fontFamily: "Georgia",
  },
  emailText: {
    marginTop: 2,
    fontSize: 13,
    color: "#4c4c4c",
  },
  separator: {
    height: 1,
    backgroundColor: "#d8d2c7",
  },
  menuRow: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f3f1ec",
  },
  menuRowPressed: {
    backgroundColor: "#ebe7dd",
  },
  menuLabel: {
    fontSize: 18,
    lineHeight: 18,
    color: "#1a1a1a",
    fontFamily: "Georgia",
  },
});
