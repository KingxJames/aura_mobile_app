import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const CURRICULUM_ITEMS = [
  { grade: 1, title: "Foundations of Pitch & Pulse" },
  { grade: 2, title: "Intervals & the Bass Clef" },
  { grade: 3, title: "Triads & Compound Time" },
  { grade: 4, title: "Harmony & Cadence" },
  { grade: 5, title: "Chromatic Colour & Form" },
];

export default function Curriculum() {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>The Curriculum</Text>
        <Text style={styles.allGrades}>All grades</Text>
      </View>

      <View style={styles.grid}>
        {CURRICULUM_ITEMS.map((item) => (
          <Pressable
            key={item.grade}
            style={({ pressed }) => [
              styles.card,
              styles.cardRegular,
              pressed && styles.cardPressed,
            ]}
          >
            <Text style={styles.gradeLabel}>GRADE</Text>
            <Text style={styles.gradeNumber}>{item.grade}</Text>
            <Text
              style={styles.cardTitle}
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {item.title}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.quote}>
        &ldquo;Music is the arithmetic of sounds.&rdquo; - Debussy
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  heading: {
    color: "#101A2A",
    fontFamily: "Georgia",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
  },
  allGrades: {
    color: "#2E425E",
    fontSize: 16,
    lineHeight: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D2C5B0",
    backgroundColor: "#F5F1E8",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    minHeight: 98,
  },
  cardRegular: {
    width: "48.5%",
  },
  cardPressed: {
    opacity: 0.85,
  },
  gradeLabel: {
    color: "#D79A1B",
    fontSize: 9,
    letterSpacing: 1.9,
    marginBottom: 4,
  },
  gradeNumber: {
    color: "#10203B",
    fontFamily: "Georgia",
    fontSize: 40,
    lineHeight: 42,
    marginBottom: 4,
  },
  cardTitle: {
    color: "#2A3C58",
    fontSize: 12,
    lineHeight: 16,
  },
  quote: {
    marginTop: 26,
    textAlign: "center",
    color: "#1F2F4A",
    fontFamily: "Georgia",
    fontStyle: "italic",
    fontSize: 13,
    lineHeight: 22,
  },
});
