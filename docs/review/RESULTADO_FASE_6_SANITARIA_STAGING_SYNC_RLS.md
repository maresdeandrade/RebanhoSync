# Resultado - Fase 6 Sanitaria em Staging + RLS/Multi-tenant + Sync/Replay

Atualizado em: 2026-06-02
**Baseline Commit:** `32d7779`

## 1. Fonte de continuidade

- `.agents/prompts/codex/EXECUTE_PHASE_FROM_HANDOFF.md`
- `.agents/prompts/codex/SELF_UPDATE_CONTINUITY.md`
- `docs/review/FASE_6_SANITARIA_STAGING_SYNC_RLS_HANDOFF.md`
- `docs/context/PROJECT_STATUS.md`

## 2. Resumo do que foi validado

A Fase 6 foi executada no escopo sanitario, estoque, sociedade, sync/replay e RLS/multi-tenant.

Validado:

- correcao sanitaria continua append-only;
- replay do mesmo payload corretivo preserva `eventId` por `idempotency_key`;
- evento original nao recebe `UPDATE eventos`;
- payload corretivo sanitario tem contrato minimo formalizado no builder;
- payload corretivo legado permanece aceito como `partial`, com limitacoes explicitas;
- sociedade pecuaria permanece vinculo patrimonial;
- sociedade nao gera evento sanitario, conformidade, financeiro automatico ou `finance_transactions`;
- estoque sanitario e custo legado continuam cobertos por testes de inventory;
- RLS/multi-tenant foi ampliado e validado no baseline funcional Supabase para sanitario, estoque e sociedade.

Nao houve alteracao em migrations, schema, policies RLS, RPCs ou edge functions. Houve alteracao no script de validacao Supabase.

## 3. Arquivos alterados

| Arquivo | Motivo |
|---|---|
| `src/lib/sanitario/reconciliation/sanitaryCorrections.ts` | Formalizar payload corretivo, idempotencia deterministica e compatibilidade parcial para payload legado. |
| `src/lib/sanitario/reconciliation/__tests__/sanitaryCorrections.test.ts` | Cobrir contrato completo, replay/idempotencia e legado parcial. |
| `src/pages/Registrar/__tests__/sociedadePecuaria.effect.test.ts` | Validar que sociedade nao gera sanitario, conformidade ou financeiro automatico. |
| `scripts/codex/validate-supabase-baseline-functional.mjs` | Ampliar baseline funcional Supabase para sanitario, estoque e sociedade sob RLS. |
| `docs/review/RESULTADO_FASE_6_SANITARIA_STAGING_SYNC_RLS.md` | Registrar resultado da fase. |
| `docs/review/LAST_PHASE_RESULT.md` | Atualizar continuidade com ultimo resultado. |
| `docs/review/CURRENT_PHASE_HANDOFF.md` | Gerar handoff curto para a proxima etapa. |
| `docs/review/OPEN_REVIEW_ITEMS.md` | Registrar pendencia real da suite global. |
| `docs/context/PROJECT_STATUS.md` | Registrar fatos validados da fase. |

## 4. Testes criados ou ajustados

| Teste | Cobertura |
|---|---|
| `sanitaryCorrections.test.ts` | Payload corretivo completo, `fazenda_id`, snapshot original, contrato completo e legado parcial. |
| `sanitaryCorrections.test.ts` | Replay do mesmo payload sem duplicar evento e sem editar evento original. |
| `sociedadePecuaria.effect.test.ts` | Sociedade patrimonial sem efeitos colaterais sanitario/conformidade/financeiro. |
| `validate-supabase-baseline-functional.mjs` | Owner, manager, cowboy e outsider para eventos sanitarios, movimentacoes de insumo e sociedade. |

## 5. Validacao sanitaria

Resultado validado por testes focados:

- evento corretivo cria novo evento vinculado por `corrige_evento_id`;
- `payload_original_snapshot` fica preservado;
- `fazenda_id` entra no payload;
- `idempotency_key` estabiliza replay;
- payload legado sem campos novos fica `partial`, sem inferencia critica.

## 6. Validacao sync/retry/replay

Replay local do payload corretivo foi validado por teste deterministico:

- mesmo `idempotency_key` gera mesmo `eventId`;
- comando nao emite `UPDATE eventos`;
- evento original permanece preservado;
- novo evento corretivo permanece append-only.

## 7. Validacao RLS/multi-tenant

O baseline funcional Supabase passou com o novo bloco:

```json
{
  "sanitary_inventory_sociedade_rls": "passou"
}
```

Cobertura adicionada:

- owner cria e le dados da fazenda;
- manager le detalhes sanitarios, estoque e sociedade;
- cowboy le detalhes sanitarios, estoque e sociedade, mas nao cria sociedade;
- outsider nao le eventos sanitarios, movimentacoes de insumo, sociedades ou vinculos sociedade-animal.

## 8. Validacao sociedade

Sociedade foi mantida como vinculo patrimonial.

Validado que operacoes de sociedade nao criam:

- `eventos_sanitario`;
- `eventos_financeiro`;
- `finance_transactions`;
- dominios `sanitario`, `conformidade` ou `financeiro`.

## 9. Validacao custo/snapshot

Sem alteracao de motor comercial.

O comportamento existente de estoque/custo foi preservado e validado por `pnpm test -- src/lib/inventory`. Lote legado sem custo segue tratado como informacao ausente/parcial nos contratos existentes, sem recalculo retroativo automatico.

## 10. Comandos executados

| Comando | Resultado |
|---|---|
| `pnpm test -- src/lib/sanitario/reconciliation/__tests__/sanitaryCorrections.test.ts` | Passou: 9 testes. |
| `pnpm test -- src/pages/Registrar/__tests__/sociedadePecuaria.effect.test.ts` | Passou: 16 testes. |
| `node --check scripts/codex/validate-supabase-baseline-functional.mjs` | Passou. |
| `pnpm test -- src/lib/sanitario` | Passou: 644 testes. |
| `pnpm test -- src/lib/inventory` | Passou: 49 testes. |
| `pnpm test -- src/lib/events` | Passou: 79 testes. |
| `pnpm test -- src/lib/comercial` | Passou: 22 testes. |
| `pnpm test -- src/pages/Registrar` | Passou: 208 testes. |
| `pnpm run lint` | Passou. |
| `pnpm run build` | Passou, com avisos existentes de Browserslist e chunks grandes. |
| `node scripts/codex/validate-supabase-baseline-functional.mjs` | Passou, incluindo RLS sanitario/estoque/sociedade. |
| `pnpm test -- --run` | Falhou em testes amplos de UI fora do patch: `OnboardingInicial.e2e.test.tsx`, `Relatorios.e2e.test.tsx` e `PastosP2.test.tsx`. |

## 11. Pendencias remanescentes

- Regularizar a suite global antes de declarar gate global verde.
- Investigar falhas amplas de UI em onboarding, relatorios e pastos.
- Manter validacao Supabase funcional como gate obrigatorio para proximas mudancas que toquem RLS, sync, schema ou scripts Supabase.

## 12. Proximo passo recomendado

Corrigir ou isolar as falhas existentes de `pnpm test -- --run` sem expandir escopo para venda, abate, DRE, ROI, custo por arroba ou motor comercial.
