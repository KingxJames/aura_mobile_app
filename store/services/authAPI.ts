import {
  clearAuth,
  setCredentials,
  setUser,
  type AuthUser,
} from "../features/authSlice";
import { RootState } from "../store";
import { baseAPI } from "./baseAPI";
import { API_BASE_URL } from "./config/api";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
} & T;

type AuthPayload = {
  token: string;
  user: AuthUser;
};

type RegisterBody = {
  name: string;
  email: string;
  password: string;
};

type LoginBody = {
  email: string;
  password: string;
};

type GoogleSignInBody = {
  google_token: string;
};

export const authApi = baseAPI.injectEndpoints({
  endpoints: (build) => ({
    register: build.mutation<ApiEnvelope<AuthPayload>, RegisterBody>({
      query: (body) => ({
        url: "/v1/auth/register",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Auth", "User"],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data?.token && data?.user) {
            dispatch(
              setCredentials({ accessToken: data.token, user: data.user }),
            );
          }
        } catch {
          // request failed; no-op
        }
      },
    }),

    login: build.mutation<ApiEnvelope<AuthPayload>, LoginBody>({
      query: (body) => ({
        url: "/v1/auth/login",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Auth", "User"],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data?.token && data?.user) {
            dispatch(
              setCredentials({ accessToken: data.token, user: data.user }),
            );
          }
        } catch {
          // request failed; no-op
        }
      },
    }),

    googleSignIn: build.mutation<ApiEnvelope<AuthPayload>, GoogleSignInBody>({
      query: (body) => ({
        url: "/v1/auth/google",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Auth", "User"],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          if (data?.token && data?.user) {
            dispatch(
              setCredentials({ accessToken: data.token, user: data.user }),
            );
          }
        } catch {
          // request failed; no-op
        }
      },
    }),

    logout: build.mutation<ApiEnvelope<{}>, void>({
      query: () => ({
        url: "/v1/auth/logout",
        method: "POST",
      }),
      invalidatesTags: ["Auth", "User"],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(clearAuth());
          dispatch(baseAPI.util.resetApiState());
        }
      },
    }),

    uploadAvatar: build.mutation<
      ApiEnvelope<{ user: AuthUser }>,
      { body: Uint8Array; boundary: string }
    >({
      // Same manual-multipart approach as transcription uploads; see
      // lib/multipart.ts for why FormData isn't used directly.
      queryFn: async ({ body, boundary }, { getState, dispatch }) => {
        const token = (getState() as RootState).auth.accessToken;

        try {
          const response = await fetch(`${API_BASE_URL}/v1/user/avatar`, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": `multipart/form-data; boundary=${boundary}`,
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body,
          });

          const json = await response.json();

          if (!response.ok || json?.success === false) {
            return { error: { status: response.status, data: json } };
          }

          dispatch(setUser(json.user));
          return { data: json };
        } catch (error) {
          return { error: { status: "FETCH_ERROR", error: String(error) } };
        }
      },
      invalidatesTags: ["Auth", "User"],
    }),

    // Optional utility endpoint to read auth state in one place
    meFromStore: build.query<
      { user: AuthUser | null; token: string | null },
      void
    >({
      queryFn: (_, api) => {
        const state = api.getState() as RootState;
        return {
          data: {
            user: state.auth.user,
            token: state.auth.accessToken,
          },
        };
      },
      providesTags: ["Auth", "User"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useGoogleSignInMutation,
  useLogoutMutation,
  useUploadAvatarMutation,
  useMeFromStoreQuery,
} = authApi;
