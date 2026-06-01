import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { persistReducer, persistStore } from "redux-persist";
import appUiReducer from "./features/appUiSlice";
import auralSessionReducer from "./features/auralSessionSlice";
import authReducer from "./features/authSlice";
import quizSessionReducer from "./features/quizSessionSlice";
import transcriptionReducer from "./features/transcriptionSlice";
import tutorReducer from "./features/tutorSlice";
import { baseAPI } from "./services/baseAPI";

const authPersistConfig = {
  key: "auth",
  storage: AsyncStorage,
  whitelist: ["accessToken", "user", "isAuthenticated"],
};

const rootReducer = combineReducers({
  [baseAPI.reducerPath]: baseAPI.reducer,
  auth: persistReducer(authPersistConfig, authReducer),
  appUi: appUiReducer,
  auralSession: auralSessionReducer,
  quizSession: quizSessionReducer,
  transcriptionUi: transcriptionReducer,
  tutorUi: tutorReducer,
});

const persistConfig = {
  key: "root",
  storage: AsyncStorage,
  blacklist: [baseAPI.reducerPath],
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(baseAPI.middleware),
  devTools: process.env.NODE_ENV !== "production",
});

export const persistor = persistStore(store);
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
