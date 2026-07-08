import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import { File, Paths } from "expo-file-system";
import { useDispatch, useSelector } from "react-redux";
import PlatformIcon from "../../components/platformIcon/platformIcon";
import TranscribeHistoryModal from "./../../components/transcribeHsitory/transcribeHistory";
import TranscribeHistoryButton from "./../../components/transcribeHsitory/transcribeHistoryButton";
import { useUploadTranscriptionMutation } from "../../store/services/transcriptionAPI";
import type { Transcription } from "../../store/services/transcriptionAPI";
import {
  setActiveTranscription,
  setAudioPlaying,
  resetPlayback,
} from "../../store/features/transcriptionSlice";
import type { RootState } from "../../store/store";

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function utf8ToUint8Array(text: string): Uint8Array {
  const utf8 = unescape(encodeURIComponent(text));
  const bytes = new Uint8Array(utf8.length);
  for (let i = 0; i < utf8.length; i++) {
    bytes[i] = utf8.charCodeAt(i);
  }
  return bytes;
}

function buildMultipartBody(
  fieldName: string,
  fileBytes: Uint8Array,
  filename: string,
  mimeType: string
): { body: Uint8Array; boundary: string } {
  const boundary = `AuraBoundary${Date.now()}`;
  const head = utf8ToUint8Array(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const tail = utf8ToUint8Array(`\r\n--${boundary}--\r\n`);

  const body = new Uint8Array(head.length + fileBytes.length + tail.length);
  body.set(head, 0);
  body.set(fileBytes, head.length);
  body.set(tail, head.length + fileBytes.length);

  return { body, boundary };
}

export default function TranscriberScreen() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const isSmallPhone = width < 390;

  const [historyVisible, setHistoryVisible] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const dispatch = useDispatch();
  const activeTranscription = useSelector(
    (s: RootState) => s.transcriptionUi.activeTranscription
  );
  const [uploadTranscription, { isLoading }] = useUploadTranscriptionMutation();

  useEffect(() => {
    return () => {
      sound?.unloadAsync();
    };
  }, [sound]);

  // Responsive layout values
  const contentHorizontalPadding = isTablet ? 48 : isSmallPhone ? 20 : 28;
  const topPadding = isTablet ? 140 : isSmallPhone ? 90 : 110;
  const contentMaxWidth = isTablet ? 800 : 680;
  const titleSize = isTablet ? 42 : isSmallPhone ? 32 : 36;
  const titleLineHeight = isTablet ? 48 : isSmallPhone ? 36 : 42;
  const subtitleSize = isTablet ? 20 : isSmallPhone ? 15 : 17;
  const subtitleLineHeight = isTablet ? 28 : isSmallPhone ? 21 : 24;
  const actionTextSize = isTablet ? 22 : isSmallPhone ? 16 : 18;
  const cardHeight = isTablet ? 140 : isSmallPhone ? 90 : 104;
  const iconSize = isTablet ? 24 : isSmallPhone ? 18 : 20;

  const stopCurrentAudio = async () => {
    if (sound) {
      await sound.stopAsync().catch(() => {});
      await sound.unloadAsync().catch(() => {});
      setSound(null);
    }
    setIsPlayingAudio(false);
    dispatch(setAudioPlaying(false));
  };

  const handleUploadFile = async (uri: string, type: string, name: string) => {
    await stopCurrentAudio();
    dispatch(resetPlayback());

    try {
      let fileBytes: Uint8Array;
      if (Platform.OS === "web") {
        // expo-file-system's File API is not supported on web; fetch the
        // blob/data URI directly instead.
        const res = await fetch(uri);
        fileBytes = new Uint8Array(await res.arrayBuffer());
      } else {
        const file = new File(uri);
        fileBytes = file.bytesSync();
      }

      const { body, boundary } = buildMultipartBody(
        "sheet_music_image",
        fileBytes,
        name,
        type
      );

      const transcription = await uploadTranscription({ body, boundary }).unwrap();
      dispatch(setActiveTranscription(transcription));
    } catch {
      Alert.alert(
        "Transcription failed",
        "Could not process the sheet music. Check that the image shows a clear single staff of notation and try again."
      );
    }
  };

  const handleUpload = async (asset: ImagePicker.ImagePickerAsset) => {
    await handleUploadFile(
      asset.uri,
      asset.mimeType || "image/jpeg",
      asset.fileName || "sheet.jpg"
    );
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission required",
        "Camera access is needed to photograph sheet music."
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      await handleUpload(result.assets[0]);
    }
  };

  const openLibrary = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/jpeg", "image/jpg", "image/png", "application/pdf"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await handleUploadFile(
        asset.uri,
        asset.mimeType || "application/octet-stream",
        asset.name || "sheet-music"
      );
    }
  };

  const playMidi = async () => {
    if (!activeTranscription?.generated_midi) return;
    try {
      await stopCurrentAudio();

      const midiBytes = base64ToUint8Array(activeTranscription.generated_midi);
      const midiFile = new File(Paths.cache, "score.mid");
      midiFile.write(midiBytes);

      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: midiFile.uri },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlayingAudio(true);
      dispatch(setAudioPlaying(true));

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlayingAudio(false);
          dispatch(setAudioPlaying(false));
        }
      });
    } catch {
      Alert.alert(
        "Playback unavailable",
        "Your device could not play this MIDI file. Try a different device or check audio settings."
      );
    }
  };

  const handleHistorySelect = async (transcription: Transcription) => {
    setHistoryVisible(false);
    await stopCurrentAudio();
    dispatch(setActiveTranscription(transcription));
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#FAF6EE" }}
      contentContainerStyle={{
        paddingTop: topPadding,
        alignItems: "center",
        paddingBottom: 40,
      }}
    >
      {/* FLOATING HISTORY BUTTON */}
      <View
        style={{
          position: "absolute",
          top: isTablet ? 100 : 60,
          right: contentHorizontalPadding,
          zIndex: 10,
        }}
      >
        <TranscribeHistoryButton onPress={() => setHistoryVisible(true)} />
      </View>

      <TranscribeHistoryModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        onSelect={handleHistorySelect}
      />

      {/* MAIN CONTENT */}
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

        {/* TITLE */}
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

        {/* SUBTITLE */}
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

        {/* ACTION BUTTONS */}
        <View
          style={{ flexDirection: "row", width: "100%", gap: 14, marginBottom: 32 }}
        >
          {/* CAMERA */}
          <Pressable
            onPress={openCamera}
            disabled={isLoading}
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
              opacity: pressed || isLoading ? 0.55 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <PlatformIcon
                ios="camera"
                name="photo-camera"
                color="#54657B"
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

          {/* UPLOAD */}
          <Pressable
            onPress={openLibrary}
            disabled={isLoading}
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
              opacity: pressed || isLoading ? 0.55 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <PlatformIcon
                ios="square.and.arrow.up"
                name="upload"
                color="#54657B"
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

        {/* LOADING STATE */}
        {isLoading && (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <ActivityIndicator size="large" color="#E2A960" />
            <Text
              style={{ color: "#40566D", marginTop: 16, fontSize: subtitleSize }}
            >
              Transcribing your sheet music…
            </Text>
          </View>
        )}

        {/* RESULT CARD */}
        {!isLoading && activeTranscription && (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "#EAE3D5",
              padding: 20,
            }}
          >
            {/* RESULT KICKER */}
            <Text
              style={{
                fontSize: 10,
                letterSpacing: 1.8,
                fontWeight: "700",
                color: "#E2A960",
                marginBottom: 12,
              }}
            >
              TRANSCRIPTION RESULT
            </Text>

            {/* ABC NOTATION PREVIEW */}
            <ScrollView
              style={{
                backgroundColor: "#F5F1EA",
                borderRadius: 10,
                padding: 14,
                maxHeight: 160,
                marginBottom: 20,
              }}
              nestedScrollEnabled
            >
              <Text
                style={{
                  fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  fontSize: 12,
                  color: "#2D3F52",
                  lineHeight: 18,
                }}
              >
                {activeTranscription.generated_abc}
              </Text>
            </ScrollView>

            {/* PLAYBACK CONTROLS */}
            {activeTranscription.generated_midi ? (
              <View style={{ flexDirection: "row", gap: 12 }}>
                {!isPlayingAudio ? (
                  <Pressable
                    onPress={playMidi}
                    style={({ pressed }) => ({
                      flex: 1,
                      backgroundColor: "#162538",
                      borderRadius: 14,
                      paddingVertical: 15,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 8,
                      opacity: pressed ? 0.82 : 1,
                    })}
                  >
                    <PlatformIcon
                      ios="play.fill"
                      name="play-arrow"
                      color="#FFFFFF"
                      size={18}
                    />
                    <Text
                      style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}
                    >
                      Play
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={stopCurrentAudio}
                    style={({ pressed }) => ({
                      flex: 1,
                      backgroundColor: "#40566D",
                      borderRadius: 14,
                      paddingVertical: 15,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 8,
                      opacity: pressed ? 0.82 : 1,
                    })}
                  >
                    <PlatformIcon
                      ios="stop.fill"
                      name="stop"
                      color="#FFFFFF"
                      size={18}
                    />
                    <Text
                      style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}
                    >
                      Stop
                    </Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Text
                style={{ color: "#54657B", fontSize: 13, textAlign: "center" }}
              >
                No audio available for this transcription.
              </Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
