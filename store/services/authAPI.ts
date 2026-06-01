import {
  clearAuth,
  setCredentials,
  type AuthUser,
} from "../features/authSlice";
import { RootState } from "../store";
import { baseAPI } from "./baseAPI";

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
  useMeFromStoreQuery,
} = authApi;
