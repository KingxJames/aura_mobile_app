import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type ThemeMode = "light" | "dark" | "system";
export type ActiveTab =
  | "dashboard"
  | "curriculum"
  | "aural"
  | "tutor"
  | "transcription"
  | "progress";

export type ToastType = "success" | "error" | "info" | "warning";

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
  durationMs?: number;
};

type AppUiState = {
  sidebarOpen: boolean;
  activeTab: ActiveTab;
  theme: ThemeMode;
  globalLoading: boolean;
  activeModal: string | null;
  toasts: Toast[];
};

const initialState: AppUiState = {
  sidebarOpen: true,
  activeTab: "dashboard",
  theme: "system",
  globalLoading: false,
  activeModal: null,
  toasts: [],
};

const appUiSlice = createSlice({
  name: "appUi",
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },

    setActiveTab: (state, action: PayloadAction<ActiveTab>) => {
      state.activeTab = action.payload;
    },

    setTheme: (state, action: PayloadAction<ThemeMode>) => {
      state.theme = action.payload;
    },

    setGlobalLoading: (state, action: PayloadAction<boolean>) => {
      state.globalLoading = action.payload;
    },

    openModal: (state, action: PayloadAction<string>) => {
      state.activeModal = action.payload;
    },
    closeModal: (state) => {
      state.activeModal = null;
    },

    pushToast: (state, action: PayloadAction<Toast>) => {
      state.toasts.push(action.payload);
    },
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    clearToasts: (state) => {
      state.toasts = [];
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  setActiveTab,
  setTheme,
  setGlobalLoading,
  openModal,
  closeModal,
  pushToast,
  removeToast,
  clearToasts,
} = appUiSlice.actions;

export default appUiSlice.reducer;
