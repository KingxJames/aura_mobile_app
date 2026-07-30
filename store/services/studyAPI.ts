import { baseAPI } from "./baseAPI";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
} & T;

type EnrollBody = {
  consent: true;
};

type StatusResponse = ApiEnvelope<{ enrolled: boolean; prompt_seen: boolean }>;

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
  }),
  overrideExisting: false,
});

export const {
  useGetStudyStatusQuery,
  useEnrollInStudyMutation,
  useMarkStudyPromptSeenMutation,
} = studyApi;
