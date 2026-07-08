import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import PlatformIcon from "../platformIcon/platformIcon";
import { useGetTranscriptionsQuery } from "../../store/services/transcriptionAPI";
import type { Transcription } from "../../store/services/transcriptionAPI";

interface TranscribeHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (transcription: Transcription) => void;
}

export default function TranscribeHistoryModal({
  visible,
  onClose,
  onSelect,
}: TranscribeHistoryModalProps) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const { data: transcriptions, isLoading } = useGetTranscriptionsQuery(
    undefined,
    { skip: !visible }
  );

  const renderItem = ({ item }: { item: Transcription }) => {
    const firstLine = item.generated_abc?.split("\n").find((l) => l.trim()) ?? "Sheet music";
    const date =
      item.formatted_date ??
      new Date(item.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

    return (
      <Pressable
        onPress={() => onSelect(item)}
        style={({ pressed }) => ({
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: "#EAE3D5",
          opacity: pressed ? 0.65 : 1,
        })}
      >
        <Text
          style={styles.itemTitle}
          numberOfLines={1}
        >
          {firstLine}
        </Text>
        <Text style={styles.itemDate}>{date}</Text>
      </Pressable>
    );
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        {/* DISMISS ZONE */}
        <Pressable style={styles.dismissOutsideZone} onPress={onClose} />

        {/* DRAWER */}
        <View
          style={[
            styles.drawerContentContainer,
            {
              width: isTablet ? 420 : "90%",
              borderLeftWidth: 1,
              borderColor: "#EAE3D5",
            },
          ]}
        >
          {/* HEADER */}
          <View style={styles.headerWrapperRow}>
            <Text style={styles.panelTitleText}>Past transcriptions</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close history panel"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <PlatformIcon
                ios="xmark.circle.fill"
                name="cancel"
                color="#D9A352"
                size={28}
              />
            </Pressable>
          </View>

          {/* BODY */}
          {isLoading ? (
            <View style={styles.centeredBody}>
              <ActivityIndicator color="#E2A960" />
            </View>
          ) : !transcriptions?.length ? (
            <View style={styles.listEmptyStateContentContainer}>
              <Text style={styles.emptyStateMessageText}>
                No transcriptions yet.
              </Text>
            </View>
          ) : (
            <FlatList
              data={transcriptions}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 30, 49, 0.12)",
    flexDirection: "row",
    justifyContent: "flex-end",
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
    backgroundColor: "#FAF6EE",
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
  centeredBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listEmptyStateContentContainer: {
    flex: 1,
    alignItems: "flex-start",
    paddingTop: 12,
  },
  emptyStateMessageText: {
    fontSize: 15,
    color: "#54657B",
    fontWeight: "400",
  },
  itemTitle: {
    color: "#162538",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  itemDate: {
    color: "#54657B",
    fontSize: 12,
  },
});
