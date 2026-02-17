# Relatório de Reconciliação — Governança de Eventos

Status: Derivado
Baseline: 0bb8829
Última Atualização: 2026-02-12
Derivado por: Antigravity Docs Update — Rev D

## 1. Baseline Integrity

Status: CLEAN
Commit: 0bb8829

## 2. Summary

- **Baseline analisado**: 0bb8829 (2026-02-12) abrangendo migrations até `0036`.
- **Documentos atualizados**:
  - `docs/review/RECONCILIACAO_REPORT.md` (novo)
  - `docs/MATRIZ_CANONICA_EVENTOS_SCHEMA.md` (revisão de baseline + hardening)
  - `docs/PLANO_UNIFICACAO_EVENTOS.md` (revisão de baseline + status implementado)
- **Deltas relevantes**:
  - Identificado hardening parcial (constraints `NOT VALID`) em financeiro, nutrição e movimentação (migrations `0023`-`0026`).
  - Identificada lógica de episódios reprodutivos em views (migration `0035`).
- **Riscos/Itens abertos**:
  1. Constraints de integridade (`check > 0`, FKs) estão marcadas como `NOT VALID` no banco, permitindo dados legados inconsistentes.
  2. `eventos_reproducao` possui lógica complexa em views (`vw_repro_episodios`) não refletida explicitamente na matriz canônica anterior.
  3. Divergência entre tipos TypeScript (`src/lib/offline/types.ts`) e schema do banco permanece.

## 3. Mudanças aplicadas

### 3.1 `docs/MATRIZ_CANONICA_EVENTOS_SCHEMA.md`
- **Atualização de Baseline**: De `0001` para `0036`.
- **Hardening Financeiro**: Adicionado constraint `check (valor_total > 0)` (not valid) e FK composta para contrapartes.
  - Evidência: `PM: supabase/migrations/0023_hardening_eventos_financeiro.sql` e `0026_fk_eventos_financeiro_contrapartes.sql`.
- **Hardening Nutrição**: Adicionado constraint `check (quantidade_kg > 0)` (not valid).
  - Evidência: `PM: supabase/migrations/0024_hardening_eventos_nutricao.sql`.
- **Hardening Movimentação**: Adicionado obrigatoriedade de destino e validação origem != destino.
  - Evidência: `PM: supabase/migrations/0025_hardening_eventos_movimentacao.sql`.
- **Views de Reprodução**: Documentada a existência de views auxiliares para cálculo de status.
  - Evidência: `PM: supabase/migrations/0035_reproducao_hardening_v1.sql`.

### 3.2 `docs/PLANO_UNIFICACAO_EVENTOS.md`
- **Status das Lacunas**: Movidos itens de "Divergências" para "Mitigado (Parcial)" referentes a validações básicas (valor > 0, destino obrigatório).
- **Refinamento do Plano**: Foco ajustado para validação estrita (`VALIDATE CONSTRAINT`) e migração para schema v2 (campos novos).

## 4. Deltas vs Normativos

### 4.1 Constraints `NOT VALID`
- **Claim Normativo Original**: Matriz anterior não citava essas constraints.
- **Evidência no Código**:
  ```sql
  alter table public.eventos_financeiro
    add constraint ck_evt_fin_valor_total_pos
    check (valor_total > 0)
    not valid;
  ```
  (Fonte: `supabase/migrations/0023_hardening_eventos_financeiro.sql`)
- **Impacto**: O schema é mais rígido para novos dados do que a documentação anterior sugeria, mas ainda permissivo para dados antigos.
- **Ação**: Atualizar Matriz para refletir existência da constraint com nota `(NOT VALID)`.

### 4.2 Views de Reprodução
- **Claim Normativo Original**: Apenas tabela `eventos_reproducao`.
- **Evidência no Código**: `create or replace view public.vw_repro_episodios ...` (`migrations/0035`).
- **Impacto**: Lógica de negócio (status reprodutivo) está no banco, não apenas no frontend/offline.
- **Ação**: Mencionar existência das views na seção de Reprodução da Matriz.

## 5. Data Contract Audit

| Item | Status | Evidência | Ação Sugerida |
|---|---|---|---|
| `valor_total > 0` | DRIFT (Mitigado) | `migrations/0023` | Marcar como existente (NOT VALID) na Matriz. |
| `quantidade_kg > 0` | DRIFT (Mitigado) | `migrations/0024` | Marcar como existente (NOT VALID) na Matriz. |
| `movimentacao` destino | DRIFT (Mitigado) | `migrations/0025` | Marcar como existente (NOT VALID) na Matriz. |
| `contraparte` FK | DRIFT (Mitigado) | `migrations/0026` | Marcar como existente (NOT VALID) na Matriz. |
| `types.ts` vs Schema | DRIFT | `src/lib/offline/types.ts` | Manter no Plano como P0 para correção. |

## 6. Comandos reproduzíveis usados

- `git status --porcelain` (verificação de integridade)
- `git rev-parse --short HEAD` (baseline)
- `ls supabase/migrations` (listagem de evidências)
- `cat supabase/migrations/0023_hardening_eventos_financeiro.sql` (leitura de evidência)
- `cat supabase/migrations/0024_hardening_eventos_nutricao.sql` (leitura de evidência)
- `cat supabase/migrations/0025_hardening_eventos_movimentacao.sql` (leitura de evidência)
- `cat supabase/migrations/0026_fk_eventos_financeiro_contrapartes.sql` (leitura de evidência)
- `cat supabase/migrations/0035_reproducao_hardening_v1.sql` (leitura de evidência)
