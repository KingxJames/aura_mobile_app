import { baseAPI } from "./baseAPI";

export const transcriptionAPI = baseAPI.injectEndpoints({
  endpoints: (builder) => ({
    getTranscriptionsByID: builder.query({
      query: (id) => ({
        url: `/transcription/${id}`,
        method: "GET",
      }),
      providesTags: ["Transcription"],
    }),
    getTranscription: builder.query({
      query: () => ({
        url: "/transcription",
        method: "GET",
      }),
      providesTags: ["Transcription"],
    }),
    createTranscription: builder.mutation({
      query: (body) => ({
        url: "/transcription",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Transcription"],
    }),
    deleteTranscription: builder.mutation({
      query: (id) => ({
        url: `/transcription/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Transcription"],
    }),
    uploadTranscription: builder.mutation({
      query: (body) => ({
        url: "/transcription/upload",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Transcription"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetTranscriptionsByIDQuery,
  useGetTranscriptionQuery,
  useCreateTranscriptionMutation,
  useDeleteTranscriptionMutation,
  useUploadTranscriptionMutation,
} = transcriptionAPI;
