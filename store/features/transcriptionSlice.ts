import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type NotationFormat = "ABC_Notation" | "MusicXML" | "MIDI" | "unknown";

type TranscriptionUiState = {
  selectedImagePreview: string | null;
  selectedFileName: string | null;

  isUploading: boolean;
  uploadProgress: number; // 0 - 100

  selectedNotationFormat: NotationFormat;

  lastDigitalScore: string | null;
  lastMessage: string | null;
  lastError: string | null;
};

const initialState: TranscriptionUiState = {
  selectedImagePreview: null,
  selectedFileName: null,

  isUploading: false,
  uploadProgress: 0,

  selectedNotationFormat: "ABC_Notation",

  lastDigitalScore: null,
  lastMessage: null,
  lastError: null,
};

const transcriptionSlice = createSlice({
  name: "transcriptionUi",
  initialState,
  reducers: {
    setSelectedImage: (
      state,
      action: PayloadAction<{
        previewUrl: string | null;
        fileName?: string | null;
      }>,
    ) => {
      state.selectedImagePreview = action.payload.previewUrl;
      state.selectedFileName = action.payload.fileName ?? null;
      state.lastError = null;
    },

    clearSelectedImage: (state) => {
      state.selectedImagePreview = null;
      state.selectedFileName = null;
    },

    setUploading: (state, action: PayloadAction<boolean>) => {
      state.isUploading = action.payload;
      if (!action.payload) {
        state.uploadProgress = 0;
      }
    },

    setUploadProgress: (state, action: PayloadAction<number>) => {
      const value = Math.max(0, Math.min(100, action.payload));
      state.uploadProgress = value;
    },

    setSelectedNotationFormat: (
      state,
      action: PayloadAction<NotationFormat>,
    ) => {
      state.selectedNotationFormat = action.payload;
    },

    setTranscriptionResult: (
      state,
      action: PayloadAction<{
        digitalScore: string;
        notationFormat?: NotationFormat;
        message?: string;
      }>,
    ) => {
      state.lastDigitalScore = action.payload.digitalScore;
      state.selectedNotationFormat =
        action.payload.notationFormat ?? state.selectedNotationFormat;
      state.lastMessage = action.payload.message ?? "Transcription completed.";
      state.lastError = null;
      state.isUploading = false;
      state.uploadProgress = 100;
    },

    setTranscriptionError: (state, action: PayloadAction<string | null>) => {
      state.lastError = action.payload;
      state.isUploading = false;
      state.uploadProgress = 0;
    },

    resetTranscriptionState: () => initialState,
  },
});

export const {
  setSelectedImage,
  clearSelectedImage,
  setUploading,
  setUploadProgress,
  setSelectedNotationFormat,
  setTranscriptionResult,
  setTranscriptionError,
  resetTranscriptionState,
} = transcriptionSlice.actions;

export default transcriptionSlice.reducer;
