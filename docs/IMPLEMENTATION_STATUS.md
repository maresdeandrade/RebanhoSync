# Implementation Status Matrix

> **Status:** Derivado (Rev D+)
> **Baseline:** `f78dbb4`
> **Ultima Atualizacao:** 2026-04-01
> **Derivado por:** Atualizacao manual a partir do codigo e da estrutura atual do repositorio

Este documento registra o estado efetivo do RebanhoSync no inicio de abril de 2026, ja com a readequacao do produto para um uso mais simples por pequeno e medio produtor.

## Resumo Executivo

- **Estagio do produto:** MVP operacional em consolidacao.
- **Core operacional:** sanitatio, pesagem, movimentacao, nutricao, reproducao, financeiro e agenda estao implementados e usaveis.
- **Camadas novas de produto:** onboarding guiado, importacao CSV, relatorios operacionais, telemetria local de piloto, modo de experiencia da fazenda, dashboard e ficha reprodutiva dedicada.
- **Camada mais recente:** pos-parto neonatal dedicado, agrupamento matriz-cria na listagem e elegibilidade reprodutiva por categoria.
- **Qualidade local:** lint, test, build e o pacote principal de testes E2E guiados estao verdes.
- **Gaps abertos:** 4 itens de catalogo e 2 itens de infra.

## 1. Infraestrutura Core

### Auth, multi-tenant e RBAC

- Auth via Supabase.
- Selecionador de fazenda ativa com persistencia local/remota.
- Contexto multi-tenant por `fazenda_id`.
- Controle de acesso por `owner`, `manager` e `cowboy`.
- Gestao de membros e convites ja implementada.

**Evidencia principal**

- `src/hooks/useAuth.tsx`
- `src/pages/SelectFazenda.tsx`
- `src/pages/AdminMembros.tsx`
- `supabase/migrations/`
- `docs/RLS.md`

### Offline-first

- Dexie com stores de estado, eventos, fila e metricas locais.
- Gestos atomicos com `queue_gestures` e `queue_ops`.
- Aplicacao otimista, rollback e DLQ.
- Worker de sync com `sync-batch`.

**Evidencia principal**

- `src/lib/offline/db.ts`
- `src/lib/offline/ops.ts`
- `src/lib/offline/syncWorker.ts`
- `supabase/functions/sync-batch/`

## 2. Dominios Operacionais

| Dominio | Estado | Evidencia principal |
| --- | --- | --- |
| `sanitario.registro` | Completo, com gap de normalizacao de produto | `src/pages/Registrar.tsx`, `src/lib/events/buildEventGesture.ts`, `src/pages/Agenda.tsx` |
| `sanitario.historico` | Completo | `src/pages/Eventos.tsx` |
| `sanitario.agenda_link` | Completo | `supabase/migrations/0028_sanitario_agenda_engine.sql` |
| `pesagem.registro` | Completo | `src/pages/Registrar.tsx`, `src/pages/AnimalDetalhe.tsx` |
| `pesagem.historico` | Funcional, com agregacao ainda client-side | `src/pages/AnimalDetalhe.tsx`, `src/pages/Dashboard.tsx` |
| `nutricao.registro` | Completo | `src/pages/Registrar.tsx`, `src/pages/Eventos.tsx` |
| `nutricao.historico` | Completo | `src/pages/Eventos.tsx` |
| `movimentacao.registro` | Completo, com gap de FK no banco | `src/pages/Registrar.tsx`, `src/lib/events/buildEventGesture.ts` |
| `movimentacao.historico` | Completo | `src/pages/Eventos.tsx` |
| `movimentacao.anti_teleport_client` | Completo | `src/pages/Registrar.tsx`, `src/pages/__tests__/Registrar.test.tsx` |
| `reproducao.registro` | Completo, com fluxo de parto e pos-parto; gap de FK no banco permanece | `src/components/events/ReproductionForm.tsx`, `src/lib/reproduction/register.ts`, `src/pages/AnimalReproducao.tsx`, `src/pages/AnimalPosParto.tsx` |
| `reproducao.historico` | Completo | `src/pages/ReproductionDashboard.tsx`, `src/pages/AnimalDetalhe.tsx` |
| `reproducao.episode_linking` | Completo | `src/lib/reproduction/linking.ts`, `src/lib/reproduction/status.ts` |
| `financeiro.registro` | Completo | `src/pages/Registrar.tsx`, `src/pages/Financeiro.tsx` |
| `financeiro.historico` | Completo | `src/pages/Financeiro.tsx` |
| `agenda.gerar` | Completo | `src/pages/Agenda.tsx`, `supabase/migrations/0028_sanitario_agenda_engine.sql` |
| `agenda.concluir` | Completo | `src/pages/Agenda.tsx`, `src/lib/sanitario/service.ts` |
| `agenda.dedup` | Completo | `docs/CONTRACTS.md`, `supabase/functions/sync-batch/` |
| `agenda.recalculo` | Completo | `supabase/migrations/0028_sanitario_agenda_engine.sql` |

**Capability Score Analitico**

- Total de capabilities catalogadas: `19`
- Com gap de catalogo: `4`
- Score atual: `15/19 = 78.9%`

## 3. Superficie de Produto Ja Consolidada

Estas camadas nao estavam refletidas no snapshot anterior e agora fazem parte do estado real do produto:

- onboarding guiado da fazenda: `src/pages/OnboardingInicial.tsx`
- importacao CSV de animais: `src/pages/AnimaisImportar.tsx`
- importacao CSV de lotes: `src/pages/LotesImportar.tsx`
- importacao CSV de pastos: `src/pages/PastosImportar.tsx`
- relatorios operacionais: `src/pages/Relatorios.tsx`
- dashboard reprodutivo dedicado: `src/pages/ReproductionDashboard.tsx`
- ficha reprodutiva por matriz: `src/pages/AnimalReproducao.tsx`
- pos-parto neonatal dedicado por matriz: `src/pages/AnimalPosParto.tsx`
- apresentacao visual por categoria/estagio do animal: `src/components/animals/`
- agrupamento matriz-cria na listagem: `src/pages/Animais.tsx`, `src/lib/animals/familyOrder.ts`
- elegibilidade reprodutiva por categoria: `src/lib/animals/presentation.ts`
- telemetria local de piloto: `src/lib/telemetry/`
- modo de experiencia por fazenda: `src/lib/farms/experienceMode.ts`

## 4. Estado de Qualidade

- `pnpm run lint`: verde
- `pnpm test`: verde
- `pnpm run build`: verde
- `pnpm run test:e2e`: cobre onboarding, importacoes e relatorios
- unitarios novos: `src/lib/reproduction/__tests__/postPartum.test.ts`, `src/lib/animals/__tests__/familyOrder.test.ts`

## 5. Gaps consolidados

| TD | capability_id | Tipo | Status |
| --- | --- | --- | --- |
| TD-003 | `infra.rbac_hardening` | Restricao de DELETE por role | OPEN |
| TD-004 | `infra.indexes` | Indices compostos de performance | OPEN |
| TD-011 | `sanitario.registro` | Produtos sanitarios ainda em texto livre | OPEN |
| TD-015 | `pesagem.historico` | GMD/historico agregados no cliente | OPEN |
| TD-019 | `movimentacao.registro` | Foreign keys faltantes em movimentacao | OPEN |
| TD-020 | `reproducao.registro` | Foreign key faltante para `macho_id` | OPEN |

**Gap set atual**

- Catalogo: `TD-011`, `TD-015`, `TD-019`, `TD-020`
- Infra: `TD-003`, `TD-004`

## Veja Tambem

- [TECH_DEBT.md](./TECH_DEBT.md)
- [ROADMAP.md](./ROADMAP.md)
- [CURRENT_STATE.md](./CURRENT_STATE.md)
