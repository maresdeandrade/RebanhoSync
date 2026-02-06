---
name: movement-traceability-runbook
description: Use when move animal, movimentação, change lote, trocar lote, anti-teleport, transfer pasture, or asking about moving animals between lotes/pastos.
---

# Movement Traceability Runbook - GestaoAgro

## Mission

Guide proper animal movement registration with anti-teleport compliance (evento_movimentacao + UPDATE animais.lote_id in same gesture).

## When to Use

- Moving animal(s) between lotes or pastos
- User asks: "move animal", "trocar lote", "movimentação", "transfer"
- Anti-teleport validation errors

## Critical Rule: Anti-Teleport

**You CANNOT update `animais.lote_id` without a corresponding `evento_movimentacao` in the SAME gesture.**

### Why?

Prevents data inconsistency where animals "teleport" without historical justification.

## Workflows

### 1. Move Single Animal Between Lotes

```typescript
const animal_id = "<animal_id>";
const from_lote_id = "<current_lote_id>";
const to_lote_id = "<new_lote_id>";

const evento_id = crypto.randomUUID();

const operations = [
  // 1. Create base event
  {
    table: "eventos",
    action: "INSERT",
    record: {
      id: evento_id,
      dominio: "movimentacao",
      occurred_at: new Date().toISOString(),
      animal_id: animal_id,
      lote_id: from_lote_id, // From original lote
    },
  },
  // 2. Create movement detail
  {
    table: "eventos_movimentacao",
    action: "INSERT",
    record: {
      evento_id: evento_id,
      from_lote_id: from_lote_id,
      to_lote_id: to_lote_id,
      from_pasto_id: null, // If tracking pasto-level
      to_pasto_id: null,
    },
  },
  // 3. Update animal's current lote (⚠️ MUST be after evento!)
  {
    table: "animais",
    action: "UPDATE",
    record: {
      id: animal_id,
      lote_id: to_lote_id,
    },
  },
];

await createGesture(fazenda_id, operations);
```

**Order Matters**:

1. evento (base)
2. eventos_movimentacao (detail)
3. UPDATE animais (state change)

### 2. Move Multiple Animals (Bulk)

```typescript
const animal_ids = ["<id1>", "<id2>", "<id3>"];
const from_lote_id = "<source_lote>";
const to_lote_id = "<dest_lote>";

const operations = animal_ids.flatMap((animal_id) => {
  const evento_id = crypto.randomUUID();
  return [
    {
      table: "eventos",
      action: "INSERT",
      record: {
        id: evento_id,
        dominio: "movimentacao",
        occurred_at: new Date().toISOString(),
        animal_id: animal_id,
        lote_id: from_lote_id,
      },
    },
    {
      table: "eventos_movimentacao",
      action: "INSERT",
      record: {
        evento_id: evento_id,
        from_lote_id: from_lote_id,
        to_lote_id: to_lote_id,
      },
    },
    {
      table: "animais",
      action: "UPDATE",
      record: {
        id: animal_id,
        lote_id: to_lote_id,
      },
    },
  ];
});

await createGesture(fazenda_id, operations);
```

**Warning**: Bulk moves generate 3 ops per animal (30 animals = 90 ops!)

**⚠️ Performance Limit**: Maximum **50 animals per gesture**

- **Reason**: Edge Function timeout = 60s
- **Calculation**: 3 ops/animal × 50 animals = 150 ops @ ~400ms/op ≈ 60s
- **Solution for larger batches**: Split into multiple gestures

### 3. Transfer Between Pastos (Lote Stays Same)

```typescript
// If tracking pasto-level movement but lote unchanged
const operations = [
  {
    table: "eventos",
    action: "INSERT",
    record: {
      id: evento_id,
      dominio: "movimentacao",
      occurred_at: new Date().toISOString(),
      animal_id: animal_id,
    },
  },
  {
    table: "eventos_movimentacao",
    action: "INSERT",
    record: {
      evento_id: evento_id,
      from_lote_id: null, // Lote unchanged
      to_lote_id: null,
      from_pasto_id: "<pasto_a>",
      to_pasto_id: "<pasto_b>",
    },
  },
  // NO animal UPDATE (lote didn't change)
];
```

## Error Handling

### Anti-Teleport Rejection

```json
{
  "status": "REJECTED",
  "reason_code": "ANTI_TELEPORTE",
  "reason_message": "UPDATE animais.lote_id sem evento base de movimentação no mesmo tx"
}
```

**Fix**: Add evento + eventos_movimentacao BEFORE the UPDATE

## Guardrails

- ✅ Evento + detail + UPDATE must be in ONE gesture
- ✅ Use correct operation order (evento → detalhe → UPDATE)
- ⚠️ Bulk moves can timeout (limit to 50 animals per gesture)
- ❌ Never UPDATE lote_id without evento

## References

- [CONTRACTS.md](../../../docs/CONTRACTS.md) - Anti-teleport validation
- [animal-lifecycle-runbook](../animal-lifecycle-runbook/SKILL.md)
