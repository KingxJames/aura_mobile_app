import { useColorScheme } from "react-native";
import { useSelector } from "react-redux";
import Colors, { type ThemeColors } from "@/constants/Colors";
import type { RootState } from "@/store/store";

export function useThemeColors(): ThemeColors {
  const systemScheme = useColorScheme();
  const themeMode = useSelector((state: RootState) => state.appUi.theme);
  const scheme = themeMode === "system" ? systemScheme : themeMode;
  return Colors[scheme === "dark" ? "dark" : "light"];
}
