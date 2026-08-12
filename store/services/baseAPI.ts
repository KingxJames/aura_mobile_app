import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { clearAuth } from "../features/authSlice";
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

  const result = await baseQuery(args, api, extraOptions);

  // A 401 on a request we sent WITH a token means that token has been
  // invalidated server-side (e.g. the backend deletes all of a user's
  // other tokens on each new login - signing in on a second device kills
  // the first device's session). Without this, the dead token just sits
  // in storage and every request fails silently until the user manually
  // logs out and back in. Only act when we actually had a token, so this
  // doesn't fire on plain "wrong password" 401s from the login screen.
  if (result.error?.status === 401) {
    const state = api.getState() as RootStateLike;
    if (state?.auth?.accessToken) {
      api.dispatch(clearAuth());
      api.dispatch(baseAPI.util.resetApiState());
    }
  }

  return result;
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
    "Study",
    "StudyBaseline",
    "StudyAdmin",
    "FlowCheckin",
  ],
  endpoints: (_) => ({}),
});
