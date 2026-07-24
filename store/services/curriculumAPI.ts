import { baseAPI } from "./baseAPI";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  count?: number;
  data?: T;
};

export type Grade = {
  id: string;
  title: string;
  level_number: number;
  description: string;
  syllabus_focus: string;
  quizzes: Quiz[];
};

// Raw shape of each entry in a quiz's content_jsonb question bank.
export type QuizQuestion = {
  id: number;
  question: string;
  options: string[];
  ground_truth: string;
  hint?: string;
  explanation?: string;
  metadata?: {
    topic?: string;
    image_url?: string;
    difficulty?: number;
  };
};

export type Quiz = {
  id: string;
  grade_id: string;
  title: string;
  description: string;
  content_jsonb: QuizQuestion[];
};

export type UserProgress = {
  id: string;
  user_id: number;
  quiz_id: string;
  score: number;
  current_streak: number;
  current_tier: "standard" | "advanced";
  created_at: string;
  updated_at: string;
  quiz?: { id: string; title: string };
};

export type DashboardRecommendation = {
  success: boolean;
  focus_area: string;
  recommendation: string;
};

export type AuraNoteResponse = {
  success: boolean;
  message: string;
};

export type TopicDebriefBody = {
  quiz_id: number;
  topic: string;
  correct_count: number;
  total_questions: number;
  current_streak: number;
  tier: "standard" | "advanced";
};

export type TopicHelpBody = {
  quiz_id: number;
  topic: string;
  attempts: number;
  best_score_percent: number;
};

type SubmitQuizBody = {
  quiz_id: number;
  question_id: number;
  user_answer: string;
};

type SubmitQuizApiResponse = {
  success: boolean;
  is_correct: boolean;
  correct_answer: string;
  current_streak: number;
  allocated_tier: "standard" | "advanced";
  message: string;
  next_question: {
    question_id: number;
    type: string;
    prompt: string;
    hint?: string | null;
    options: string[];
  };
};

export type SubmitQuizResponse = {
  success: boolean;
  isCorrect: boolean;
  correctAnswer: string;
  currentStreak: number;
  allocatedTier: "standard" | "advanced";
  message: string;
  nextQuestion: {
    questionId: number;
    type: string;
    prompt: string;
    hint: string | null;
    options: string[];
  } | null;
  nextQuestionId: number | null;
};

export const curriculumApi = baseAPI.injectEndpoints({
  endpoints: (build) => ({
    getCurriculum: build.query<Grade[], void>({
      query: () => "/v1/curriculum",
      transformResponse: (res: ApiEnvelope<Grade[]>) => res.data ?? [],
      providesTags: (result) =>
        result
          ? [
              { type: "Curriculum" as const, id: "LIST" },
              ...result.map((g) => ({ type: "Curriculum" as const, id: g.id })),
            ]
          : [{ type: "Curriculum" as const, id: "LIST" }],
    }),

    getQuizById: build.query<Quiz, string>({
      query: (id) => `/v1/curriculum/quiz/${id}`,
      transformResponse: (res: ApiEnvelope<Quiz>) => res.data as Quiz,
      providesTags: (result, error, id) => [{ type: "Quiz", id }],
    }),

    submitQuizAnswer: build.mutation<SubmitQuizResponse, SubmitQuizBody>({
      query: (body) => ({
        url: "/v1/curriculum/quiz/submit",
        method: "POST",
        body,
      }),
      transformResponse: (res: SubmitQuizApiResponse): SubmitQuizResponse => {
        const nextQuestion = res.next_question
          ? {
              questionId: res.next_question.question_id,
              type: res.next_question.type,
              prompt: res.next_question.prompt,
              hint: res.next_question.hint ?? null,
              options: res.next_question.options,
            }
          : null;

        return {
          success: res.success,
          isCorrect: res.is_correct,
          correctAnswer: res.correct_answer,
          currentStreak: res.current_streak,
          allocatedTier: res.allocated_tier,
          message: res.message,
          nextQuestion,
          nextQuestionId: nextQuestion?.questionId ?? null,
        };
      },
      invalidatesTags: (result, error, body) => [
        { type: "Quiz", id: String(body.quiz_id) },
        { type: "Progress", id: "LIST" },
        { type: "Recommendations", id: "ME" },
      ],
    }),

    getStudentProgress: build.query<UserProgress[], void>({
      query: () => "/v1/curriculum/progress",
      transformResponse: (res: ApiEnvelope<UserProgress[]>) => res.data ?? [],
      providesTags: (result) =>
        result
          ? [
              { type: "Progress" as const, id: "LIST" },
              ...result.map((p) => ({ type: "Progress" as const, id: p.id })),
            ]
          : [{ type: "Progress" as const, id: "LIST" }],
    }),

    deleteProgressRecord: build.mutation<
      { success: boolean; message: string },
      string
    >({
      query: (progressId) => ({
        url: `/v1/curriculum/progress/${progressId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, progressId) => [
        { type: "Progress", id: progressId },
        { type: "Progress", id: "LIST" },
        { type: "Recommendations", id: "ME" },
      ],
    }),

    getDashboardRecommendations: build.query<DashboardRecommendation, void>({
      query: () => "/v1/curriculum/dashboard-recommendations",
      providesTags: [{ type: "Recommendations", id: "ME" }],
    }),

    getTopicDebrief: build.mutation<AuraNoteResponse, TopicDebriefBody>({
      query: (body) => ({
        url: "/v1/curriculum/topic-debrief",
        method: "POST",
        body,
      }),
    }),

    getTopicHelp: build.mutation<AuraNoteResponse, TopicHelpBody>({
      query: (body) => ({
        url: "/v1/curriculum/topic-help",
        method: "POST",
        body,
      }),
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCurriculumQuery,
  useGetQuizByIdQuery,
  useSubmitQuizAnswerMutation,
  useGetStudentProgressQuery,
  useDeleteProgressRecordMutation,
  useGetDashboardRecommendationsQuery,
  useGetTopicDebriefMutation,
  useGetTopicHelpMutation,
} = curriculumApi;
