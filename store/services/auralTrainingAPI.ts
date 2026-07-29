import { baseAPI } from "./baseAPI";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
};

export type AuralModuleType =
  | "pulse_metre"
  | "echo_singing"
  | "spot_difference"
  | "musical_features"
  | "transcription";

// Matches AuralExerciseGeneratorService's degreeToNote() output on the backend.
export type NoteEvent = {
  note_name: string;
  octave: number;
  degree: number;
  duration_beats: number;
};

type McqQuestion = {
  prompt: string;
  options: string[];
  // Archetype labels (e.g. "2/4" -> "March 🚶") for the listen_mcq/boss phases -
  // absent means render the raw option value as-is.
  option_labels?: Record<string, string>;
};

// Pulse & Metre's 10-question, 4-phase progression - matches
// AuralModuleController::phaseForQuestionNumber on the backend.
export type PulseMetrePhase =
  | "listen_mcq"
  | "downbeat_tap"
  | "muted_bar_tap"
  | "boss";

export type PulseMetreSessionProgress = {
  question_number: number;
  phase: PulseMetrePhase;
  total_questions: number;
  // Only present on the submitAttempt response, not on generateExercise's.
  status?: "active" | "completed";
  correct_count?: number;
};

// Raw exercise payload shape - a union keyed by module_type, matching exactly
// what AuralModuleController::generateExercise returns for each module.
// `ground_truth` is present (the backend doesn't hide it - see
// QuizController::showQuiz for the same existing convention) but the UI
// should never read or display it; it's only here for type completeness.
export type PulseMetreExercise = {
  exercise_id: number;
  grade_id: string;
  module_type: "pulse_metre";
  phase: PulseMetrePhase;
  time_signature: string;
  // Absent for listen_mcq - that phase plays a real recorded clip (see
  // audio_url below) instead of a synthesized beat grid, so tempo/bar-count/
  // beat timing are meaningless there and the backend omits them entirely.
  tempo_bpm?: number;
  beats_per_bar?: number;
  bars?: number;
  beat_timestamps_ms?: number[];
  // downbeat_tap only: which beat_timestamps_ms indices are beat 1 of a bar.
  downbeat_indices?: number[];
  // muted_bar_tap/boss only: which beat_timestamps_ms indices actually sound -
  // the rest stay silent so the user must tap through from memory.
  audible_beat_indices?: number[];
  instruction?: string;
  // listen_mcq only: a real, pre-recorded 2-bar clip to play instead of the
  // synthesized click track - see PulseMetreClip on the backend.
  audio_url?: string;
  clip_label?: string;
  // Only present for listen_mcq/boss - the other two phases are tap-only.
  question?: McqQuestion;
  ground_truth: { time_signature: string };
  session_id: number;
  question_number: number;
  session_progress: PulseMetreSessionProgress;
};

export type EchoSingingExercise = {
  exercise_id: number;
  grade_id: string;
  module_type: "echo_singing";
  key: string;
  bars: number;
  note_sequence: NoteEvent[];
  ground_truth: { note_sequence: NoteEvent[] };
};

export type SpotDifferenceExercise = {
  exercise_id: number;
  grade_id: string;
  module_type: "spot_difference";
  key: string;
  original_sequence: NoteEvent[];
  altered_sequence: NoteEvent[];
  question: McqQuestion;
  ground_truth: { changed_index: number; position: "beginning" | "end" };
};

export type MusicalFeaturesExercise = {
  exercise_id: number;
  grade_id: string;
  module_type: "musical_features";
  key: string;
  note_sequence: NoteEvent[];
  dynamic_hint: { velocity: number };
  articulation_hint: { duration_multiplier: number };
  question: {
    dynamic: McqQuestion;
    articulation: McqQuestion;
  };
  ground_truth: { dynamic: "forte" | "piano"; articulation: "legato" | "staccato" };
};

export type TranscriptionExercise = {
  exercise_id: number;
  grade_id: string;
  module_type: "transcription";
  key: string;
  note_sequence: NoteEvent[];
  ground_truth: { note_sequence: NoteEvent[] };
};

export type AuralExercise =
  | PulseMetreExercise
  | EchoSingingExercise
  | SpotDifferenceExercise
  | MusicalFeaturesExercise
  | TranscriptionExercise;

// Only the fields a submitted note needs - the generator's degree/octave_offset
// are backend-internal, not required by AuralModuleController::gradeTranscription.
export type SubmittedNote = {
  note_name: string;
  octave: number;
  duration_beats: number;
};

export type TranscriptionScoreDetails = {
  correctness_pct: number;
  alignment_cost: number;
  is_correct: boolean;
  elapsed_ms: number;
  speed_valid: boolean;
};

export type TranscriptionUnlockStatus = {
  unlocked: boolean;
  reason: string;
  current_avg_cents: number | null;
  threshold_cents: number | null;
  attempts_so_far: number | null;
};

type GenerateExerciseArgs = {
  moduleType: AuralModuleType;
  gradeId: string;
};

export type AuralAttemptResult = {
  success: boolean;
  is_correct: boolean | null;
  correct_answer?: string | Record<string, unknown>;
  score_details?: Record<string, unknown> | null;
  message?: string;
  // Only present when the attempt was for pulse_metre.
  session_progress?: PulseMetreSessionProgress;
};

type SubmitAttemptArgs = {
  exerciseId: number;
  body: Record<string, unknown> | FormData;
};

// Matches QuizController::topicDebrief/topicHelp's response shape exactly -
// AuralModuleController::debrief/help are a direct mirror of those two.
export type AuraNoteResponse = {
  success: boolean;
  message: string;
};

export type AuralDebriefBody = {
  module_type: AuralModuleType;
  correct_count: number;
  total_questions: number;
};

export type AuralHelpBody = {
  module_type: AuralModuleType;
  attempts: number;
  best_score_percent: number;
};

export const auralTrainingApi = baseAPI.injectEndpoints({
  endpoints: (build) => ({
    getTranscriptionUnlockStatus: build.query<TranscriptionUnlockStatus, void>({
      query: () => "/v1/aural/modules/transcription/unlock-status",
      transformResponse: (res: ApiEnvelope<TranscriptionUnlockStatus>) =>
        res.data as TranscriptionUnlockStatus,
      providesTags: [{ type: "AuralExercise", id: "TRANSCRIPTION_UNLOCK" }],
    }),

    // Implemented as a mutation (not a query) even though it's a GET request -
    // every call must generate a brand new procedural exercise server-side,
    // and RTK Query's query cache would otherwise hand back a stale one on replay.
    generateAuralExercise: build.mutation<AuralExercise, GenerateExerciseArgs>({
      query: ({ moduleType, gradeId }) => ({
        url: `/v1/aural/modules/${moduleType}/exercise?grade_id=${gradeId}`,
        method: "GET",
      }),
      transformResponse: (res: ApiEnvelope<AuralExercise>) =>
        res.data as AuralExercise,
      invalidatesTags: [{ type: "AuralExercise", id: "LIST" }],
    }),

    submitAuralAttempt: build.mutation<AuralAttemptResult, SubmitAttemptArgs>({
      query: ({ exerciseId, body }) => ({
        url: `/v1/aural/modules/exercises/${exerciseId}/attempt`,
        method: "POST",
        body,
      }),
    }),

    getAuralDebrief: build.mutation<AuraNoteResponse, AuralDebriefBody>({
      query: (body) => ({
        url: "/v1/aural/modules/debrief",
        method: "POST",
        body,
      }),
    }),

    getAuralHelp: build.mutation<AuraNoteResponse, AuralHelpBody>({
      query: (body) => ({
        url: "/v1/aural/modules/help",
        method: "POST",
        body,
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetTranscriptionUnlockStatusQuery,
  useGenerateAuralExerciseMutation,
  useSubmitAuralAttemptMutation,
  useGetAuralDebriefMutation,
  useGetAuralHelpMutation,
} = auralTrainingApi;
