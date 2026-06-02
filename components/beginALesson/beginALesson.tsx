import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import React from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";

export default function BeginALesson() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isNarrow = width < 380;

  const headlineSize = isNarrow ? 34 : 42;
  const headlineLineHeight = isNarrow ? 40 : 48;
  const descriptionSize = isNarrow ? 16 : 18;
  const descriptionLineHeight = isNarrow ? 26 : 30;
  const buttonTextSize = isNarrow ? 18 : 20;

  const handleBeginLesson = () => {
    router.push("/(tabs)/tutor");
  };

  return (
    <View style={styles.cardShell}>
      <LinearGradient
        colors={["#F4EFE5", "#F1EBDF", "#EEE6D7"]}
        start={{ x: 0.06, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <Text style={styles.kicker}>OPUS I · AURAL TUTOR</Text>

        <Text
          style={[
            styles.headlineLineOne,
            { fontSize: headlineSize, lineHeight: headlineLineHeight },
          ]}
        >
          A conservatory
        </Text>
        <Text
          style={[
            styles.headlineLineTwo,
            { fontSize: headlineSize, lineHeight: headlineLineHeight },
          ]}
        >
          in your pocket.
        </Text>

        <Text
          style={[
            styles.description,
            { fontSize: descriptionSize, lineHeight: descriptionLineHeight },
          ]}
        >
          AURA pairs a patient conversational tutor with live sheet music to
          guide you through graded music theory from first staff to chromatic
          colour.
        </Text>

        <Pressable
          onPress={handleBeginLesson}
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && styles.ctaButtonPressed,
          ]}
        >
          <SymbolView
            name={{
              ios: "sparkles",
              android: "auto_awesome",
              web: "auto_awesome",
            }}
            size={16}
            tintColor="#FFFFFF"
          />
          <Text style={[styles.ctaText, { fontSize: buttonTextSize }]}>
            Begin a lesson
          </Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    width: "100%",
    maxWidth: 460,
    borderRadius: 18,
    // borderWidth: 1,
    borderColor: "#D9CBB6",
    overflow: "hidden",
    boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.1)",
  },
  card: {
    paddingHorizontal: 26,
    paddingTop: 20,
    paddingBottom: 24,
  },
  kicker: {
    fontSize: 10,
    letterSpacing: 2.1,
    color: "#D79A1B",
    marginBottom: 14,
  },
  headlineLineOne: {
    color: "#12233E",
    fontFamily: "Georgia",
    marginBottom: 2,
  },
  headlineLineTwo: {
    color: "#D79A1B",
    fontFamily: "Georgia",
    fontStyle: "italic",
    marginBottom: 18,
  },
  description: {
    color: "#243854",
    marginBottom: 24,
  },
  ctaButton: {
    alignSelf: "flex-start",
    minHeight: 46,
    paddingHorizontal: 20,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#101E2F",
  },
  ctaButtonPressed: {
    opacity: 0.85,
  },
  ctaText: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
});
