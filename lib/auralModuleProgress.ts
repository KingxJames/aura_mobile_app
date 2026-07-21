import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuralModuleType } from "@/store/services/auralTrainingAPI";

const STORAGE_KEY = "aura:completedAuralModules:v1";

// Keyed by gradeId (not quizId) - aural modules belong to a grade directly,
// unlike theory topics which are grouped under a specific quiz's question bank.
type CompletedModulesMap = Record<string, AuralModuleType[]>;

async function readAll(): Promise<CompletedModulesMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CompletedModulesMap) : {};
  } catch {
    return {};
  }
}

export async function getCompletedAuralModules(
  gradeId: string,
): Promise<AuralModuleType[]> {
  const all = await readAll();
  return all[gradeId] ?? [];
}

export async function markAuralModuleCompleted(
  gradeId: string,
  moduleType: AuralModuleType,
): Promise<AuralModuleType[]> {
  const all = await readAll();
  const existing = all[gradeId] ?? [];
  if (!existing.includes(moduleType)) {
    all[gradeId] = [...existing, moduleType];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
  return all[gradeId] ?? existing;
}
