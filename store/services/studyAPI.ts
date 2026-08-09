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
  // A real, recorded decision not to join - distinct from prompt_seen
  // (which fires just from viewing the screen). "enrolled || declined"
  // is what the consent gate treats as "made a choice."
  declined: boolean;
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

// Researcher-only (backend-gated to is_admin accounts, see EnsureIsAdmin) -
// per-arm enrollment counts against the recruitment target/floor.
export type EnrollmentSummary = ApiEnvelope<{
  data: {
    control_count: number;
    experimental_count: number;
    total_enrolled: number;
    target_min: number;
    target_max: number;
    floor_total: number;
    floor_per_arm: number;
    is_pilot_range: boolean;
  };
}>;

// Researcher-only - per-participant completed-session counts, flagged when
// below the study's session floor so at-risk participants can be followed
// up with early rather than discovered at data-freeze time.
export type AttritionReport = ApiEnvelope<{
  session_floor: number;
  data: {
    user_id: number;
    name: string;
    email: string;
    study_arm: "control" | "experimental";
    enrolled_at: string | null;
    sessions_completed: number;
    at_risk: boolean;
  }[];
}>;

// Researcher-only - per-participant baseline (pretest) vs. current pitch and
// transcription accuracy, so a researcher can see how each participant is
// actually trending rather than just whether they're still showing up.
export type ParticipantProgress = ApiEnvelope<{
  rolling_window_n: number;
  data: {
    user_id: number;
    name: string;
    email: string;
    study_arm: "control" | "experimental";
    baseline_completed: boolean;
    pitch: {
      baseline_cents: number | null;
      current_cents: number | null;
      // Positive = current cents deviation is lower than baseline (more accurate).
      improvement_pct: number | null;
    };
    transcription: {
      baseline_pct: number | null;
      current_pct: number | null;
      // Percentage-point delta (current_pct - baseline_pct), not a relative %.
      improvement_pts: number | null;
    };
  }[];
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

    // A real, first-class decision not to join - the consent gate treats
    // this the same as enrolling for the purpose of unblocking the rest of
    // the app.
    declineStudy: build.mutation<ApiEnvelope<{}>, void>({
      query: () => ({
        url: "/v1/study/decline",
        method: "POST",
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

    getEnrollmentSummary: build.query<EnrollmentSummary, void>({
      query: () => ({
        url: "/v1/study/admin/enrollment-summary",
        method: "GET",
      }),
      providesTags: ["StudyAdmin"],
    }),

    getAttritionReport: build.query<AttritionReport, void>({
      query: () => ({
        url: "/v1/study/admin/attrition",
        method: "GET",
      }),
      providesTags: ["StudyAdmin"],
    }),

    getParticipantProgress: build.query<ParticipantProgress, void>({
      query: () => ({
        url: "/v1/study/admin/progress",
        method: "GET",
      }),
      providesTags: ["StudyAdmin"],
    }),

    // Research-data cleanup for throwaway/test participant accounts, not
    // general user management - backend refuses admin/self targets.
    deleteParticipant: build.mutation<ApiEnvelope<{}>, number>({
      query: (userId) => ({
        url: `/v1/study/admin/participants/${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["StudyAdmin"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetStudyStatusQuery,
  useEnrollInStudyMutation,
  useDeclineStudyMutation,
  useMarkStudyPromptSeenMutation,
  useGetBaselineStatusQuery,
  useSubmitBaselinePitchAttemptMutation,
  useGetBaselineTranscriptionExerciseMutation,
  useSubmitBaselineTranscriptionAttemptMutation,
  useCompleteBaselineMutation,
  useGetEnrollmentSummaryQuery,
  useGetAttritionReportQuery,
  useGetParticipantProgressQuery,
  useDeleteParticipantMutation,
} = studyApi;
