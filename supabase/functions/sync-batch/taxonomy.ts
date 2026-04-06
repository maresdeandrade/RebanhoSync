import type { Operation } from './rules.ts'
import {
  readTaxonomyFactsRecord,
  validateAnimalTaxonomyFactsContract,
  TAXONOMY_FACTS_SCHEMA_VERSION,
} from '../../../src/lib/animals/taxonomyFactsContract.ts'

export function validateAnimalTaxonomyFactsOperation(op: Operation) {
  if (
    op.table !== 'animais' ||
    (op.action !== 'INSERT' && op.action !== 'UPDATE')
  ) {
    return null
  }

  const taxonomyFacts = readTaxonomyFactsRecord(op.record?.payload)
  if (!taxonomyFacts) {
    return null
  }

  const validation = validateAnimalTaxonomyFactsContract(taxonomyFacts)
  if (validation.success) {
    return null
  }

  const hasSchemaVersionIssue = validation.issues.some(
    (issue) => issue.code === 'INVALID_SCHEMA_VERSION',
  )

  return {
    status: 'REJECTED' as const,
    reason_code: hasSchemaVersionIssue
      ? 'TAXONOMY_FACTS_SCHEMA_VERSION_REQUIRED'
      : 'INVALID_TAXONOMY_FACTS_PAYLOAD',
    reason_message: hasSchemaVersionIssue
      ? `taxonomy_facts.schema_version deve ser ${TAXONOMY_FACTS_SCHEMA_VERSION}`
      : validation.issues
          .map((issue) => `${issue.field}: ${issue.message}`)
          .join(' | '),
  }
}
