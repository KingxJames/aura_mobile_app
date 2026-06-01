import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type TutorUiState = {
  draftMessage: string;
  isSending: boolean;
  isTyping: boolean; // for showing "Aura is typing..."
  autoScrollEnabled: boolean;
  historyLoaded: boolean;

  // optional local filters/settings
  showOnlyAiMessages: boolean;
};

const initialState: TutorUiState = {
  draftMessage: "",
  isSending: false,
  isTyping: false,
  autoScrollEnabled: true,
  historyLoaded: false,
  showOnlyAiMessages: false,
};

const tutorUiSlice = createSlice({
  name: "tutorUi",
  initialState,
  reducers: {
    setDraftMessage: (state, action: PayloadAction<string>) => {
      state.draftMessage = action.payload;
    },
    clearDraftMessage: (state) => {
      state.draftMessage = "";
    },

    setIsSending: (state, action: PayloadAction<boolean>) => {
      state.isSending = action.payload;
    },

    setIsTyping: (state, action: PayloadAction<boolean>) => {
      state.isTyping = action.payload;
    },

    setAutoScrollEnabled: (state, action: PayloadAction<boolean>) => {
      state.autoScrollEnabled = action.payload;
    },

    setHistoryLoaded: (state, action: PayloadAction<boolean>) => {
      state.historyLoaded = action.payload;
    },

    setShowOnlyAiMessages: (state, action: PayloadAction<boolean>) => {
      state.showOnlyAiMessages = action.payload;
    },

    resetTutorUi: () => initialState,
  },
});

export const {
  setDraftMessage,
  clearDraftMessage,
  setIsSending,
  setIsTyping,
  setAutoScrollEnabled,
  setHistoryLoaded,
  setShowOnlyAiMessages,
  resetTutorUi,
} = tutorUiSlice.actions;

export default tutorUiSlice.reducer;
