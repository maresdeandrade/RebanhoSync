---
name: health-events-runbook
description: Use when vaccination, vacinação, health event, sanitário, vermifugação, treatment, medicamento, or asking about registering health events, vaccines, treatments.
---

# Health Events Runbook - GestaoAgro

## Mission

Guide registration of sanitary events (vaccination, deworming, treatments) with proper evento + evento_sanitario structure and agenda completion.

## When to Use

- Recording vaccinations, deworming, treatments
- User asks: "vacinar", "vermifugar", "tratamento", "sanitary event"
- Completing scheduled sanitary tasks from agenda

## Workflows

### 1. Register Vaccination (Single Animal)

```typescript
const animal_id = "<animal_id>";
const produto = "Febre Aftosa - Dose Anual";

const operations = [
  {
    table: "eventos",
    action: "INSERT",
    record: {
      id: crypto.randomUUID(),
      dominio: "sanitario",
      occurred_at: new Date().toISOString(),
      animal_id: animal_id,
      lote_id: "<lote_id>", // From animal's current lote
      source_task_id: "<agenda_item_id or null>",
    },
  },
  {
    table: "eventos_sanitario",
    action: "INSERT",
    record: {
      evento_id: "<evento_id>",
      tipo: "vacinacao",
      produto: produto,
      dose_ml: 5.0,
      via_aplicacao: "subcutânea",
    },
  },
];
```

### 2. Register Vaccination (Bulk - Entire Lote)

```typescript
const lote_id = "<lote_id>";
const animais = await db.state_animais
  .where("[fazenda_id+lote_id]")
  .equals([fazenda_id, lote_id])
  .toArray();

const operations = animais.flatMap((animal) => [
  {
    table: "eventos",
    action: "INSERT",
    record: {
      id: crypto.randomUUID(),
      dominio: "sanitario",
      occurred_at: new Date().toISOString(),
      animal_id: animal.id,
      lote_id: lote_id,
    },
  },
  {
    table: "eventos_sanitario",
    action: "INSERT",
    record: {
      evento_id: "<evento_id_above>",
      tipo: "vacinacao",
      produto: "Febre Aftosa",
    },
  },
]);

await createGesture(fazenda_id, operations);
```

### 3. Complete Agenda Task + Register Event

```typescript
const agenda_item_id = "<task_id>";
const animal_id = "<animal_id>";

const operations = [
  // 1. Register event
  {
    table: "eventos",
    action: "INSERT",
    record: {
      id: crypto.randomUUID(),
      dominio: "sanitario",
      occurred_at: new Date().toISOString(),
      animal_id: animal_id,
      source_task_id: agenda_item_id, // Link to agenda
    },
  },
  {
    table: "eventos_sanitario",
    action: "INSERT",
    record: {
      evento_id: "<evento_id>",
      tipo: "vacinacao",
      produto: "Vacina X",
    },
  },
  // 2. Complete agenda task
  {
    table: "agenda_itens",
    action: "UPDATE",
    record: {
      id: agenda_item_id,
      status: "concluido",
      data_conclusao: new Date().toISOString(),
    },
  },
];
```

## Guardrails

- ✅ One evento per animal (no bulk events)
- ✅ `source_task_id` links event to agenda (if from scheduled task)
- ⚠️ Bulk operations can be large (50+ animals → 100+ ops)
- ❌ Never UPDATE evento_sanitario (append-only)

### Server-Side Validations

- ❌ **Animal with `status != 'ativo'`** (morto/vendido cannot receive events)
  - Validate before creating gesture: `animal.status === 'ativo'`
  - If status is `morto` or `vendido`, show error: "Cannot register event for inactive animal"

## References

- [DB.md](../../../docs/DB.md) - eventos_sanitario schema
- [agenda-reconciliation-runbook](../agenda-reconciliation-runbook/SKILL.md)
