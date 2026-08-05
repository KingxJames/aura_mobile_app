import { baseAPI } from "./baseAPI";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
} & T;

// Matches the aliases registered in the backend's morph map
// (App\Providers\AppServiceProvider) - never the raw model class name.
export type FeedbackableType =
  | "aural_attempt"
  | "module_attempt"
  | "tutor_message";

type SubmitFeedbackBody = {
  feedbackable_type: FeedbackableType;
  feedbackable_id: string | number;
  rating: number; // 1-5
  comment?: string;
};

export const feedbackApi = baseAPI.injectEndpoints({
  endpoints: (build) => ({
    submitFeedback: build.mutation<ApiEnvelope<{}>, SubmitFeedbackBody>({
      query: (body) => ({
        url: "/v1/feedback",
        method: "POST",
        body,
      }),
    }),
  }),
  overrideExisting: false,
});

export const { useSubmitFeedbackMutation } = feedbackApi;
