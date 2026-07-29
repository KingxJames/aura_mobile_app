import { baseAPI } from "./baseAPI";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  count?: number;
  data?: T;
  error?: string;
};

export type AuralAttempt = {
  id: string;
  user_id: number;
  target_note: string;
  detected_frequency: number;
  cents_deviation: number;
  feedback_text: string | null;
  audio_path: string | null;
  created_at: string;
  updated_at: string;
};

type GetAuralAttemptsArgs = {
  userId: number;
};

// React Native's FormData accepts a { uri, name, type } part instead of a Web
// File/Blob - the DOM lib types don't know this shape, so callers cast to
// Blob when appending (same pattern as app/aural-training/exercise.tsx). On
// Expo web, FormData is the real browser API and does NOT understand that
// shape (it just stringifies to "[object Object]") - callers there must
// resolve the recording to a real Blob first (see toAudioFormPart in
// app/aural-practice.tsx) and pass that instead.
type RNFilePart = {
  uri: string;
  name: string;
  type: string;
};

type AnalyzeAuralBody = {
  audioFile: RNFilePart | Blob;
  audioFileName?: string;
  targetNote: string;
};

type UpdateAuralFeedbackBody = {
  id: string;
  feedback_text: string;
};

export type AuralAnalysisResult = {
  id: string;
  userId: number;
  targetNote: string;
  detectedFrequency: number;
  centsDeviation: number;
  feedbackText: string | null;
  audioPath: string | null;
  createdAt: string;
  updatedAt: string;
};

const mapAttemptToAnalysisResult = (
  attempt: AuralAttempt,
): AuralAnalysisResult => ({
  id: attempt.id,
  userId: attempt.user_id,
  targetNote: attempt.target_note,
  detectedFrequency: attempt.detected_frequency,
  centsDeviation: attempt.cents_deviation,
  feedbackText: attempt.feedback_text,
  audioPath: attempt.audio_path,
  createdAt: attempt.created_at,
  updatedAt: attempt.updated_at,
});

export const auralApi = baseAPI.injectEndpoints({
  endpoints: (build) => ({
    getAuralAttempts: build.query<AuralAttempt[], GetAuralAttemptsArgs>({
      query: ({ userId }) => `/v1/aural?user_id=${userId}`,
      transformResponse: (res: ApiEnvelope<AuralAttempt[]>) => res.data ?? [],
      providesTags: (result) =>
        result
          ? [
              { type: "AuralList" as const, id: "LIST" },
              ...result.map((a) => ({
                type: "AuralAttempt" as const,
                id: a.id,
              })),
            ]
          : [{ type: "AuralList" as const, id: "LIST" }],
    }),

    getAuralAttemptById: build.query<AuralAttempt, string>({
      query: (id) => `/v1/aural/${id}`,
      transformResponse: (res: ApiEnvelope<AuralAttempt>) =>
        res.data as AuralAttempt,
      providesTags: (result, error, id) => [{ type: "AuralAttempt", id }],
    }),

    analyzeAuralAudio: build.mutation<AuralAnalysisResult, AnalyzeAuralBody>({
      query: ({ audioFile, audioFileName, targetNote }) => {
        const formData = new FormData();

        // Real Blob (web, resolved from the recording's blob: URI) needs an
        // explicit filename arg; the RN { uri, name, type } shape (native)
        // already carries its own name and appends as a 2-arg call.
        if (audioFile instanceof Blob) {
          formData.append("audio", audioFile, audioFileName ?? "audio.m4a");
        } else {
          formData.append("audio", audioFile as unknown as Blob);
        }

        formData.append("target_note", targetNote);

        return {
          url: "/v1/aural/analyze",
          method: "POST",
          body: formData,
        };
      },
      transformResponse: (res: ApiEnvelope<AuralAttempt>) =>
        mapAttemptToAnalysisResult(res.data as AuralAttempt),
      invalidatesTags: [{ type: "AuralList", id: "LIST" }],
    }),

    updateAuralFeedback: build.mutation<AuralAttempt, UpdateAuralFeedbackBody>({
      query: ({ id, feedback_text }) => ({
        url: `/v1/aural/${id}`,
        method: "PUT",
        body: { feedback_text },
      }),
      transformResponse: (res: ApiEnvelope<AuralAttempt>) =>
        res.data as AuralAttempt,
      invalidatesTags: (result, error, { id }) => [
        { type: "AuralAttempt", id },
        { type: "AuralList", id: "LIST" },
      ],
    }),

    deleteAuralAttempt: build.mutation<
      { success: boolean; message?: string },
      string
    >({
      query: (id) => ({
        url: `/v1/aural/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "AuralAttempt", id },
        { type: "AuralList", id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetAuralAttemptsQuery,
  useGetAuralAttemptByIdQuery,
  useAnalyzeAuralAudioMutation,
  useUpdateAuralFeedbackMutation,
  useDeleteAuralAttemptMutation,
} = auralApi;
