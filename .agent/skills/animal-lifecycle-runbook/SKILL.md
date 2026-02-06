---
name: animal-lifecycle-runbook
description: Use when creating animal, registering animal, animal workflow, cadastrar animal, or asking about animal registration process, birth registration, purchase registration.
---

# Animal Lifecycle Runbook - GestaoAgro

## Mission

Guide users through the complete animal lifecycle workflows: birth registration, purchase, sale, death/exit, and related event tracking.

## When to Use

- Registering new animal (birth or purchase)
- Recording animal sale or death
- User asks: "create animal", "register birth", "buy animal", "sell animal"

## Workflows

### 1. Register Birth (Internal)

**Entities**: `animais` (INSERT) + `eventos_reproducao` (parto) + `eventos_financeiro` (optional cost)

```typescript
const mother_id = "<mae_id>";
const lote_id = "<lote_id>"; // Usually same as mother's lote

const operations = [
  // 1. Create animal
  {
    table: "animais",
    action: "INSERT",
    record: {
      id: crypto.randomUUID(),
      identificacao: "CRIA-2026-001",
      sexo: "F",
      data_nascimento: "2026-02-05",
      mae_id: mother_id,
      lote_id: lote_id,
      status: "ativo",
    },
  },
  // 2. Record birth event
  {
    table: "eventos",
    action: "INSERT",
    record: {
      id: crypto.randomUUID(),
      dominio: "reproducao",
      occurred_at: "2026-02-05T10:30:00Z",
      animal_id: mother_id, // Event belongs to MOTHER
      lote_id: lote_id,
    },
  },
  {
    table: "eventos_reproducao",
    action: "INSERT",
    record: {
      evento_id: "<evento_id_from_step_2>",
      tipo: "parto",
      macho_id: null, // If known, add bull ID
      observacoes: "Parto normal, cria fêmea",
    },
  },
];

await createGesture(fazenda_id, operations);
```

### 2. Register Purchase

**Entities**: `animais` (INSERT) + `eventos_financeiro` (compra)

```typescript
const operations = [
  // 1. Create animal
  {
    table: "animais",
    action: "INSERT",
    record: {
      id: crypto.randomUUID(),
      identificacao: "COMP-2026-042",
      sexo: "M",
      data_nascimento: "2024-06-15", // Estimated if unknown
      lote_id: "<lote_id>",
      status: "ativo",
    },
  },
  // 2. Record purchase event
  {
    table: "eventos",
    action: "INSERT",
    record: {
      id: crypto.randomUUID(),
      dominio: "financeiro",
      occurred_at: "2026-02-05T14:00:00Z",
      animal_id: "<animal_id_from_step_1>",
    },
  },
  {
    table: "eventos_financeiro",
    action: "INSERT",
    record: {
      evento_id: "<evento_id_from_step_2>",
      tipo: "compra",
      valor_total: 2500.0,
      contraparte_id: "<fornecedor_id>",
    },
  },
];
```

### 3. Record Sale

**Entities**: `eventos_financeiro` (venda) + `animais` (UPDATE status=vendido)

```typescript
const animal_id = "<animal_id>";

const operations = [
  // 1. Record sale event
  {
    table: "eventos",
    action: "INSERT",
    record: {
      id: crypto.randomUUID(),
      dominio: "financeiro",
      occurred_at: "2026-02-10T16:00:00Z",
      animal_id: animal_id,
    },
  },
  {
    table: "eventos_financeiro",
    action: "INSERT",
    record: {
      evento_id: "<evento_id>",
      tipo: "venda",
      valor_total: 3200.0,
      contraparte_id: "<comprador_id>",
    },
  },
  // 2. Update animal status
  {
    table: "animais",
    action: "UPDATE",
    record: {
      id: animal_id,
      status: "vendido",
    },
  },
];
```

### 4. Record Death/Exit

**Entities**: `animais` (UPDATE status=morto)

```typescript
const operations = [
  {
    table: "animais",
    action: "UPDATE",
    record: {
      id: animal_id,
      status: "morto",
      observacoes: "Morte natural - causa desconhecida",
    },
  },
];

// Optional: Create evento for tracking
// (could be dominio: sanitario with specific tipo for death cause)
```

## Guardrails

- ✅ Always set `status: 'ativo'` for new animals
- ⚠️ Birth events belong to MOTHER, not cria
- ⚠️ Sale/Death must UPDATE status (not soft delete)
- ❌ Never hard-delete animals (use status or soft delete)

## References

- [DB.md](../../../docs/DB.md) - Schema for animais, eventos
- [movement-traceability-runbook](../movement-traceability-runbook/SKILL.md) - For lote changes
