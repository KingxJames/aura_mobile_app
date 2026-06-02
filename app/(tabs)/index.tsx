import AuralAndSheet from "@/components/auralAndSheet/auralAndSheet";
import BeginALesson from "@/components/beginALesson/beginALesson";
import Curriculum from "@/components/curriculum/curriculum";
import TodaysStudy from "@/components/todaysStudy/todaysStudy";
import { ScrollView, StyleSheet, View } from "react-native";

export default function TabOneScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.section}>
        <BeginALesson />
      </View>

      <View style={styles.section}>
        <AuralAndSheet />
      </View>

      <View style={styles.section}>
        <TodaysStudy />
      </View>

      <View style={styles.section}>
        <Curriculum />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5EFE3",
  },
  contentContainer: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    paddingTop: 96,
    paddingBottom: 92,
  },
  section: {
    width: "100%",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1B1A17",
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: "80%",
  },
});
