import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { API_BASE_URL } from "./config/api";

type RootStateLike = {
  auth?: {
    accessToken?: string | null;
  };
};

const baseUrl = API_BASE_URL;

const baseQuery = fetchBaseQuery({
  baseUrl,
  credentials: undefined,
  prepareHeaders: (headers, { getState }) => {
    const state = getState() as RootStateLike;
    const token = state?.auth?.accessToken;

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    headers.set("Accept", "application/json");
    return headers;
  },
});

const basequeryWithReauth = async (args: any, api: any, extraOptions: any) => {
  if (typeof args === "object" && args?.body instanceof FormData) {
    if (args.headers instanceof Headers) {
      args.headers.delete("Content-Type");
    } else {
      const headers = new Headers(args.headers ?? {});
      headers.delete("Content-Type");
      args = { ...args, headers };
    }
  }

  return await baseQuery(args, api, extraOptions);
};

export const baseAPI = createApi({
  baseQuery: basequeryWithReauth,
  reducerPath: "baseAPI",
  tagTypes: [
    "Auth",
    "User",
    "Curriculum",
    "Quiz",
    "Progress",
    "Recommendations",
    "AuralList",
    "AuralAttempt",
    "AuralExercise",
    "TutorHistory",
    "Transcription",
  ],
  endpoints: (_) => ({}),
});
