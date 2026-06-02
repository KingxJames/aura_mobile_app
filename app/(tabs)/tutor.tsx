import { StyleSheet, Text, View } from "react-native";

export default function TutorScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Tutor</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5EFE3",
  },
  title: {
    color: "#1B1A17",
    fontSize: 24,
    fontWeight: "700",
  },
});
