import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "aura:completedTopics:v1";
const ATTEMPTS_STORAGE_KEY = "aura:topicAttempts:v1";

// A student counts as "struggling" on a topic once they've tried it at
// least this many times without their best score clearing the threshold.
const STRUGGLING_MIN_ATTEMPTS = 2;
const STRUGGLING_MAX_BEST_SCORE_PERCENT = 50;

type CompletedTopicsMap = Record<string, string[]>;

export type TopicAttemptRecord = {
  attempts: number;
  lastScorePercent: number;
  bestScorePercent: number;
};

type TopicAttemptsMap = Record<string, Record<string, TopicAttemptRecord>>;

async function readAll(): Promise<CompletedTopicsMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CompletedTopicsMap) : {};
  } catch {
    return {};
  }
}

export async function getCompletedTopics(quizId: string): Promise<string[]> {
  const all = await readAll();
  return all[quizId] ?? [];
}

export async function markTopicCompleted(
  quizId: string,
  topic: string,
): Promise<string[]> {
  const all = await readAll();
  const existing = all[quizId] ?? [];
  if (!existing.includes(topic)) {
    all[quizId] = [...existing, topic];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
  return all[quizId] ?? existing;
}

async function readAllAttempts(): Promise<TopicAttemptsMap> {
  try {
    const raw = await AsyncStorage.getItem(ATTEMPTS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TopicAttemptsMap) : {};
  } catch {
    return {};
  }
}

export async function getTopicAttempts(
  quizId: string,
  topic: string,
): Promise<TopicAttemptRecord | null> {
  const all = await readAllAttempts();
  return all[quizId]?.[topic] ?? null;
}

export async function getAllTopicAttempts(
  quizId: string,
): Promise<Record<string, TopicAttemptRecord>> {
  const all = await readAllAttempts();
  return all[quizId] ?? {};
}

export async function recordTopicAttempt(
  quizId: string,
  topic: string,
  correctCount: number,
  totalQuestions: number,
): Promise<TopicAttemptRecord> {
  const all = await readAllAttempts();
  const quizAttempts = all[quizId] ?? {};
  const existing = quizAttempts[topic];
  const scorePercent =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const updated: TopicAttemptRecord = {
    attempts: (existing?.attempts ?? 0) + 1,
    lastScorePercent: scorePercent,
    bestScorePercent: Math.max(existing?.bestScorePercent ?? 0, scorePercent),
  };

  all[quizId] = { ...quizAttempts, [topic]: updated };
  await AsyncStorage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(all));
  return updated;
}

export function isStrugglingWithTopic(
  record: TopicAttemptRecord | null,
): boolean {
  if (!record) return false;
  return (
    record.attempts >= STRUGGLING_MIN_ATTEMPTS &&
    record.bestScorePercent < STRUGGLING_MAX_BEST_SCORE_PERCENT
  );
}
