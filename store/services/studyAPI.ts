import { baseAPI } from "./baseAPI";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
} & T;

type EnrollBody = {
  consent: true;
};

type StatusResponse = ApiEnvelope<{ enrolled: boolean }>;

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
  }),
  overrideExisting: false,
});

export const { useGetStudyStatusQuery, useEnrollInStudyMutation } = studyApi;
