import { baseAPI } from "./baseAPI";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  count?: number;
  data?: T;
};

export type TutorMessageType = "user" | "ai";

export type TutorConversation = {
  id: string;
  user_id: number;
  message_type: TutorMessageType;
  content: string;
  created_at: string;
  updated_at: string;
};

type TutorHistoryResponse = ApiEnvelope<TutorConversation[]>;

type TutorChatBody = {
  user_id: number;
  message: string;
};

type TutorChatResponse = {
  success: boolean;
  response: string;
  log: TutorConversation;
};

type TutorHistoryArgs = {
  userId: number;
};

type ClearTutorHistoryArgs = {
  userId: number;
};

export const tutorApi = baseAPI.injectEndpoints({
  endpoints: (build) => ({
    getTutorHistory: build.query<TutorConversation[], TutorHistoryArgs>({
      query: ({ userId }) => `/v1/tutor/history?user_id=${userId}`,
      transformResponse: (res: TutorHistoryResponse) => res.data ?? [],
      providesTags: (result) =>
        result
          ? [
              { type: "TutorHistory" as const, id: "LIST" },
              ...result.map((m) => ({
                type: "TutorHistory" as const,
                id: m.id,
              })),
            ]
          : [{ type: "TutorHistory" as const, id: "LIST" }],
    }),

    sendTutorMessage: build.mutation<TutorChatResponse, TutorChatBody>({
      query: (body) => ({
        url: "/v1/tutor/chat",
        method: "POST",
        body,
      }),
      invalidatesTags: [{ type: "TutorHistory", id: "LIST" }],
    }),

    clearTutorHistory: build.mutation<
      { success: boolean; message?: string },
      ClearTutorHistoryArgs
    >({
      query: ({ userId }) => ({
        url: `/v1/tutor/history?user_id=${userId}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "TutorHistory", id: "LIST" }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetTutorHistoryQuery,
  useSendTutorMessageMutation,
  useClearTutorHistoryMutation,
} = tutorApi;
