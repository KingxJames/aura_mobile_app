import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";

export default function NotFound() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.code}>404</Text>
      <Text style={styles.title}>Page Not Found</Text>
      <Text style={styles.description}>
        The page you're looking for doesn't exist or may have been moved.
      </Text>

      <Pressable style={styles.button} onPress={() => router.replace("/")}>
        <Text style={styles.buttonText}>Go Home</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    code: {
      fontSize: 80,
      fontWeight: "bold",
      color: colors.blue,
    },
    title: {
      fontSize: 24,
      fontWeight: "600",
      color: colors.textPrimary,
      marginTop: 10,
    },
    description: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: 10,
      marginBottom: 25,
    },
    button: {
      backgroundColor: colors.blue,
      paddingVertical: 12,
      paddingHorizontal: 30,
      borderRadius: 8,
    },
    buttonText: {
      color: colors.onInk,
      fontSize: 16,
      fontWeight: "600",
    },
  });
