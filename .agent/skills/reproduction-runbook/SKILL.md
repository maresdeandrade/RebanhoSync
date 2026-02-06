---
name: reproduction-runbook
description: Use when working with reproduction events, asking "reprodução", "cobertura", "IA", "inseminação artificial", "diagnóstico prenhez", "parto", "repro_tipo", "eventos_reproducao", "macho_id", "breeding", "pregnancy diagnosis".
---

# Skill: reproduction-runbook

## Mission

Guide users through registering and managing reproduction events in Gest\u00e3o Agro, including natural breeding (cobertura), artificial insemination (IA), pregnancy diagnosis, and birth (parto).

## When to Use

- Registering reproduction events
- User asks: "como registrar IA?", "cobertura", "prenhez", "parto"
- Implementing UI for reproduction domain
- Debugging reproduction-related sync issues
- Setting up reproduction protocols

## Context

**Domain**: `reproducao` (one of 6 core domains in Two Rails architecture)  
**Tables**:

- `eventos` (parent, stores `dominio='reproducao'`)
- `eventos_reproducao` (1:1 detail, stores `tipo`, `macho_id`)

**Reproduction Types** (`repro_tipo_enum`):

- `cobertura`: Natural breeding
- `IA`: Artificial insemination
- `diagnostico`: Pregnancy diagnosis
- `parto`: Birth

---

## Procedure

### 1. Understanding Reproduction Event Structure

```sql
-- Parent event
CREATE TABLE eventos (
  id uuid PRIMARY KEY,
  fazenda_id uuid NOT NULL,
  dominio dominio_enum NOT NULL, -- 'reproducao'
  occurred_at timestamptz NOT NULL,
  animal_id uuid NULL, -- Fêmea (female)
  lote_id uuid NULL,   -- Optional: lote da fêmea
  observacoes text,
  ...
);

-- Detail (1:1)
CREATE TABLE eventos_reproducao (
  evento_id uuid PRIMARY KEY REFERENCES eventos(id),
  fazenda_id uuid NOT NULL,
  tipo repro_tipo_enum NOT NULL, -- 'cobertura' | 'IA' | 'diagnostico' | 'parto'
  macho_id uuid NULL, -- Reprodutor (if tipo='cobertura' or 'IA')
  payload jsonb, -- e.g. {"resultado_prenhez": "positivo", "touro_codigo": "T-123"}
  ...
);
```

**Key Points**:

- `eventos.animal_id` = **fêmea** (female)
- `eventos_reproducao.macho_id` = **reprodutor** (male, optional for cobertura/IA)
- `payload` can store additional fields (diagnóstico result, calf ID for parto, etc.)

---

### 2. Registering Reproduction Events via Offline createGesture

#### Example A: Natural Breeding (Cobertura)

```typescript
import { createGesture } from "@/lib/offline/ops";
import { v4 as uuid } from "uuid";

async function registerCobertura({
  fazendaId,
  femaleId,
  maleId,
  occurredAt,
  observacoes,
}: {
  fazendaId: string;
  femaleId: string;
  maleId: string;
  occurredAt: Date;
  observacoes?: string;
}) {
  const eventoId = uuid();
  const clientOpId1 = uuid();
  const clientOpId2 = uuid();

  await createGesture({
    fazenda_id: fazendaId,
    client_id: "browser-client",
    ops: [
      // 1. Insert parent evento
      {
        client_op_id: clientOpId1,
        table: "events_eventos",
        action: "INSERT",
        record: {
          id: eventoId,
          fazenda_id: fazendaId,
          dominio: "reproducao",
          occurred_at: occurredAt.toISOString(),
          animal_id: femaleId, // Fêmea
          observacoes,
        },
      },
      // 2. Insert detail eventos_reproducao
      {
        client_op_id: clientOpId2,
        table: "events_eventos_reproducao",
        action: "INSERT",
        record: {
          evento_id: eventoId,
          fazenda_id: fazendaId,
          tipo: "cobertura",
          macho_id: maleId, // Touro/Reprodutor
          payload: {},
        },
      },
    ],
  });
}
```

#### Example B: Artificial Insemination (IA)

```typescript
async function registerIA({
  fazendaId,
  femaleId,
  semenCode, // Código do sêmen (identificação do touro)
  occurredAt,
  observacoes,
}: {
  fazendaId: string;
  femaleId: string;
  semenCode: string;
  occurredAt: Date;
  observacoes?: string;
}) {
  const eventoId = uuid();

  await createGesture({
    fazenda_id: fazendaId,
    client_id: "browser-client",
    ops: [
      {
        client_op_id: uuid(),
        table: "events_eventos",
        action: "INSERT",
        record: {
          id: eventoId,
          fazenda_id: fazendaId,
          dominio: "reproducao",
          occurred_at: occurredAt.toISOString(),
          animal_id: femaleId,
          observacoes,
        },
      },
      {
        client_op_id: uuid(),
        table: "events_eventos_reproducao",
        action: "INSERT",
        record: {
          evento_id: eventoId,
          fazenda_id: fazendaId,
          tipo: "IA",
          macho_id: null, // IA geralmente não tem macho físico na fazenda
          payload: { semen_code: semenCode },
        },
      },
    ],
  });
}
```

#### Example C: Pregnancy Diagnosis

```typescript
async function registerDiagnosticoPrenhez({
  fazendaId,
  femaleId,
  resultado, // 'positivo' | 'negativo' | 'inconclusivo'
  occurredAt,
  observacoes,
}: {
  fazendaId: string;
  femaleId: string;
  resultado: "positivo" | "negativo" | "inconclusivo";
  occurredAt: Date;
  observacoes?: string;
}) {
  const eventoId = uuid();

  await createGesture({
    fazenda_id: fazendaId,
    client_id: "browser-client",
    ops: [
      {
        client_op_id: uuid(),
        table: "events_eventos",
        action: "INSERT",
        record: {
          id: eventoId,
          fazenda_id: fazendaId,
          dominio: "reproducao",
          occurred_at: occurredAt.toISOString(),
}
```

#### Example D: Birth (Parto)

```typescript
async function registerParto({
  fazendaId,
  femaleId,
  calfData, // Dados do bezerro (será criado como novo animal)
  occurredAt,
  observacoes,
}: {
  fazendaId: string;
  femaleId: string;
  calfData: {
    identificacao: string;
    sexo: "M" | "F";
    lote_id?: string;
  };
  occurredAt: Date;
  observacoes?: string;
}) {
  const eventoId = uuid();
  const calfId = uuid();

  await createGesture({
    fazenda_id: fazendaId,
    client_id: "browser-client",
    ops: [
      // 1. Create calf animal
      {
        client_op_id: uuid(),
        table: "state_animais",
        action: "INSERT",
        record: {
          id: calfId,
          fazenda_id: fazendaId,
          identificacao: calfData.identificacao,
          sexo: calfData.sexo,
          status: "ativo",
          data_nascimento: occurredAt.toISOString().split("T")[0], // YYYY-MM-DD
          mae_id: femaleId,
          lote_id: calfData.lote_id || null,
        },
      },
      // 2. Insert parent evento
      {
        client_op_id: uuid(),
        table: "events_eventos",
        action: "INSERT",
        record: {
          id: eventoId,
          fazenda_id: fazendaId,
          dominio: "reproducao",
          occurred_at: occurredAt.toISOString(),
          animal_id: femaleId, // Mãe
          observacoes,
        },
      },
      // 3. Insert detail eventos_reproducao
      {
        client_op_id: uuid(),
        table: "events_eventos_reproducao",
        action: "INSERT",
        record: {
          evento_id: eventoId,
          fazenda_id: fazendaId,
          tipo: "parto",
          macho_id: null,
          payload: { bezerro_id: calfId },
        },
      },
    ],
  });
}
```

---

### 3. Validations (Server-Side)

**Edge Function**: `sync-batch` should validate:

1. **Female is valid**: `eventos.animal_id` must exist and be female (`animais.sexo = 'F'`)
2. **Male is valid** (if provided): `eventos_reproducao.macho_id` must exist and be male (`animais.sexo = 'M'`)
3. **Male is enabled for breeding**: `animais.habilitado_monta = true` (optional but recommended)
4. **Calf ID in parto**: If `tipo='parto'`, ensure calf was created in same gesture

---

### 4. UI Patterns

#### Form: Register Cobertura

```tsx
<Form>
  <SelectFemale name="femaleId" label="Fêmea" />
  <SelectMale
    name="maleId"
    label="Reprodutor"
    filter={{ habilitado_monta: true }}
  />
  <DatePicker name="occurredAt" label="Data da Cobertura" />
  <Textarea name="observacoes" label="Observações (opcional)" />
  <SubmitButton>Registrar Cobertura</SubmitButton>
</Form>
```

#### Timeline View: Show Reproduction Events

```tsx
{
  eventos
    .filter((e) => e.dominio === "reproducao")
    .map((evento) => {
      const detail = eventosReproducao.find((r) => r.evento_id === evento.id);

      return (
        <TimelineItem key={evento.id} icon={<HeartIcon />}>
          <Badge>{detail?.tipo.toUpperCase()}</Badge>
          <p>{format(evento.occurred_at, "dd/MM/yyyy HH:mm")}</p>
          {detail?.tipo === "cobertura" && detail.macho_id && (
            <span>Reprodutor: {getMachoIdentificacao(detail.macho_id)}</span>
          )}
          {detail?.tipo === "diagnostico" && (
            <Badge
              variant={
                detail.payload.resultado_prenhez === "positivo"
                  ? "success"
                  : "default"
              }
            >
              {detail.payload.resultado_prenhez}
            </Badge>
          )}
        </TimelineItem>
      );
    });
}
```

---

## Guardrails

### Data Integrity

- ✅ **Always insert parent (`eventos`) before detail (`eventos_reproducao`)** within same gesture
- ✅ For `parto`, create calf animal **before** creating evento (FK order)
- ❌ **Never UPDATE** business columns in `eventos_reproducao` (append-only rule)
  - If correcting data: create new counter-event with `corrige_evento_id`

### Validation

- ⚠️ Validate `animal_id` (female) exists in local Dexie before creating gesture
- ⚠️ Validate `macho_id` (male) exists and `sexo='M'` before submitting
- ⚠️ For IA, `macho_id` can be `null` (semen from external source)

### Business Rules

- **Minimum breeding age**: Female must be at least 14 months old (optional validation)
- **Parto interval**: Avoid multiple `parto` events for same female within 250 days (optional warning)

---

## Examples

### Example 1: Complete Flow - Cobertura to Parto

1. **Register Cobertura** (Day 0):

```typescript
await registerCobertura({
  fazendaId: "f1",
  femaleId: "vaca-001",
  maleId: "touro-002",
  occurredAt: new Date("2024-01-15"),
  observacoes: "Primeira cobertura da temporada",
});
```

2. **Register Diagnóstico** (Day +45):

```typescript
await registerDiagnosticoPrenhez({
  fazendaId: "f1",
  femaleId: "vaca-001",
  resultado: "positivo",
  occurredAt: new Date("2024-03-01"),
});
```

3. **Register Parto** (Day +285):

```typescript
await registerParto({
  fazendaId: "f1",
  femaleId: "vaca-001",
  calfData: {
    identificacao: "BEZ-2024-001",
    sexo: "M",
    lote_id: "lote-bezerros",
  },
  occurredAt: new Date("2024-10-26"),
  observacoes: "Parto normal, bezerro saudável",
});
```

### Example 2: Handling IA with External Semen

```typescript
await registerIA({
  fazendaId: "f1",
  femaleId: "vaca-003",
  semenCode: "ANGUS-BR-7890",
  occurredAt: new Date(),
  observacoes: "Sêmen importado - Angus Black",
});
```

### Example 3: Query Reproduction History for a Female

```sql
SELECT
  e.occurred_at,
  er.tipo,
  er.macho_id,
  er.payload,
  e.observacoes
FROM eventos e
JOIN eventos_reproducao er ON er.evento_id = e.id
WHERE e.animal_id = 'vaca-001'
  AND e.dominio = 'reproducao'
  AND e.deleted_at IS NULL
ORDER BY e.occurred_at DESC;
```

---

## Definition of Done

- [ ] User can register `cobertura` event via UI
- [ ] User can register `IA` event with semen code
- [ ] User can register `diagnostico` event with result (positivo/negativo)
- [ ] User can register `parto` event that creates new calf animal
- [ ] `eventos` and `eventos_reproducao` synced correctly (no 500 errors)
- [ ] Timeline view shows reproduction events with correct icons/badges
- [ ] Validation prevents registering cobertura with female as `macho_id`
- [ ] Offline: Events queued locally and synced when online

---

## Failure Modes

| Symptom                                        | Cause                      | Solution                                                         |
| ---------------------------------------------- | -------------------------- | ---------------------------------------------------------------- |
| "FK violation on eventos_reproducao.evento_id" | Parent not created first   | Ensure `eventos` INSERT before `eventos_reproducao` in ops array |
| "Animal not found"                             | `animal_id` invalid        | Validate animal exists in Dexie before gesture                   |
| "Cannot insert macho_id: not male"             | Female ID used as macho_id | Add UI filter: `sexo='M' AND habilitado_monta=true`              |
| Parto doesn't create calf                      | Calf INSERT missing        | Add calf creation op to gesture                                  |
| Sync rejected: "Invalid dominio"               | Typo in `dominio` field    | Use `'reproducao'` (not `'reprodução'` with ç)                   |

---

## References

- `AI_RULES.md` - Domain rules (no updates to append-only events)
- `docs/DB.md` - Database schema for `eventos_reproducao`
- `docs/ARCHITECTURE.md` - Two Rails architecture
- `supabase/migrations/0001_init.sql` - Lines 670-686 (eventos_reproducao table)
