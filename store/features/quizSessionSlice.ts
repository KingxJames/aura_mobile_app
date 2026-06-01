import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type QuizTier = "standard" | "advanced";

type QuizSessionState = {
  activeQuizId: string | null;
  currentQuestionId: string | null;
  selectedAnswer: string | null;

  answeredQuestionIds: string[];
  currentStreak: number;
  allocatedTier: QuizTier;

  quizInProgress: boolean;
  isSubmittingAnswer: boolean;
  lastWasCorrect: boolean | null;
};

const initialState: QuizSessionState = {
  activeQuizId: null,
  currentQuestionId: null,
  selectedAnswer: null,

  answeredQuestionIds: [],
  currentStreak: 0,
  allocatedTier: "standard",

  quizInProgress: false,
  isSubmittingAnswer: false,
  lastWasCorrect: null,
};

const quizSessionSlice = createSlice({
  name: "quizSession",
  initialState,
  reducers: {
    startQuiz: (
      state,
      action: PayloadAction<{ quizId: string; firstQuestionId?: string }>,
    ) => {
      state.activeQuizId = action.payload.quizId;
      state.currentQuestionId = action.payload.firstQuestionId ?? null;
      state.selectedAnswer = null;
      state.answeredQuestionIds = [];
      state.currentStreak = 0;
      state.allocatedTier = "standard";
      state.quizInProgress = true;
      state.isSubmittingAnswer = false;
      state.lastWasCorrect = null;
    },

    endQuiz: (state) => {
      state.quizInProgress = false;
      state.isSubmittingAnswer = false;
    },

    setCurrentQuestion: (state, action: PayloadAction<string | null>) => {
      state.currentQuestionId = action.payload;
      state.selectedAnswer = null;
    },

    selectAnswer: (state, action: PayloadAction<string | null>) => {
      state.selectedAnswer = action.payload;
    },

    markSubmittingAnswer: (state, action: PayloadAction<boolean>) => {
      state.isSubmittingAnswer = action.payload;
    },

    // call this after submit response returns from backend
    applySubmissionResult: (
      state,
      action: PayloadAction<{
        questionId: string;
        isCorrect: boolean;
        currentStreak: number;
        allocatedTier: QuizTier;
        nextQuestionId?: string | null;
      }>,
    ) => {
      const {
        questionId,
        isCorrect,
        currentStreak,
        allocatedTier,
        nextQuestionId,
      } = action.payload;

      if (!state.answeredQuestionIds.includes(questionId)) {
        state.answeredQuestionIds.push(questionId);
      }

      state.lastWasCorrect = isCorrect;
      state.currentStreak = currentStreak;
      state.allocatedTier = allocatedTier;
      state.currentQuestionId = nextQuestionId ?? null;
      state.selectedAnswer = null;
      state.isSubmittingAnswer = false;
    },

    resetQuizSession: () => initialState,
  },
});

export const {
  startQuiz,
  endQuiz,
  setCurrentQuestion,
  selectAnswer,
  markSubmittingAnswer,
  applySubmissionResult,
  resetQuizSession,
} = quizSessionSlice.actions;

export default quizSessionSlice.reducer;
