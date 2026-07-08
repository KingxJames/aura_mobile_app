import { baseAPI } from "./baseAPI";
import { API_BASE_URL } from "./config/api";

export type Transcription = {
  id: number;
  user_id: number;
  uploaded_image_url: string;
  generated_abc: string;
  generated_musicxml: string | null;
  generated_midi: string | null;
  created_at: string;
  updated_at: string;
  formatted_date?: string;
};

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  count?: number;
  data: T;
};

export const transcriptionAPI = baseAPI.injectEndpoints({
  endpoints: (builder) => ({
    getTranscriptions: builder.query<Transcription[], void>({
      query: () => ({ url: "/v1/transcriptions", method: "GET" }),
      transformResponse: (res: ApiEnvelope<Transcription[]>) => res.data ?? [],
      providesTags: (result) =>
        result
          ? [
              { type: "Transcription" as const, id: "LIST" },
              ...result.map((t) => ({ type: "Transcription" as const, id: t.id })),
            ]
          : [{ type: "Transcription" as const, id: "LIST" }],
    }),

    getTranscriptionById: builder.query<Transcription, number>({
      query: (id) => ({ url: `/v1/transcriptions/${id}`, method: "GET" }),
      transformResponse: (res: ApiEnvelope<Transcription>) => res.data,
      providesTags: (result, error, id) => [{ type: "Transcription", id }],
    }),

    uploadTranscription: builder.mutation<
      Transcription,
      { body: Uint8Array; boundary: string }
    >({
      // React Native's native FormData bridging silently stringifies the
      // {uri, type, name} file-part object on this RN/Expo version, so the
      // multipart body is built manually as raw bytes instead.
      queryFn: async ({ body, boundary }, { getState }) => {
        const token = (getState() as { auth?: { accessToken?: string | null } })
          ?.auth?.accessToken;

        try {
          const response = await fetch(`${API_BASE_URL}/v1/transcriptions/upload`, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": `multipart/form-data; boundary=${boundary}`,
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body,
          });

          const json = await response.json();

          if (!response.ok) {
            return { error: { status: response.status, data: json } };
          }

          return { data: (json as ApiEnvelope<Transcription>).data };
        } catch (error) {
          return { error: { status: "FETCH_ERROR", error: String(error) } };
        }
      },
      invalidatesTags: [{ type: "Transcription", id: "LIST" }],
    }),

    deleteTranscription: builder.mutation<{ success: boolean }, number>({
      query: (id) => ({
        url: `/v1/transcriptions/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [
        { type: "Transcription", id },
        { type: "Transcription", id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetTranscriptionsQuery,
  useGetTranscriptionByIdQuery,
  useUploadTranscriptionMutation,
  useDeleteTranscriptionMutation,
} = transcriptionAPI;
