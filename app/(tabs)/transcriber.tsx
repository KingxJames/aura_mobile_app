import { SymbolView } from "expo-symbols";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

export default function TranscriberScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isSmallPhone = width < 390;

  const contentHorizontalPadding = isTablet ? 48 : isSmallPhone ? 16 : 24;
  const topPadding = isTablet ? 128 : isSmallPhone ? 88 : 104;
  const contentMaxWidth = isTablet ? 760 : 640;

  const titleSize = isTablet ? 44 : isSmallPhone ? 30 : 36;
  const titleLineHeight = isTablet ? 50 : isSmallPhone ? 34 : 40;

  const subtitleSize = isTablet ? 24 : isSmallPhone ? 16 : 19;
  const subtitleLineHeight = isTablet ? 32 : isSmallPhone ? 22 : 26;

  const uploadTextSize = isTablet ? 28 : isSmallPhone ? 18 : 22;
  const uploadTextLineHeight = isTablet ? 34 : isSmallPhone ? 24 : 28;

  const uploadCardHeight = isTablet ? 136 : isSmallPhone ? 96 : 112;
  const uploadIconSize = isTablet ? 24 : isSmallPhone ? 18 : 20;

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View
        style={[
          styles.content,
          {
            paddingHorizontal: contentHorizontalPadding,
            maxWidth: contentMaxWidth,
          },
        ]}
      >
        <Text style={styles.kicker}>SHEET READER</Text>

        <Text
          style={[
            styles.title,
            { fontSize: titleSize, lineHeight: titleLineHeight },
          ]}
        >
          Hear what you see
        </Text>

        <Text
          style={[
            styles.subtitle,
            { fontSize: subtitleSize, lineHeight: subtitleLineHeight },
          ]}
        >
          Snap or upload a single line of notation. AURA transcribes and plays
          it back.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Upload sheet music"
          style={({ pressed }) => [
            styles.uploadCard,
            { minHeight: uploadCardHeight },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.uploadRow}>
            <SymbolView
              name={{
                ios: "square.and.arrow.up",
                android: "upload",
                web: "upload",
              }}
              tintColor="#4D5B70"
              size={uploadIconSize}
            />

            <Text
              style={[
                styles.uploadText,
                { fontSize: uploadTextSize, lineHeight: uploadTextLineHeight },
              ]}
            >
              Upload sheet music
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5EFE3",
    alignItems: "center",
  },
  content: {
    width: "100%",
  },
  kicker: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.6,
    fontWeight: "700",
    color: "#D4A64E",
    marginBottom: 10,
  },
  title: {
    color: "#121E31",
    fontFamily: "Georgia",
    marginBottom: 8,
  },
  subtitle: {
    color: "#425772",
    marginBottom: 18,
  },
  uploadCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#D4CCBE",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5EFE3",
    paddingHorizontal: 16,
  },
  uploadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  uploadText: {
    color: "#364A64",
  },
  pressed: {
    opacity: 0.78,
  },
});
