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

export default function AuralAndSheet() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 390;

  return (
    <View style={[styles.container, isCompact && styles.containerCompact]}>
      <Pressable
        onPress={() => router.push("/(tabs)/aural")}
        style={({ pressed }) => [
          styles.card,
          isCompact && styles.cardCompact,
          pressed && styles.cardPressed,
        ]}
      >
        <SymbolView
          name={{
            ios: "mic",
            android: "mic",
            web: "mic",
          }}
          tintColor="#D79A1B"
          size={16}
        />
        <Text style={styles.title}>Aural Coach</Text>
        <Text style={styles.subtitle}>Sing back · live feedback</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/(tabs)/transcriber")}
        style={({ pressed }) => [
          styles.card,
          isCompact && styles.cardCompact,
          pressed && styles.cardPressed,
        ]}
      >
        <SymbolView
          name={{
            ios: "viewfinder",
            android: "crop_free",
            web: "crop_free",
          }}
          tintColor="#D79A1B"
          size={16}
        />
        <Text style={styles.title}>Sheet Reader</Text>
        <Text style={styles.subtitle}>Upload · hear it back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
  },
  containerCompact: {
    flexDirection: "column",
  },
  card: {
    flex: 1,
    minHeight: 94,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D3C5B0",
    backgroundColor: "#F3EFE7",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 11,
  },
  cardCompact: {
    width: "100%",
  },
  cardPressed: {
    opacity: 0.82,
  },
  title: {
    marginTop: 10,
    color: "#101A2A",
    fontFamily: "Georgia",
    fontSize: 17,
    lineHeight: 22,
  },
  subtitle: {
    marginTop: 3,
    color: "#2A3C58",
    fontSize: 13,
    lineHeight: 18,
  },
});
