import { baseAPI } from "./baseAPI";

type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
} & T;

type RegisterPushTokenBody = {
  token: string;
  platform: "ios" | "android";
};

type UnregisterPushTokenBody = {
  token: string;
};

export const pushTokenApi = baseAPI.injectEndpoints({
  endpoints: (build) => ({
    registerPushToken: build.mutation<
      ApiEnvelope<{}>,
      RegisterPushTokenBody
    >({
      query: (body) => ({
        url: "/v1/user/push-token",
        method: "POST",
        body,
      }),
    }),

    unregisterPushToken: build.mutation<
      ApiEnvelope<{}>,
      UnregisterPushTokenBody
    >({
      query: (body) => ({
        url: "/v1/user/push-token",
        method: "DELETE",
        body,
      }),
    }),
  }),
  overrideExisting: false,
});

export const { useRegisterPushTokenMutation, useUnregisterPushTokenMutation } =
  pushTokenApi;
