import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface TranscriptionState {
  currentScore: string | null; // Holds the active ABC notation string being played
  isAudioPlaying: boolean; // Tracks audio player loop state
}

const initialState: TranscriptionState = {
  currentScore: null,
  isAudioPlaying: false,
};

export const transcriptionSlice = createSlice({
  name: "transcription",
  initialState,
  reducers: {
    // Sets the active score returned from your Laravel upload action
    setActiveScore: (state, action: PayloadAction<string | null>) => {
      state.currentScore = action.payload;
    },
    // Simple state controls for your playback player UI
    setAudioPlaying: (state, action: PayloadAction<boolean>) => {
      state.isAudioPlaying = action.payload;
    },
    resetPlayback: (state) => {
      state.currentScore = null;
      state.isAudioPlaying = false;
    },
  },
});

export const { setActiveScore, setAudioPlaying, resetPlayback } =
  transcriptionSlice.actions;
export default transcriptionSlice.reducer;
