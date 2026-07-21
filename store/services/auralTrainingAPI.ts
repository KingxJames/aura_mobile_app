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
  | "musical_features";

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
  tempo_bpm: number;
  time_signature: string;
  beats_per_bar: number;
  bars: number;
  beat_timestamps_ms: number[];
  question: McqQuestion;
  ground_truth: { time_signature: string };
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

export type AuralExercise =
  | PulseMetreExercise
  | EchoSingingExercise
  | SpotDifferenceExercise
  | MusicalFeaturesExercise;

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
};

type SubmitAttemptArgs = {
  exerciseId: number;
  body: Record<string, unknown> | FormData;
};

export const auralTrainingApi = baseAPI.injectEndpoints({
  endpoints: (build) => ({
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
  }),
  overrideExisting: false,
});

export const { useGenerateAuralExerciseMutation, useSubmitAuralAttemptMutation } =
  auralTrainingApi;
