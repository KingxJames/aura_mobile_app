import AsyncStorage from "@react-native-async-storage/async-storage";

// Both keys are namespaced per user id so this device-local cache can never
// leak one account's topic progress into another account signed in on the
// same device.
const STORAGE_KEY_BASE = "aura:completedTopics:v1";
const ATTEMPTS_STORAGE_KEY_BASE = "aura:topicAttempts:v1";

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

type UserId = string | number;

function scopedKey(base: string, userId: UserId): string {
  return `${base}:${userId}`;
}

async function readAll(userId: UserId): Promise<CompletedTopicsMap> {
  try {
    const raw = await AsyncStorage.getItem(scopedKey(STORAGE_KEY_BASE, userId));
    return raw ? (JSON.parse(raw) as CompletedTopicsMap) : {};
  } catch {
    return {};
  }
}

export async function getCompletedTopics(
  userId: UserId,
  quizId: string,
): Promise<string[]> {
  const all = await readAll(userId);
  return all[quizId] ?? [];
}

export async function markTopicCompleted(
  userId: UserId,
  quizId: string,
  topic: string,
): Promise<string[]> {
  const all = await readAll(userId);
  const existing = all[quizId] ?? [];
  if (!existing.includes(topic)) {
    all[quizId] = [...existing, topic];
    await AsyncStorage.setItem(
      scopedKey(STORAGE_KEY_BASE, userId),
      JSON.stringify(all),
    );
  }
  return all[quizId] ?? existing;
}

async function readAllAttempts(userId: UserId): Promise<TopicAttemptsMap> {
  try {
    const raw = await AsyncStorage.getItem(
      scopedKey(ATTEMPTS_STORAGE_KEY_BASE, userId),
    );
    return raw ? (JSON.parse(raw) as TopicAttemptsMap) : {};
  } catch {
    return {};
  }
}

export async function getTopicAttempts(
  userId: UserId,
  quizId: string,
  topic: string,
): Promise<TopicAttemptRecord | null> {
  const all = await readAllAttempts(userId);
  return all[quizId]?.[topic] ?? null;
}

export async function getAllTopicAttempts(
  userId: UserId,
  quizId: string,
): Promise<Record<string, TopicAttemptRecord>> {
  const all = await readAllAttempts(userId);
  return all[quizId] ?? {};
}

export async function recordTopicAttempt(
  userId: UserId,
  quizId: string,
  topic: string,
  correctCount: number,
  totalQuestions: number,
): Promise<TopicAttemptRecord> {
  const all = await readAllAttempts(userId);
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
  await AsyncStorage.setItem(
    scopedKey(ATTEMPTS_STORAGE_KEY_BASE, userId),
    JSON.stringify(all),
  );
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
