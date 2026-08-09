import { useGetStudyStatusQuery } from "@/store/services/studyAPI";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { ThemeColors } from "@/constants/Colors";

export default function RootIndex() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );
  // Tracked server-side per account (not a device-local flag), so switching
  // devices or a second account on the same device behaves correctly.
  const { data: studyStatus, isFetching: isCheckingStudyStatus } =
    useGetStudyStatusQuery(undefined, { skip: !isAuthenticated });

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (isCheckingStudyStatus) return;

    if (!studyStatus?.enrolled && !studyStatus?.declined) {
      router.replace("/study-consent");
    } else if (studyStatus.baseline_required) {
      router.replace("/study-baseline");
    } else {
      router.replace("/(tabs)/aural");
    }
  }, [isAuthenticated, studyStatus, isCheckingStudyStatus, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
  });
