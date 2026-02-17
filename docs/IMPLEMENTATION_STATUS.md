# Status de Implementação (Derivado)

- Status: Derivado
- Baseline: 0bb8829
- Última Atualização: 2024-03-24
- Derivado por: Antigravity Regen vNext Consolidado — Rev D

## 1. Sanitario

| capability_id | DB | Server | Offline | UI Write | UI Read/Hist | E2E | Evidence (EIDs) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **sanitario.registro** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | [E.sanitario.registro.DB] [E.sanitario.registro.UIW] |
| **sanitario.historico** | — | — | — | — | ⚠️ | ⚠️ | [E.sanitario.historico.UIR] |
| **sanitario.agenda_link** | ✅ | ✅ | — | — | — | ✅ | [E.sanitario.agenda_link.DB] |

## 2. Pesagem

| capability_id | DB | Server | Offline | UI Write | UI Read/Hist | E2E | Evidence (EIDs) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **pesagem.registro** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | [E.pesagem.registro.DB] [E.pesagem.registro.UIW] |
| **pesagem.historico** | — | — | — | — | ⚠️ | ⚠️ | [E.pesagem.historico.UIR] |

## 3. Nutricao
> **Nota:** Estoque (Stock) é **🚫 OUT-OF-SCOPE** para o MVP.

| capability_id | DB | Server | Offline | UI Write | UI Read/Hist | E2E | Evidence (EIDs) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **nutricao.registro** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | [E.nutricao.registro.DB] |
| **nutricao.historico** | — | — | — | — | ⚠️ | ⚠️ | [E.nutricao.historico.UIR] |

## 4. Movimentacao

| capability_id | DB | Server | Offline | UI Write | UI Read/Hist | E2E | Evidence (EIDs) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **movimentacao.registro** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | [E.movimentacao.registro.DB] |
| **movimentacao.historico** | — | — | — | — | ⚠️ | ⚠️ | [E.movimentacao.historico.UIR] |
| **movimentacao.anti_teleport_client** | — | — | — | ✅ | — | ✅ | [E.movimentacao.anti_teleport_client.UIW] |

## 5. Reproducao

| capability_id | DB | Server | Offline | UI Write | UI Read/Hist | E2E | Evidence (EIDs) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **reproducao.registro** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | [E.reproducao.registro.DB] |
| **reproducao.historico** | — | — | — | — | ✅ | ✅ | [E.reproducao.historico.UIR] |
| **reproducao.episode_linking** | ✅ | ✅ | ✅ | — | ✅ | ✅ | [E.reproducao.episode_linking.OFF] |

## 6. Financeiro

| capability_id | DB | Server | Offline | UI Write | UI Read/Hist | E2E | Evidence (EIDs) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **financeiro.registro** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | [E.financeiro.registro.DB] [E.financeiro.registro.UIW] |
| **financeiro.historico** | — | — | — | — | ✅ | ✅ | [E.financeiro.historico.UIR] |

## 7. Agenda

| capability_id | DB | Server | Offline | UI Write | UI Read/Hist | E2E | Evidence (EIDs) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **agenda.gerar** | ✅ | ✅ | — | — | — | ✅ | [E.agenda.gerar.SRV] |
| **agenda.concluir** | ✅ | ✅ | ✅ | ✅ | — | ✅ | [E.agenda.concluir.UIW] |
| **agenda.dedup** | — | ✅ | ✅ | — | — | ✅ | [E.agenda.dedup.SRV] |
| **agenda.recalculo** | ✅ | ✅ | — | — | — | ✅ | [E.agenda.recalculo.SRV] |

---

## Evidence Index

### Sanitario
- **[E.sanitario.registro.DB]:** `supabase/migrations/0028_sanitario_agenda_engine.sql` (Creates `eventos_sanitario` table)
- **[E.sanitario.registro.UIW]:** `src/pages/ProtocolosSanitarios.tsx` (found `gera_agenda` flags)
- **[E.sanitario.historico.UIR]:** `src/pages/AnimalDetalhe.tsx:333-376` (Generic timeline lacks protocol/vaccine details)
- **[E.sanitario.agenda_link.DB]:** `supabase/migrations/0028_sanitario_agenda_engine.sql` (`sanitario_recompute_agenda_core`)

### Pesagem
- **[E.pesagem.registro.DB]:** `supabase/migrations/0001_init.sql` (Initial schema includes basic tables)
- **[E.pesagem.registro.UIW]:** `src/pages/Registrar.tsx:365` (Generic register form includes pesagem)
- **[E.pesagem.historico.UIR]:** `src/pages/AnimalDetalhe.tsx:333-376` (Generic timeline lacks weight value, only shows existence)

### Nutricao
- **[E.nutricao.registro.DB]:** `supabase/migrations/0024_hardening_eventos_nutricao.sql` (Hardening for nutrition events)
- **[E.nutricao.historico.UIR]:** `src/pages/AnimalDetalhe.tsx:333-376` (Generic timeline lacks feed/quantity details)

### Movimentacao
- **[E.movimentacao.registro.DB]:** `supabase/migrations/0025_hardening_eventos_movimentacao.sql` (Hardening for movement events)
- **[E.movimentacao.historico.UIR]:** `src/pages/AnimalDetalhe.tsx:333-376` (Generic timeline lacks from/to details)
- **[E.movimentacao.anti_teleport_client.UIW]:** `src/lib/events/validators/movimentacao.ts:16` (Validates origin != destination)

### Reproducao
- **[E.reproducao.registro.DB]:** `supabase/migrations/0035_reproducao_hardening_v1.sql` (Hardening for reproduction events)
- **[E.reproducao.historico.UIR]:** `src/pages/AnimalDetalhe.tsx:333-376` (Timeline shows specific reproduction details: diagnosis, sire, etc.)
- **[E.reproducao.episode_linking.OFF]:** `src/lib/reproduction/linking.ts:15-45` (Implements `findLinkedServiceForDiagnostic`)

### Financeiro
- **[E.financeiro.registro.DB]:** `supabase/migrations/0023_hardening_eventos_financeiro.sql` (Hardening for financial events)
- **[E.financeiro.registro.UIW]:** `src/pages/Registrar.tsx:392` (Financeiro specific form fields)
- **[E.financeiro.historico.UIR]:** `src/pages/Financeiro.tsx:187` (Full financial history page)

### Agenda
- **[E.agenda.gerar.SRV]:** `supabase/migrations/0028_sanitario_agenda_engine.sql` (`sanitario_recompute_agenda_core`)
- **[E.agenda.concluir.UIW]:** `src/pages/Agenda.tsx:156` (UI for concluding agenda items)
- **[E.agenda.dedup.SRV]:** `src/lib/offline/types.ts:47` (Defines `dedup_key`)
- **[E.agenda.recalculo.SRV]:** `supabase/migrations/0028_sanitario_agenda_engine.sql` (Server-side recompute logic)
