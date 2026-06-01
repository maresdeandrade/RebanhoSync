# ADR-0005: Boundary Registrar x Sanitario

> **Status:** Accepted
> **Data:** 2026-04-27
> **Contexto:** Saneamento sanitario P3-P5
> **Autores:** Codex + revisao tecnica

## Contexto

O `Registrar` concentrava montagem de payload, preflight, conhecimento de RPC/fallback e resolucao de pacote sanitario. Isso aumentava o risco de duplicar regra de dominio na UI e fragilizava o fluxo offline-first.

## Decisao

O `Registrar` deve permanecer como orquestrador de UI e fluxo. O dominio sanitario fornece contratos puros e boundaries:

- `resolveRegistrarSanitaryPackage`
- `buildSanitaryExecutionPayload`
- `validateSanitaryExecutionPreflight`
- `executeSanitaryCompletion`

Detalhes de dedup, calendario, scheduler, sequenciamento e materializacao nao devem ser decididos no `Registrar`.

## Alternativas consideradas

- Refatorar o controller inteiro: descartado nesta rodada por risco no caminho comum de finalizacao.
- Manter helpers legados acoplados ao engine: descartado onde havia extracao segura.

## Consequencias

- Imports diretos para `engine/*` no `Registrar` sao suspeitos e precisam de justificativa.
- Boundary RPC/fallback fica em `src/lib/sanitario/infrastructure/**`.
- Helpers visuais podem consumir descricoes, mas nao decidir materializacao.
- No estado pos-P5, `src/pages/Registrar/**` nao importa `@/lib/sanitario/engine/*`; labels visuais de calendario passam por `src/lib/sanitario/models/calendarDisplay.ts`.

## Evidencias e referencias

- `src/pages/Registrar/SANITARY_BOUNDARY.md`
- `src/lib/sanitario/models/executionPayload.ts`
- `src/lib/sanitario/models/executionPreflight.ts`
- `src/lib/sanitario/models/registrarPackage.ts`
- `src/lib/sanitario/infrastructure/executionBoundary.ts`

## Plano de rollout

- Nao mexer em `createRegistrarFinalizeController` sem evidencia de novo acoplamento.
- Saneamento estrutural do Registrar sanitario esta encerrado para esta rodada; novas frentes devem ser abertas separadamente.
