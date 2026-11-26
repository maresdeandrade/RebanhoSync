import type { AnimalEditDraft, AnimalEditDraftVersion } from "./db";

export function draftVersions(draft: AnimalEditDraft | undefined): AnimalEditDraftVersion[] {
  if (!draft) return [];
  const { conflicts, ...head } = draft;
  return [head, ...(conflicts ?? [])];
}

export function packDraftVersions(versions: AnimalEditDraftVersion[]): AnimalEditDraft | undefined {
  if (!versions.length) return undefined;
  const [head, ...conflicts] = versions;
  return { ...head, ...(conflicts.length ? { conflicts } : {}) };
}

export function updateDraftVersion(
  draft: AnimalEditDraft | undefined,
  expectedVersion: string | null | undefined,
  next: AnimalEditDraftVersion,
): AnimalEditDraft {
  const versions = draftVersions(draft);
  const index = expectedVersion ? versions.findIndex(item => item.version_id === expectedVersion) : -1;
  if (index < 0) versions.push(next);
  else versions[index] = { ...next, baseline: versions[index].baseline, submission: versions[index].submission };
  return packDraftVersions(versions)!;
}
