---
name: agenda-protocols-runbook
description: Use when working with automated agenda generation, asking "protocolo sanitário", "agenda automática", "dedup agenda", "dedup_key", "protocol items", "gera_agenda", "intervalo_dias", or "how protocols create tasks".
---

# Skill: agenda-protocols-runbook

## Mission

Guide users through setting up and managing automated agenda generation via sanitária protocols in Gestão Agro, ensuring proper deduplication and interval-based scheduling.

## When to Use

- Setting up automated sanitary protocols
- User asks: "como funciona protocolo?", "agenda automática", "dedup_key"
- Debugging duplicate agenda items
- Implementing protocol-driven workflows
- Understanding `protocolos_sanitarios` and `protocolos_sanitarios_itens`

## Context

**Two Rails**: Protocols generate **Agenda** items (mutável), not Events (imutável).  
**Deduplication**: `dedup_key` prevents duplicate agenda items when protocols run multiple times.  
**Tables**:

- `protocolos_sanitarios`: Protocol template (e.g., "Bezerros - Vacinação")
- `protocolos_sanitarios_itens`: Individual items (e.g., "Febre Aftosa Dose 1", interval: 180 dias)
- `agenda_itens`: Generated tasks with `dedup_key` for idempotency

---

## Procedure

### 1. Understanding Protocol Structure

```sql
-- Protocol (template)
CREATE TABLE protocolos_sanitarios (
  id uuid PRIMARY KEY,
  fazenda_id uuid NOT NULL,
  nome text NOT NULL, -- e.g., "Protocolo Bezerros"
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  ...
);

-- Protocol Items (individual actions)
CREATE TABLE protocolos_sanitarios_itens (
  id uuid PRIMARY KEY,
  fazenda_id uuid NOT NULL,
  protocolo_id uuid NOT NULL,
  protocol_item_id uuid NOT NULL, -- Stable ID for dedup_template
  version int NOT NULL, -- Versioning for changes

  tipo sanitario_tipo_enum NOT NULL, -- 'vacinacao' | 'vermifugacao' | 'medicamento'
  produto text NOT NULL, -- e.g., "Febre Aftosa"
  intervalo_dias int NOT NULL CHECK (intervalo_dias > 0), -- e.g., 180
  dose_num int, -- e.g., 1, 2, 3 (for multi-dose vaccines)

  gera_agenda boolean NOT NULL DEFAULT true,
  dedup_template text, -- e.g., "proto:{protocolo_id}:item:{protocol_item_id}:animal:{animal_id}"
  ...
);
```

**Key Fields**:

- `intervalo_dias`: Days after base event to schedule agenda item
- `gera_agenda`: If `false`, item is just documentation (doesn't create agenda)
- `dedup_template`: Template string for generating `agenda_itens.dedup_key`

---

### 2. Creating a Protocol

#### Example: Bezerros Vaccination Protocol

```typescript
import { createGesture } from "@/lib/offline/ops";
import { v4 as uuid } from "uuid";

async function createProtocolBezerros(fazendaId: string) {
  const protocoloId = uuid();
  const item1Id = uuid(); // Stable ID for Dose 1
  const item2Id = uuid(); // Stable ID for Dose 2

  await createGesture({
    fazenda_id: fazendaId,
    client_id: "browser-client",
    ops: [
      // 1. Create protocol header
      {
        client_op_id: uuid(),
        table: "state_protocolos_sanitarios",
        action: "INSERT",
        record: {
          id: protocoloId,
          fazenda_id: fazendaId,
          nome: "Protocolo Bezerros",
          descricao: "Vacinação obrigatória para bezerros",
          ativo: true,
        },
      },
      // 2. Item 1: Febre Aftosa - Dose 1 (30 dias após nascimento)
      {
        client_op_id: uuid(),
        table: "state_protocolos_sanitarios_itens",
        action: "INSERT",
        record: {
          id: uuid(),
          fazenda_id: fazendaId,
          protocolo_id: protocoloId,
          protocol_item_id: item1Id,
          version: 1,
          tipo: "vacinacao",
          produto: "Febre Aftosa",
          intervalo_dias: 30,
          dose_num: 1,
          gera_agenda: true,
          dedup_template: `proto:${protocoloId}:item:${item1Id}:animal:{animal_id}`,
        },
      },
      // 3. Item 2: Febre Aftosa - Dose 2 (180 dias após Dose 1)
      {
        client_op_id: uuid(),
        table: "state_protocolos_sanitarios_itens",
        action: "INSERT",
        record: {
          id: uuid(),
          fazenda_id: fazendaId,
          protocolo_id: protocoloId,
          protocol_item_id: item2Id,
          version: 1,
          tipo: "vacinacao",
          produto: "Febre Aftosa",
          intervalo_dias: 180,
          dose_num: 2,
          gera_agenda: true,
          dedup_template: `proto:${protocoloId}:item:${item2Id}:animal:{animal_id}`,
        },
      },
    ],
  });
}
```

---

### 3. Generating Agenda from Protocol

> [!WARNING]
> **Server-Side Trigger (Option A) is NOT YET IMPLEMENTED.**  
> The trigger `generate_agenda_from_parto()` shown below is a **design proposal**.  
> For now, use **Option B (Client-Side)** to generate agenda itens.

**Trigger**: When a base event occurs (e.g., calf birth), protocol items generate agenda tasks.

#### Logic Flow:

```
1. Birth event created (evento tipo='parto', bezerro_id in payload)
2. Server/client checks active protocols
3. For each protocol_item with gera_agenda=true:
   a. Calculate data_prevista = birth_date + intervalo_dias
   b. **Generate dedup_key**: Replace {animal_id} placeholder in dedup_template
      - Server (PL/pgSQL): REPLACE(_protocol_item.dedup_template, '{animal_id}', _bezerro_id::text)
      - Client (TypeScript): item.dedup_template.replace('{animal_id}', calfId)
   c. Insert agenda_itens with dedup_key
   d. If duplicate dedup_key exists → skip (idempotent)
```

#### Implementation (Server-Side Edge Function or Client-Side)

**Option A: Server-Side** (recommended for consistency)

```sql
-- Trigger function on eventos_reproducao INSERT (when tipo='parto')
CREATE OR REPLACE FUNCTION generate_agenda_from_parto()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  _bezerro_id uuid;
  _birth_date date;
  _protocol_item record;
BEGIN
  -- Get calf ID and birth date
  _bezerro_id := (NEW.payload->>'bezerro_id')::uuid;
  _birth_date := (SELECT occurred_on FROM eventos WHERE id = NEW.evento_id);

  -- For each active protocol item
  FOR _protocol_item IN
    SELECT * FROM protocolos_sanitarios_itens psi
    JOIN protocolos_sanitarios ps ON ps.id = psi.protocolo_id
    WHERE ps.ativo = true AND psi.gera_agenda = true
      AND ps.fazenda_id = NEW.fazenda_id
  LOOP
    -- Generate agenda item with dedup_key
    INSERT INTO agenda_itens (
      fazenda_id,
      dominio,
      tipo,
      status,
      data_prevista,
      animal_id,
      dedup_key,
      source_kind,
      protocol_item_version_id,
      interval_days_applied,
      client_id,
      client_op_id,
      client_tx_id,
      client_recorded_at
    ) VALUES (
      NEW.fazenda_id,
      'sanitario',
      _protocol_item.tipo::text,
      'agendado',
      _birth_date + _protocol_item.intervalo_dias,
      _bezerro_id,
      REPLACE(_protocol_item.dedup_template, '{animal_id}', _bezerro_id::text),
      'automatico',
      _protocol_item.id,
      _protocol_item.intervalo_dias,
      'server',
      gen_random_uuid(),
      NULL,
      NOW()
    )
    ON CONFLICT (fazenda_id, dedup_key) WHERE status='agendado' DO NOTHING; -- Idempotent
  END LOOP;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_generate_agenda_parto
AFTER INSERT ON eventos_reproducao
FOR EACH ROW WHEN (NEW.tipo = 'parto')
EXECUTE FUNCTION generate_agenda_from_parto();
```

**Option B: Client-Side** (more complex, requires sync)

```typescript
async function generateAgendaForCalf(
  calfId: string,
  birthDate: Date,
  fazendaId: string,
) {
  // 1. Fetch active protocols from local Dexie
  const protocols = await db.state_protocolos_sanitarios
    .where({ fazenda_id: fazendaId, ativo: true })
    .toArray();

  const ops = [];

  for (const protocol of protocols) {
    const items = await db.state_protocolos_sanitarios_itens
      .where({ protocolo_id: protocol.id, gera_agenda: true })
      .toArray();

    for (const item of items) {
      const dataPrevista = new Date(birthDate);
      dataPrevista.setDate(dataPrevista.getDate() + item.intervalo_dias);

      const dedupKey = item.dedup_template.replace("{animal_id}", calfId);

      ops.push({
        client_op_id: uuid(),
        table: "state_agenda_itens",
        action: "INSERT",
        record: {
          id: uuid(),
          fazenda_id: fazendaId,
          dominio: "sanitario",
          tipo: item.tipo,
          status: "agendado",
          data_prevista: dataPrevista.toISOString().split("T")[0],
          animal_id: calfId,
          dedup_key: dedupKey,
          source_kind: "automatico",
          protocol_item_version_id: item.id,
          interval_days_applied: item.intervalo_dias,
        },
      });
    }
  }

  // 2. Create gesture
  await createGesture({
    fazenda_id: fazendaId,
    client_id: "browser-client",
    ops,
  });
}
```

---

### 4. Deduplication Mechanism

**Index**:

```sql
CREATE UNIQUE INDEX ux_agenda_dedup_active
ON agenda_itens(fazenda_id, dedup_key)
WHERE status = 'agendado' AND deleted_at IS NULL AND dedup_key IS NOT NULL;
```

**Behavior**:

- First insert: OK
- Second insert with same `(fazenda_id, dedup_key)` and `status='agendado'`: **REJECTED** (unique violation)
- After task completed (`status='concluido'`): Index no longer applies → Can create new task with same dedup_key

**Example**:

```sql
-- First run: OK
INSERT INTO agenda_itens (fazenda_id, dedup_key, status, ...)
VALUES ('f1', 'proto:p1:item:i1:animal:a1', 'agendado', ...);

-- Second run: FAILS (duplicate)
INSERT INTO agenda_itens (fazenda_id, dedup_key, status, ...)
VALUES ('f1', 'proto:p1:item:i1:animal:a1', 'agendado', ...);

-- After completing first task:
UPDATE agenda_itens SET status = 'concluido' WHERE dedup_key = 'proto:p1:item:i1:animal:a1';

-- Now third run: OK (index doesn't apply to status='concluido')
INSERT INTO agenda_itens (fazenda_id, dedup_key, status, ...)
VALUES ('f1', 'proto:p1:item:i1:animal:a1', 'agendado', ...);
```

---

## Guardrails

### Protocol Design

- ✅ Use **stable `protocol_item_id`** (UUID) in dedup_template (don't use `id`, it changes on version bump)
- ✅ Set `gera_agenda=false` for documentation-only items
- ⚠️ Test protocol on a single animal before enabling for entire farm

### Dedup Template

- ✅ Always include `{animal_id}` or `{lote_id}` in template (ensures per-animal/lote uniqueness)
- ✅ Format: `"proto:{protocolo_id}:item:{protocol_item_id}:animal:{animal_id}"`
- ❌ Don't hardcode animal ID in template (breaks reusability)

### Versioning

- When updating protocol item (e.g., change product name), increment `version`
- Existing agenda items keep old `protocol_item_version_id` (historical reference)
- New agenda items use new version

---

## Examples

### Example 1: Protocol Generates 2 Agenda Items on Birth

**Setup**: Protocol "Bezerros" with 2 items (Dose 1 @ 30 days, Dose 2 @ 180 days).

**Action**: Calf `BEZ-001` born on 2024-01-15.

**Result**:

```sql
-- agenda_itens created:
| id  | data_prevista | tipo       | produto       | dedup_key                                   |
|-----|---------------|------------|---------------|---------------------------------------------|
| ag1 | 2024-02-14    | vacinacao  | Febre Aftosa  | proto:p1:item:i1:animal:bez001              |
| ag2 | 2024-07-13    | vacinacao  | Febre Aftosa  | proto:p1:item:i2:animal:bez001              |
```

### Example 2: Re-running Protocol Doesn't Duplicate

**Action**: User manually triggers protocol again for `BEZ-001`.

**Result**: INSERT fails (unique constraint) → No duplicates created.

### Example 3: Completing Task Allows Re-scheduling

**Action**:

1. Complete Dose 1 task (`ag1` → status='concluido')
2. Re-run protocol

**Result**: New agenda item created (index doesn't block `status='concluido'`).

---

## Definition of Done

- [ ] Protocol created with at least 1 item (`gera_agenda=true`)
- [ ] `dedup_template` includes `{animal_id}` placeholder
- [ ] Agenda items generated automatically on trigger event (parto)
- [ ] Duplicate agenda items prevented (unique constraint works)
- [ ] UI shows protocol-generated tasks with badge/indicator
- [ ] User can complete tasks → agenda transitions `agendado` → `concluido`

---

## Failure Modes

| Symptom                  | Cause                        | Solution                                       |
| ------------------------ | ---------------------------- | ---------------------------------------------- |
| Duplicate agenda items   | Missing or wrong `dedup_key` | Verify `dedup_template` includes `{animal_id}` |
| Agenda not generated     | `gera_agenda=false`          | Set to `true` in protocol_item                 |
| "Unique violation" error | Expected (idempotent)        | Ignore or handle as success (no action needed) |
| Wrong date calculated    | Incorrect `intervalo_dias`   | Check protocol_item definition                 |
| Agenda for wrong animal  | `{animal_id}` not replaced   | Verify template replacement logic              |

---

## References

- `AI_RULES.md` - Lines 13-15 (Agenda dedup rules)
- `docs/DB.md` - Dedup index explanation
- `supabase/migrations/0001_init.sql` - Lines 407-467 (protocolos tables)
- `supabase/migrations/0001_init.sql` - Lines 522-524 (dedup unique index)
