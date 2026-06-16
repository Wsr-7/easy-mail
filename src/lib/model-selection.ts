export interface ModelInfo {
  family?: string;
}

export function pickModels<T extends ModelInfo>(models: T[], preferredFamilies: string[]): T[] {
  const familyOrder = Array.isArray(preferredFamilies) ? preferredFamilies : [];
  const candidates = Array.isArray(models) ? models.slice() : [];
  candidates.sort((a, b) => scoreModel(a, familyOrder) - scoreModel(b, familyOrder));
  return candidates;
}

function scoreModel(model: ModelInfo, familyOrder: string[]): number {
  const family = String(model?.family || "");
  const index = familyOrder.indexOf(family);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

