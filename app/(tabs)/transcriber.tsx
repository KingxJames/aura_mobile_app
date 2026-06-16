import { SymbolView } from "expo-symbols";
import {
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

export default function TranscriberScreen() {
  // 1. RESPONSIVE BREAKPOINTS
  // We grab the screen's current width dynamically. If the user rotates a device 
  // or runs this on a tablet, these values update automatically.
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;      // Typically iPads and larger Android tablets
  const isSmallPhone = width < 390;   // Older/smaller phones like iPhone SE

  // 2. LAYOUT PROP CALCULATIONS
  // Instead of static pixel values, we choose sizing rules based on the device class.
  // This keeps the UI readable whether on a massive iPad or a cramped mobile screen.
  const contentHorizontalPadding = isTablet ? 48 : isSmallPhone ? 16 : 24;
  const topPadding = isTablet ? 128 : isSmallPhone ? 88 : 104;
  const contentMaxWidth = isTablet ? 760 : 640; // Prevents lines of text from stretching too wide on tablet

  // 3. TYPOGRAPHY SCALING
  // Matching font sizes and line heights explicitly ensures text doesn't overlap or look clipped.
  const titleSize = isTablet ? 44 : isSmallPhone ? 30 : 36;
  const titleLineHeight = isTablet ? 50 : isSmallPhone ? 34 : 40;

  const subtitleSize = isTablet ? 24 : isSmallPhone ? 16 : 19;
  const subtitleLineHeight = isTablet ? 32 : isSmallPhone ? 22 : 26;

  const uploadTextSize = isTablet ? 28 : isSmallPhone ? 18 : 22;
  const uploadTextLineHeight = isTablet ? 34 : isSmallPhone ? 24 : 28;

  // 4. INTERACTIVE CARD DIMENSIONS
  // The interactive drag/drop zone scale properties.
  const uploadCardHeight = isTablet ? 136 : isSmallPhone ? 96 : 112;
  const uploadIconSize = isTablet ? 24 : isSmallPhone ? 18 : 20;

  return (
    /* MAIN CONTAINER INTERACTIVE WRAPPER
       Uses flex: 1 to fill the whole screen. We inject the dynamic 'topPadding' calculated 
       above directly into the style object so the content avoids the status bar/notches. */
    <View style={{
      flex: 1,
      backgroundColor: "#F5EFE3",
      alignItems: "center",         // Centers the content view horizontally
      paddingTop: topPadding,       // Dynamic top spacing based on device size
    }}>

      {/* INNER CONTENT WRAPPER 
          Restricts the max width on wider screens to keep a clean, editorial layout. */}
      <View
        style={{
          width: "100%",
          paddingHorizontal: contentHorizontalPadding, // Dynamic spacing for screen edges
          maxWidth: contentMaxWidth,                   // Constrains tablet horizontal layout stretching
        }}
      >
        {/* KICKER (Small section category label) */}
        <Text style={{
          fontSize: 9,
          lineHeight: 12,
          letterSpacing: 1.6, // Spaces out the letters for a modern aesthetic
          fontWeight: "700",
          color: "#D4A64E",
          marginBottom: 10,
        }}>
          SHEET READER
        </Text>

        {/* MAIN TITLE 
            Includes a platform check for font families because Android does not have 'Georgia' installed by default. */}
        <Text
          style={{
            color: "#121E31",
            fontFamily: Platform.OS === "ios" ? "Georgia" : "serif", // iOS uses Georgia, Android falls back cleanly to system serif
            marginBottom: 8,
            fontSize: titleSize,          // Dynamic font size
            lineHeight: titleLineHeight,  // Dynamic line height matched to font size
          }}
        >
          Hear what you see
        </Text>

        {/* SUBTITLE DESCRIPTION */}
        <Text
          style={{
            color: "#425772",
            marginBottom: 18,
            fontSize: subtitleSize,          // Dynamic font size
            lineHeight: subtitleLineHeight,  // Dynamic line height
          }}
        >
          Snap or upload a single line of notation. AURA transcribes and plays
          it back.
        </Text>

        {/* UPLOAD CARD PRESSABLE (The interactive button zone)
            For Pressable, we pass an arrow function to the style prop. This gives us access to 
            the 'pressed' boolean state managed internally by React Native. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Upload sheet music"
          style={({ pressed }) => ({
            width: "100%",
            borderRadius: 16,
            borderWidth: 2,
            borderStyle: "dashed",     // Creates a classic dashed drop-zone outline
            borderColor: "#D4CCBE",
            alignItems: "center",       // Centers the row elements vertically
            justifyContent: "center",     // Centers the row elements horizontally
            backgroundColor: "#F5EFE3",
            paddingHorizontal: 16,
            minHeight: uploadCardHeight, // Dynamic card height based on screen size

            // DYNAMIC OPACITY: If the finger is down, set opacity to 0.78 for immediate visual feedback.
            // When released, it smoothly resets back to 1.
            opacity: pressed ? 0.78 : 1,
          })}
        >
          {/* CARD INNER ROW
              Arranges the icon and text text side-by-side. */}
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10, // Places a reliable 10px gap between the icon and text without manual margins
          }}>
            {/* VECTOR ICON COMPONENT */}
            <SymbolView
              name={{
                ios: "square.and.arrow.up", // Uses high-fidelity Apple SF Symbols on iOS
                android: "upload",          // Safe fallback for Material symbols on Android
                web: "upload",
              }}
              tintColor="#4D5B70"
              size={uploadIconSize}         // Dynamic icon scale calculation
            />

            {/* BUTTON TEXT */}
            <Text
              style={{
                color: "#364A64",
                fontSize: uploadTextSize,          // Dynamic label size
                lineHeight: uploadTextLineHeight,  // Dynamic label line height
              }}
            >
              Upload sheet music
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}