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

export type QuizQuestion = {
  question_id: string;
  type: string;
  prompt: string;
  options: string[];
  difficulty?: "standard" | "advanced";
  correct_answer?: string; // backend may include on full quiz fetch
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

type SubmitQuizBody = {
  quiz_id: string;
  question_id: string;
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
    question_id: string;
    type: string;
    prompt: string;
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
    questionId: string;
    type: string;
    prompt: string;
    options: string[];
  } | null;
  nextQuestionId: string | null;
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
        { type: "Quiz", id: body.quiz_id },
        { type: "Progress", id: "LIST" },
        { type: "Recommendations", id: "ME" },
      ],
    }),

    getStudentProgress: build.query<UserProgress[], { userId: number }>({
      query: ({ userId }) => `/v1/curriculum/progress?user_id=${userId}`,
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
} = curriculumApi;
