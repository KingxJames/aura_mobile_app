import { MaterialIcons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform } from "react-native";

type PlatformIconProps = {
  ios: React.ComponentProps<typeof SymbolView>["name"];
  name: React.ComponentProps<typeof MaterialIcons>["name"];
  color: string;
  size: number;
};

// expo-symbols (SF Symbols) only renders on iOS; Android/web render nothing,
// so those platforms fall back to Material icons for a visible glyph.
export default function PlatformIcon({
  ios,
  name,
  color,
  size,
}: PlatformIconProps) {
  if (Platform.OS === "ios") {
    return <SymbolView name={ios} tintColor={color} size={size} />;
  }

  return <MaterialIcons name={name} color={color} size={size} />;
}
