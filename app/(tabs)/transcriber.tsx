import { SymbolView } from "expo-symbols";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import TranscribeHistoryModal from "./../../components/transcribeHsitory/transcribeHistory";
import TranscribeHistoryButton from "./../../components/transcribeHsitory/transcribeHistoryButton";

export default function TranscriberScreen() {
  // 1. RESPONSIVE BREAKPOINTS
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isSmallPhone = width < 390;

  // 2. STATE MANAGER FOR HISTORY OVERLAY
  const [historyVisible, setHistoryVisible] = useState(false);

  // 3. LAYOUT PROP CALCULATIONS
  const contentHorizontalPadding = isTablet ? 48 : isSmallPhone ? 20 : 28;
  const topPadding = isTablet ? 140 : isSmallPhone ? 90 : 110;
  const contentMaxWidth = isTablet ? 800 : 680;

  // Typography Scaling
  const titleSize = isTablet ? 42 : isSmallPhone ? 32 : 36;
  const titleLineHeight = isTablet ? 48 : isSmallPhone ? 36 : 42;
  const subtitleSize = isTablet ? 20 : isSmallPhone ? 15 : 17;
  const subtitleLineHeight = isTablet ? 28 : isSmallPhone ? 21 : 24;
  const actionTextSize = isTablet ? 22 : isSmallPhone ? 16 : 18;
  const cardHeight = isTablet ? 140 : isSmallPhone ? 90 : 104;
  const iconSize = isTablet ? 24 : isSmallPhone ? 18 : 20;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#FAF6EE",
        alignItems: "center",
        paddingTop: topPadding,
      }}
    >
      {/* GLOBAL FLOATING HISTORY BUTTON LAYER */}
      <View
        style={{
          position: "absolute",
          top: isTablet ? 100 : 100,
          right: contentHorizontalPadding,
          zIndex: 10,
        }}
      >
        <TranscribeHistoryButton onPress={() => setHistoryVisible(true)} />
      </View>

      {/* DYNAMIC HISTORY SIDEBAR PANEL DRAWER OVERLAY */}
      <TranscribeHistoryModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
      />

      {/* MAIN VIEW CONTENT CONTAINER */}
      <View
        style={{
          width: "100%",
          paddingHorizontal: contentHorizontalPadding,
          maxWidth: contentMaxWidth,
        }}
      >
        {/* KICKER */}
        <Text
          style={{
            fontSize: 10,
            lineHeight: 12,
            letterSpacing: 1.8,
            fontWeight: "700",
            color: "#E2A960",
            marginBottom: 12,
          }}
        >
          SHEET READER
        </Text>

        {/* MAIN TITLE */}
        <Text
          style={{
            color: "#162538",
            fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
            marginBottom: 12,
            fontSize: titleSize,
            lineHeight: titleLineHeight,
          }}
        >
          Hear what you see
        </Text>

        {/* SUBTITLE DESCRIPTION */}
        <Text
          style={{
            color: "#40566D",
            marginBottom: 36,
            fontSize: subtitleSize,
            lineHeight: subtitleLineHeight,
            fontWeight: "400",
          }}
        >
          Snap or upload a single line of notation. AURA transcribes and plays
          it back.
        </Text>

        {/* TWO-COLUMN BUTTON ROW */}
        <View style={{ flexDirection: "row", width: "100%", gap: 14 }}>
          {/* TAKE PHOTO BUTTON */}
          <Pressable
            style={({ pressed }) => ({
              flex: 1,
              borderRadius: 18,
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: "#D3C9B9",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#FAF6EE",
              height: cardHeight,
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <SymbolView
                name={{ ios: "camera", android: "photo_camera", web: "camera" }}
                tintColor="#54657B"
                size={iconSize}
              />
              <Text
                style={{
                  color: "#54657B",
                  fontSize: actionTextSize,
                  fontWeight: "500",
                }}
              >
                Take photo
              </Text>
            </View>
          </Pressable>

          {/* UPLOAD BUTTON */}
          <Pressable
            style={({ pressed }) => ({
              flex: 1,
              borderRadius: 18,
              borderWidth: 1.5,
              borderStyle: "dashed",
              borderColor: "#D3C9B9",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#FAF6EE",
              height: cardHeight,
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <SymbolView
                name={{
                  ios: "square.and.arrow.up",
                  android: "upload",
                  web: "upload",
                }}
                tintColor="#54657B"
                size={iconSize}
              />
              <Text
                style={{
                  color: "#54657B",
                  fontSize: actionTextSize,
                  fontWeight: "500",
                }}
              >
                Upload
              </Text>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
