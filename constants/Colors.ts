const Colors = {
  light: {
    bg: "#F5EFE3",
    surface: "#EFE9DC",
    surfaceAlt: "#F6F3EC",
    border: "#D9CBB6",
    textPrimary: "#1B1A17",
    textSecondary: "#8C8270",
    textMuted: "#9C917C",
    gold: "#D79A1B",
    blue: "#178CCF",
    ink: "#16253A",
    onInk: "#F5F1E8",
    success: "#2F7A4F",
    danger: "#B23B3B",
    dangerSurface: "#FBEAE8",
    dangerBorder: "#E8B3AC",
  },
  dark: {
    bg: "#0B1220",
    surface: "#16253A",
    surfaceAlt: "#1E2F45",
    border: "#2E425E",
    textPrimary: "#F5F1E8",
    textSecondary: "#B7AE9C",
    textMuted: "#8C8270",
    gold: "#E0AA35",
    blue: "#3AA7E0",
    ink: "#2E425E",
    onInk: "#F5F1E8",
    success: "#3FA968",
    danger: "#E5534B",
    dangerSurface: "#3A1F1F",
    dangerBorder: "#6B3232",
  },
};

export type ThemeColors = typeof Colors.light;

export default Colors;
