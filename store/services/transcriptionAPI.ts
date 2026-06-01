import { NotationFormat } from "../features/transcriptionSlice";
import { baseAPI } from "./baseAPI";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  count?: number;
  data?: T;
  error?: string;
};

export type TranscriptionRecord = {
  id: string;
  user_id: number;
  notation_format: NotationFormat;
  digital_score: string;
  image_path: string | null;
  created_at: string;
  updated_at: string;
};

export type TranscriptionResult = {
  success: boolean;
  message: string;
  digitalScore: string;
  notationFormat: NotationFormat;
  record: {
    id: string;
    userId: number;
    imagePath: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

type GetTranscriptionsArgs = {
  userId: number;
};

type DeleteTranscriptionArgs = {
  id: string;
};

type TranscribeImageBody = {
  userId: number;
  imageFile: Blob | File;
  notationFormat: NotationFormat;
};

type TranscribeImageApiData = {
  id?: string;
  user_id?: number;
  notation_format?: NotationFormat;
  digital_score: string;
  image_path?: string | null;
  created_at?: string;
  updated_at?: string;
};

const mapRecord = (record: TranscriptionRecord) => ({
  id: record.id,
  userId: record.user_id,
  imagePath: record.image_path,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
});

export const transcriptionApi = baseAPI.injectEndpoints({
  endpoints: (build) => ({
    getTranscriptions: build.query<
      TranscriptionRecord[],
      GetTranscriptionsArgs
    >({
      query: ({ userId }) => `/v1/transcription?user_id=${userId}`,
      transformResponse: (res: ApiEnvelope<TranscriptionRecord[]>) =>
        res.data ?? [],
      providesTags: (result) =>
        result
          ? [
              { type: "Transcription" as const, id: "LIST" },
              ...result.map((item) => ({
                type: "Transcription" as const,
                id: item.id,
              })),
            ]
          : [{ type: "Transcription" as const, id: "LIST" }],
    }),

    transcribeImage: build.mutation<TranscriptionResult, TranscribeImageBody>({
      query: ({ userId, imageFile, notationFormat }) => {
        const formData = new FormData();
        formData.append("image", imageFile);
        formData.append("user_id", String(userId));
        formData.append("notation_format", notationFormat);

        return {
          url: "/v1/transcription",
          method: "POST",
          body: formData,
        };
      },
      transformResponse: (
        res: ApiEnvelope<TranscribeImageApiData>,
      ): TranscriptionResult => {
        const payload = res.data as TranscribeImageApiData;

        return {
          success: res.success,
          message: res.message ?? "Transcription completed.",
          digitalScore: payload.digital_score,
          notationFormat: payload.notation_format ?? "unknown",
          record:
            payload.id &&
            payload.user_id &&
            payload.created_at &&
            payload.updated_at
              ? {
                  id: payload.id,
                  userId: payload.user_id,
                  imagePath: payload.image_path ?? null,
                  createdAt: payload.created_at,
                  updatedAt: payload.updated_at,
                }
              : null,
        };
      },
      invalidatesTags: [{ type: "Transcription", id: "LIST" }],
    }),

    getTranscriptionById: build.query<TranscriptionRecord, string>({
      query: (id) => `/v1/transcription/${id}`,
      transformResponse: (res: ApiEnvelope<TranscriptionRecord>) =>
        res.data as TranscriptionRecord,
      providesTags: (result, error, id) => [{ type: "Transcription", id }],
    }),

    deleteTranscription: build.mutation<
      { success: boolean; message?: string },
      DeleteTranscriptionArgs
    >({
      query: ({ id }) => ({
        url: `/v1/transcription/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Transcription", id },
        { type: "Transcription", id: "LIST" },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetTranscriptionsQuery,
  useTranscribeImageMutation,
  useGetTranscriptionByIdQuery,
  useDeleteTranscriptionMutation,
} = transcriptionApi;
