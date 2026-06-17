import { SymbolView } from "expo-symbols";
import React from "react";
import {
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from "react-native";

interface TranscribeHistoryModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function TranscribeHistoryModal({
  visible,
  onClose,
}: TranscribeHistoryModalProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      {/* BACKDROP DIM LAYOUT EDGE CONTAINER */}
      <View style={styles.modalBackdrop}>
        {/* DISMISS BACKDROP ACTION ZONE */}
        <Pressable style={styles.dismissOutsideZone} onPress={onClose} />

        {/* SIDE SHEET PANEL DRAWER BODY */}
        <View
          style={[
            styles.drawerContentContainer,
            {
              width: isTablet ? 420 : "90%", // Aligns perfectly to right-hand drawer styles
              borderLeftWidth: 1,
              borderColor: "#EAE3D5",
            },
          ]}
        >
          {/* HEADER SECTOR WITH DISMISS BUTTON */}
          <View style={styles.headerWrapperRow}>
            <Text style={styles.panelTitleText}>Past transcriptions</Text>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close history panel"
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <SymbolView
                name={{
                  ios: "xmark.circle.fill",
                  android: "cancel",
                  web: "cancel",
                }}
                tintColor="#D9A352" // Gorgeous golden amber color token matching design
                size={28}
              />
            </Pressable>
          </View>

          {/* DYNAMIC LIST CONTENT BODY LAYER (CURRENTLY SHOWING DESIGN EMPTY STATE) */}
          <View style={styles.listEmptyStateContentContainer}>
            <Text style={styles.emptyStateMessageText}>
              No transcriptions yet.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 30, 49, 0.12)", // Elegant soft transparent background dimming overlay
    flexDirection: "row",
    justifyContent: "flex-end", // Shifts sidebar layout strictly to the right side
  },
  dismissOutsideZone: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    zIndex: -1,
  },
  drawerContentContainer: {
    height: "100%",
    backgroundColor: "#FAF6EE", // Perfect warm cream tone color matching historical view sheet
    paddingTop: Platform.OS === "ios" ? 64 : 44,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 5,
  },
  headerWrapperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 40,
  },
  panelTitleText: {
    color: "#162538",
    fontSize: 24,
    fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
    fontWeight: "400",
  },
  listEmptyStateContentContainer: {
    flex: 1,
    alignItems: "flex-start", // Matches text alignment logic directly to historical reference images
    paddingTop: 12,
  },
  emptyStateMessageText: {
    fontSize: 15,
    color: "#54657B", // Soft steel gray font
    fontWeight: "400",
  },
});
