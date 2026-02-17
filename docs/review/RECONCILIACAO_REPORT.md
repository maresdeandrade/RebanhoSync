# Relatório de Reconciliação (Derivado)

- Status: Derivado
- Baseline: 0bb8829
- Última Atualização: 2024-03-24
- Derivado por: Antigravity Regen vNext Consolidado — Rev D
- Baseline Integrity: CLEAN

## 1. Summary

- **Capability Score:** 79% (15/19)
- **Tech Debt Open:** 0 (P0) | 0 (P1) | 4 (P2)
- **NEW (Proposed):** 0
- **Drift Detected:** None

## 2. Deltas vs Normativos
*(Nenhum delta normativo detectado)*

## 3. Falsos Negativos Evitados
*(Nenhum falso negativo crítico registrado nesta revisão)*

## 4. Capability Score
**Score Global:** 15 / 19 = **79%**

### Detalhamento por Domínio
- **Sanitario:** 2/3 (Historico generic)
- **Pesagem:** 1/2 (Historico generic)
- **Nutricao:** 1/2 (Historico generic)
- **Movimentacao:** 2/3 (Historico generic)
- **Reproducao:** 3/3
- **Financeiro:** 2/2
- **Agenda:** 4/4

*Nota: Estoque (Stock) em Nutrição é OUT-OF-SCOPE.*

## 5. Data Contract Audit

| Item | Resultado | Evidência (PM+Ref) | Ação sugerida |
| :--- | :---: | :--- | :--- |
| **Reason Codes** | ✅ OK | `supabase/functions/sync-batch/rules.ts` (Mapeia constraints para codes legíveis ex: `ANTI_TELEPORTE`) | Nenhuma |
| **Sync Ordering** | ✅ OK | `src/lib/offline/syncOrder.ts` (Garante Parent-First no Insert e Child-First no Delete) | Nenhuma |
| **Migrations Drift** | ✅ OK | `supabase/migrations` contém tabelas para todos os domínios listados | Nenhuma |

## 6. Normative Drift Queue
*(Nenhum patch proposto)*

## 7. NEW (Proposed)
*(Nenhuma capability nova detectada fora do catálogo)*

## 8. Comandos Reproduzíveis
Principais buscas realizadas:
- `grep -r "sanitario" src/pages src/components supabase/migrations`
- `grep -r "dedup_key" src`
- `grep -r "reason_code" supabase/functions`
- `grep -r "role" src`
