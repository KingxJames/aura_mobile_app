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
  conversation_id: string | null;
  user_id: number;
  message_type: TutorMessageType;
  content: string;
  created_at: string;
  updated_at: string;
};

export type TutorConversationSummary = {
  conversation_id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
};

type TutorHistoryResponse = ApiEnvelope<TutorConversation[]>;
type TutorConversationsResponse = ApiEnvelope<TutorConversationSummary[]>;

type TutorChatBody = {
  user_id: number;
  message: string;
  conversation_id?: string;
};

type TutorChatResponse = {
  success: boolean;
  response: string;
  conversation_id: string;
  log: TutorConversation;
  user_log?: TutorConversation;
};

type TutorHistoryArgs = {
  userId: number;
  conversationId?: string | null;
};

type TutorConversationsArgs = {
  userId: number;
};

type ClearTutorHistoryArgs = {
  userId: number;
  conversationId?: string | null;
};

export const tutorApi = baseAPI.injectEndpoints({
  endpoints: (build) => ({
    getTutorHistory: build.query<TutorConversation[], TutorHistoryArgs>({
      query: ({ userId, conversationId }) => {
        const params = new URLSearchParams({ user_id: String(userId) });

        if (conversationId) {
          params.set("conversation_id", conversationId);
        }

        return `/v1/tutor/history?${params.toString()}`;
      },
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

    getTutorConversations: build.query<
      TutorConversationSummary[],
      TutorConversationsArgs
    >({
      query: ({ userId }) => `/v1/tutor/conversations?user_id=${userId}`,
      transformResponse: (res: TutorConversationsResponse) => res.data ?? [],
      providesTags: (result) =>
        result
          ? [
              { type: "TutorHistory" as const, id: "CONVERSATIONS" },
              ...result.map((conversation) => ({
                type: "TutorHistory" as const,
                id: conversation.conversation_id,
              })),
            ]
          : [{ type: "TutorHistory" as const, id: "CONVERSATIONS" }],
    }),

    sendTutorMessage: build.mutation<TutorChatResponse, TutorChatBody>({
      query: (body) => ({
        url: "/v1/tutor/chat",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        { type: "TutorHistory", id: "LIST" },
        { type: "TutorHistory", id: "CONVERSATIONS" },
      ],
    }),

    clearTutorHistory: build.mutation<
      { success: boolean; message?: string },
      ClearTutorHistoryArgs
    >({
      query: ({ userId, conversationId }) => {
        const params = new URLSearchParams({ user_id: String(userId) });

        if (conversationId) {
          params.set("conversation_id", conversationId);
        }

        return {
          url: `/v1/tutor/history?${params.toString()}`,
          method: "DELETE",
        };
      },
      invalidatesTags: [
        { type: "TutorHistory", id: "LIST" },
        { type: "TutorHistory", id: "CONVERSATIONS" },
      ],
    }),
    deleteConversation: build.mutation<
      { success: boolean; message?: string },
      { userId: number; conversationId: string }
    >({
      query: ({ userId, conversationId }) => {
        const params = new URLSearchParams({ user_id: String(userId) });

        return {
          url: `/v1/tutor/conversations/${conversationId}?${params.toString()}`,
          method: "DELETE",
        };
      },
      invalidatesTags: [
        { type: "TutorHistory", id: "LIST" },
        { type: "TutorHistory", id: "CONVERSATIONS" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetTutorHistoryQuery,
  useGetTutorConversationsQuery,
  useSendTutorMessageMutation,
  useClearTutorHistoryMutation,
  useDeleteConversationMutation,
} = tutorApi;
