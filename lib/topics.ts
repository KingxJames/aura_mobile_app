import type { QuizQuestion } from "@/store/services/curriculumAPI";

export type TopicGroup = {
  key: string;
  label: string;
  questions: QuizQuestion[];
};

const TOPIC_LABELS: Record<string, string> = {
  pitch: "Pitch",
  rhythm: "Rhythm",
  time_signatures: "Time Signatures",
  scales: "Scales",
};

export function humanizeTopic(key: string): string {
  return (
    TOPIC_LABELS[key] ??
    key
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

// Groups a quiz's flat question bank into ordered sub-topics based on
// each question's metadata.topic, preserving first-appearance order.
export function groupQuestionsByTopic(questions: QuizQuestion[]): TopicGroup[] {
  const order: string[] = [];
  const map = new Map<string, QuizQuestion[]>();

  questions.forEach((question) => {
    const key = question.metadata?.topic ?? "general";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(question);
  });

  return order.map((key) => ({
    key,
    label: humanizeTopic(key),
    questions: map.get(key)!,
  }));
}
