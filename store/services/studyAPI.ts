import { baseAPI } from "./baseAPI";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
} & T;

type EnrollBody = {
  consent: true;
};

type StatusResponse = ApiEnvelope<{
  enrolled: boolean;
  prompt_seen: boolean;
  // Enrolled but hasn't finished the pretest yet - normal Free Practice/
  // Transcription (and their arm-specific feedback/gating) stay off-limits
  // until this clears, so the pretest can't be contaminated by treatment.
  baseline_required: boolean;
  baseline_completed: boolean;
}>;

export type BaselineStatus = ApiEnvelope<{
  completed: boolean;
  pitch_trials_required: number;
  pitch_trials_done: number;
  // Fixed, identical for every participant - same order for everyone.
  pitch_targets: string[];
  transcription_done: boolean;
}>;

type BaselinePitchAttemptBody = {
  audioFile: { uri: string; name: string; type: string } | Blob;
  audioFileName?: string;
};

export type BaselinePitchAttemptResult = ApiEnvelope<{
  data: {
    is_correct: boolean;
    cents_deviation: number;
    trial_number: number;
    trials_required: number;
  };
}>;

export type BaselineTranscriptionExercise = ApiEnvelope<{
  data: {
    exercise_id: number;
    key: string;
    note_sequence: { note_name: string; octave: number; duration_beats: number }[];
    ground_truth: { note_sequence: { note_name: string; octave: number; duration_beats: number }[] };
  };
}>;

type BaselineTranscriptionAttemptBody = {
  exercise_id: number;
  note_sequence: { note_name: string; octave: number; duration_beats: number }[];
};

export type BaselineTranscriptionAttemptResult = ApiEnvelope<{
  data: {
    attempt_id: number;
    is_correct: boolean;
    correctness_pct: number;
    correct_answer: { note_name: string; octave: number; duration_beats: number }[];
  };
}>;

// Deliberately does not return which experiment arm the user was assigned to -
// the study requires participants stay blinded to their condition.
export const studyApi = baseAPI.injectEndpoints({
  endpoints: (build) => ({
    getStudyStatus: build.query<StatusResponse, void>({
      query: () => ({
        url: "/v1/study/status",
        method: "GET",
      }),
      providesTags: ["Study"],
    }),

    enrollInStudy: build.mutation<ApiEnvelope<{}>, EnrollBody>({
      query: (body) => ({
        url: "/v1/study/enroll",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Study"],
    }),

    // Tracked per-account server-side (not a device-local flag) - marks that
    // the consent screen was shown, independent of whether the user joined.
    markStudyPromptSeen: build.mutation<ApiEnvelope<{}>, void>({
      query: () => ({
        url: "/v1/study/mark-prompt-seen",
        method: "POST",
      }),
      invalidatesTags: ["Study"],
    }),

    getBaselineStatus: build.query<BaselineStatus, void>({
      query: () => ({
        url: "/v1/study/baseline/status",
        method: "GET",
      }),
      providesTags: ["StudyBaseline"],
    }),

    submitBaselinePitchAttempt: build.mutation<
      BaselinePitchAttemptResult,
      BaselinePitchAttemptBody
    >({
      query: ({ audioFile, audioFileName }) => {
        const formData = new FormData();
        if (audioFile instanceof Blob) {
          formData.append("audio", audioFile, audioFileName ?? "baseline.m4a");
        } else {
          formData.append("audio", audioFile as unknown as Blob);
        }
        return {
          url: "/v1/study/baseline/pitch-attempt",
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: ["StudyBaseline"],
    }),

    // A mutation (not a query) even though it's a GET - repeat calls must be
    // able to re-fetch the same in-progress baseline exercise rather than
    // getting served a stale RTK Query cache entry.
    getBaselineTranscriptionExercise: build.mutation<
      BaselineTranscriptionExercise,
      void
    >({
      query: () => ({
        url: "/v1/study/baseline/transcription-exercise",
        method: "GET",
      }),
    }),

    submitBaselineTranscriptionAttempt: build.mutation<
      BaselineTranscriptionAttemptResult,
      BaselineTranscriptionAttemptBody
    >({
      query: (body) => ({
        url: "/v1/study/baseline/transcription-attempt",
        method: "POST",
        body,
      }),
      invalidatesTags: ["StudyBaseline"],
    }),

    completeBaseline: build.mutation<ApiEnvelope<{}>, void>({
      query: () => ({
        url: "/v1/study/baseline/complete",
        method: "POST",
      }),
      invalidatesTags: ["Study", "StudyBaseline"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetStudyStatusQuery,
  useEnrollInStudyMutation,
  useMarkStudyPromptSeenMutation,
  useGetBaselineStatusQuery,
  useSubmitBaselinePitchAttemptMutation,
  useGetBaselineTranscriptionExerciseMutation,
  useSubmitBaselineTranscriptionAttemptMutation,
  useCompleteBaselineMutation,
} = studyApi;
