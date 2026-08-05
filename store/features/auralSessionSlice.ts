import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type RecordingState = "idle" | "recording" | "stopped";

type AuralSessionState = {
  targetNote: string; // e.g. "A4"
  recordingState: RecordingState;

  recordedBlobUrl: string | null;
  recordedFileName: string | null;

  isSubmitting: boolean;
  lastAttemptId: string | null;

  // optional local UI hints (backend remains source of truth)
  detectedFrequencyPreview: number | null;
  centsDeviationPreview: number | null;
  feedbackPreview: string | null;

  // Wall-clock ms for the analyzeAuralAudio round trip (submit -> DSP result
  // back) - the "immediate sonic cross-referencing" latency, for the
  // evaluation's System Performance metric.
  analysisLatencyMs: number | null;
};

const initialState: AuralSessionState = {
  targetNote: "A4",
  recordingState: "idle",

  recordedBlobUrl: null,
  recordedFileName: null,

  isSubmitting: false,
  lastAttemptId: null,

  detectedFrequencyPreview: null,
  centsDeviationPreview: null,
  feedbackPreview: null,
  analysisLatencyMs: null,
};

const auralSessionSlice = createSlice({
  name: "auralSession",
  initialState,
  reducers: {
    setTargetNote: (state, action: PayloadAction<string>) => {
      state.targetNote = action.payload;
    },

    startRecording: (state) => {
      state.recordingState = "recording";
      state.recordedBlobUrl = null;
      state.recordedFileName = null;
      state.detectedFrequencyPreview = null;
      state.centsDeviationPreview = null;
      state.feedbackPreview = null;
      state.analysisLatencyMs = null;
    },

    stopRecording: (
      state,
      action: PayloadAction<{ blobUrl: string; fileName?: string }>,
    ) => {
      state.recordingState = "stopped";
      state.recordedBlobUrl = action.payload.blobUrl;
      state.recordedFileName = action.payload.fileName ?? null;
    },

    resetRecording: (state) => {
      state.recordingState = "idle";
      state.recordedBlobUrl = null;
      state.recordedFileName = null;
    },

    setSubmitting: (state, action: PayloadAction<boolean>) => {
      state.isSubmitting = action.payload;
    },

    setLastAttemptId: (state, action: PayloadAction<string | null>) => {
      state.lastAttemptId = action.payload;
    },

    setResultPreview: (
      state,
      action: PayloadAction<{
        detectedFrequency: number | null;
        centsDeviation: number | null;
        feedbackText: string | null;
        analysisLatencyMs?: number | null;
      }>,
    ) => {
      state.detectedFrequencyPreview = action.payload.detectedFrequency;
      state.centsDeviationPreview = action.payload.centsDeviation;
      state.feedbackPreview = action.payload.feedbackText;
      state.analysisLatencyMs = action.payload.analysisLatencyMs ?? null;
    },

    resetAuralSession: () => initialState,
  },
});

export const {
  setTargetNote,
  startRecording,
  stopRecording,
  resetRecording,
  setSubmitting,
  setLastAttemptId,
  setResultPreview,
  resetAuralSession,
} = auralSessionSlice.actions;

export default auralSessionSlice.reducer;
