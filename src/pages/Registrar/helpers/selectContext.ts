type WithId = {
  id: string;
};

type ResolveSelectedRecordsByIdsInput<TRecord extends WithId> = {
  records: TRecord[];
  selectedIds: string[];
};

export function resolveSelectedRecordsByIds<TRecord extends WithId>(
  input: ResolveSelectedRecordsByIdsInput<TRecord>,
) {
  return input.records.filter((record) => input.selectedIds.includes(record.id));
}

type ResolveMovementSensitiveRecordsInput<TRecord> = {
  showsTransitChecklist: boolean;
  selectedRecords: TRecord[];
  fallbackRecords: TRecord[];
};

export function resolveMovementSensitiveRecords<TRecord>(
  input: ResolveMovementSensitiveRecordsInput<TRecord>,
) {
  if (!input.showsTransitChecklist) return [];
  if (input.selectedRecords.length > 0) return input.selectedRecords;
  return input.fallbackRecords;
}
