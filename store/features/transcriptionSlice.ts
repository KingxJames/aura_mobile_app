import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { Transcription } from "../services/transcriptionAPI";

interface TranscriptionState {
  activeTranscription: Transcription | null;
  currentScore: string | null;
  currentMidi: string | null;
  isAudioPlaying: boolean;
}

const initialState: TranscriptionState = {
  activeTranscription: null,
  currentScore: null,
  currentMidi: null,
  isAudioPlaying: false,
};

export const transcriptionSlice = createSlice({
  name: "transcription",
  initialState,
  reducers: {
    setActiveTranscription: (state, action: PayloadAction<Transcription | null>) => {
      state.activeTranscription = action.payload;
      state.currentScore = action.payload?.generated_abc ?? null;
      state.currentMidi = action.payload?.generated_midi ?? null;
    },
    setAudioPlaying: (state, action: PayloadAction<boolean>) => {
      state.isAudioPlaying = action.payload;
    },
    resetPlayback: (state) => {
      state.activeTranscription = null;
      state.currentScore = null;
      state.currentMidi = null;
      state.isAudioPlaying = false;
    },
    setActiveScore: (state, action: PayloadAction<string | null>) => {
      state.currentScore = action.payload;
    },
  },
});

export const { setActiveTranscription, setAudioPlaying, resetPlayback, setActiveScore } =
  transcriptionSlice.actions;
export default transcriptionSlice.reducer;
