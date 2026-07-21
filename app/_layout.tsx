import { ThemeProvider } from "@/components/ThemeProvider/ThemeProvider";
import { Stack } from "expo-router";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { persistor, store } from "../store/store";

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider>
          <Stack>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
            <Stack.Screen
              name="auth/google/callback"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="grade/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="quiz/[id]" options={{ headerShown: false }} />
            <Stack.Screen
              name="aural-training/[gradeId]"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="aural-training/exercise"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="notFound" options={{ headerShown: false }} />
          </Stack>
        </ThemeProvider>
      </PersistGate>
    </Provider>
  );
}
