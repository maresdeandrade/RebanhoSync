# Current Phase Handoff - RebanhoSync

Atualizado em: 2026-06-02
**Baseline Commit:** `32d7779`

## 1. Estado consolidado

A Fase 6 sanitaria foi executada e a pendencia posterior da suite global foi regularizada.

Consolidado:

- correcao sanitaria append-only validada;
- replay corretivo com `idempotency_key` deterministico validado;
- evento original preservado;
- payload corretivo minimo formalizado no builder;
- payload legado tratado como `partial`, com limitacoes explicitas;
- sociedade validada como vinculo patrimonial sem efeitos automaticos sanitario/conformidade/financeiro;
- baseline funcional Supabase passou com RLS para sanitario, estoque e sociedade;
- suite global `pnpm test -- --run` passou;
- lint e build passaram;
- Vitest usa `maxWorkers: 2` para estabilizar execucao global local.

Nao houve alteracao em migrations, schema, policies RLS, RPCs ou edge functions.

## 2. O que nao deve ser refeito

Nao refazer sem regressao comprovada:

- contrato de payload corretivo sanitario implementado em `sanitaryCorrections.ts`;
- testes focados de replay/idempotencia corretiva;
- teste de isolamento patrimonial da sociedade no Registrar;
- ampliacao do baseline Supabase para sanitario, estoque e sociedade;
- validacoes focadas de `src/lib/sanitario`, `src/lib/inventory`, `src/lib/events`, `src/lib/comercial` e `src/pages/Registrar`.

## 3. Pendencias abertas

Nenhuma pendencia tecnica nova foi aberta nesta continuidade.

## 4. Escopo permitido

Permitido na proxima etapa:

- executar nova fase somente se explicitamente aprovada;
- preservar os contratos sanitarios e patrimoniais ja validados;
- reexecutar validações focadas quando arquivo tocado exigir.

## 5. Escopo proibido

Nao avancar sem autorizacao explicita para:

- venda;
- abate;
- DRE;
- ROI;
- custo por arroba;
- motor comercial avancado;
- aptidao automatica para venda ou abate;
- carencia liberatoria.

## 6. Areas candidatas

Sem area candidata obrigatoria nesta continuidade.

## 7. Validacao obrigatoria

Minimo:

- teste especifico dos arquivos alterados;
- `pnpm test -- --run` para mudancas que afetem suite global, runner ou UI ampla;
- `pnpm run lint`;
- `pnpm run build` se houver alteracao de runtime.

Se tocar Supabase, sync, schema, RLS, RPC ou scripts Supabase:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

## 8. Criterios de aceite

- Nova fase definida explicitamente pelo usuario.
- Nenhum contrato da Fase 6 regredido.
- Nenhum avanco para escopo comercial proibido.
- Continuidade atualizada ao final.
