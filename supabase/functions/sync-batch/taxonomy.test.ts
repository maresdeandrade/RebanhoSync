import { describe, expect, it } from 'vitest'
import { validateAnimalTaxonomyFactsOperation } from './taxonomy.ts'
import type { Operation } from './rules.ts'

function buildOperation(record: Record<string, unknown>): Operation {
  return {
    client_op_id: 'op-1',
    table: 'animais',
    action: 'UPDATE',
    record,
  }
}

describe('sync-batch taxonomy validation', () => {
  it('accepts canonical taxonomy facts payload', () => {
    const result = validateAnimalTaxonomyFactsOperation(
      buildOperation({
        id: 'animal-1',
        payload: {
          taxonomy_facts: {
            schema_version: 1,
            castrado: false,
            puberdade_confirmada: true,
          },
        },
      }),
    )

    expect(result).toBeNull()
  })

  it('rejects taxonomy facts without schema_version', () => {
    const result = validateAnimalTaxonomyFactsOperation(
      buildOperation({
        id: 'animal-1',
        payload: {
          taxonomy_facts: {
            prenhez_confirmada: true,
          },
        },
      }),
    )

    expect(result?.reason_code).toBe('TAXONOMY_FACTS_SCHEMA_VERSION_REQUIRED')
  })

  it('rejects invalid taxonomy facts field shape', () => {
    const result = validateAnimalTaxonomyFactsOperation(
      buildOperation({
        id: 'animal-1',
        payload: {
          taxonomy_facts: {
            schema_version: 1,
            prenhez_confirmada: 'sim',
          },
        },
      }),
    )

    expect(result?.reason_code).toBe('INVALID_TAXONOMY_FACTS_PAYLOAD')
    expect(result?.reason_message).toContain('prenhez_confirmada')
  })
})
