import { Platform } from "react-native";

// API Configuration
const localhostBase = Platform.select({
  android: "http://10.0.2.2:8080",
  ios: "http://localhost:8080",
  default: "http://localhost:8080",
});

export const API_HOST =
  process.env.EXPO_PUBLIC_API_HOST || localhostBase || "http://localhost:8080";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || `${API_HOST}/api`;

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};
