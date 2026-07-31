import { baseAPI } from "./baseAPI";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
} & T;

export type FlowCheckinStatus = ApiEnvelope<{ done_today: boolean }>;

type SubmitFlowCheckinBody = {
  absorption_rating: number;
  challenge_rating: number;
};

// Pedagogical Sub-Question 2 (flow / cognitive overload) - a short custom
// check-in, scoped to Aural Training only, shown at most once per day.
export const flowCheckinApi = baseAPI.injectEndpoints({
  endpoints: (build) => ({
    getFlowCheckinStatus: build.query<FlowCheckinStatus, void>({
      query: () => ({
        url: "/v1/flow-checkin/today",
        method: "GET",
      }),
      providesTags: ["FlowCheckin"],
    }),

    submitFlowCheckin: build.mutation<ApiEnvelope<{}>, SubmitFlowCheckinBody>({
      query: (body) => ({
        url: "/v1/flow-checkin",
        method: "POST",
        body,
      }),
      invalidatesTags: ["FlowCheckin"],
    }),
  }),
  overrideExisting: false,
});

export const { useGetFlowCheckinStatusQuery, useSubmitFlowCheckinMutation } =
  flowCheckinApi;
