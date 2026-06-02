import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function TodaysStudy() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Today&apos;s study</Text>
        <Text style={styles.grade}>GRADE I</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.lessonTitle}>The Staff & Treble Clef</Text>
        <Text style={styles.lessonSubtitle}>
          Read note names on the treble staff and identify lines vs. spaces.
        </Text>

        <View style={styles.staffPanel}>
          <View style={[styles.staffLine, { top: 24 }]} />
          <View style={[styles.staffLine, { top: 36 }]} />
          <View style={[styles.staffLine, { top: 48 }]} />
          <View style={[styles.staffLine, { top: 60 }]} />
          <View style={[styles.staffLine, { top: 72 }]} />

          <Text style={styles.clefHint}>G</Text>
          <Text style={styles.timeHint}>4/4</Text>

          <View style={[styles.note, { left: 86, top: 74 }]} />
          <View style={[styles.note, { left: 150, top: 62 }]} />
          <View style={[styles.note, { left: 214, top: 50 }]} />
          <View style={[styles.note, { left: 278, top: 38 }]} />

          <View style={[styles.stem, { left: 92, top: 50 }]} />
          <View style={[styles.stem, { left: 156, top: 38 }]} />
          <View style={[styles.stem, { left: 220, top: 26 }]} />
          <View style={[styles.stem, { left: 284, top: 14 }]} />
        </View>

        <Pressable
          onPress={() => router.push("/(tabs)/grades")}
          style={({ pressed }) => [
            styles.openLessonButton,
            pressed && styles.openLessonPressed,
          ]}
        >
          <Text style={styles.openLessonText}>Open lesson {"->"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 2,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  title: {
    color: "#1B1A17",
    fontSize: 17,
    lineHeight: 22,
    fontFamily: "Georgia",
    fontWeight: "700",
  },
  grade: {
    fontSize: 10,
    letterSpacing: 1.8,
    color: "#3D4F68",
    fontWeight: "700",
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D2C5B0",
    backgroundColor: "#F5F1E8",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  lessonTitle: {
    color: "#101A2A",
    fontFamily: "Georgia",
    fontSize: 20,
    lineHeight: 22,
    marginBottom: 6,
  },
  lessonSubtitle: {
    color: "#2E425E",
    fontSize: 12,
    lineHeight: 25,
    marginBottom: 14,
  },
  staffPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C8BBA4",
    backgroundColor: "#F8F4EC",
    height: 128,
    marginBottom: 12,
    position: "relative",
    overflow: "hidden",
  },
  staffLine: {
    position: "absolute",
    left: 36,
    right: 12,
    height: 1,
    backgroundColor: "#3B4D66",
    opacity: 0.75,
  },
  clefHint: {
    position: "absolute",
    left: 12,
    top: 40,
    fontSize: 28,
    lineHeight: 30,
    color: "#16253A",
    fontFamily: "Georgia",
  },
  timeHint: {
    position: "absolute",
    left: 40,
    top: 34,
    fontSize: 16,
    lineHeight: 20,
    color: "#16253A",
    fontFamily: "Georgia",
    fontWeight: "700",
  },
  note: {
    position: "absolute",
    width: 10,
    height: 8,
    borderRadius: 8,
    backgroundColor: "#111111",
    transform: [{ rotate: "-18deg" }],
  },
  stem: {
    position: "absolute",
    width: 1.5,
    height: 22,
    backgroundColor: "#111111",
  },
  openLessonButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingRight: 8,
  },
  openLessonPressed: {
    opacity: 0.75,
  },
  openLessonText: {
    color: "#10203B",
    fontSize: 16,
    fontFamily: "Georgia",
    fontWeight: "400",
  },
});
