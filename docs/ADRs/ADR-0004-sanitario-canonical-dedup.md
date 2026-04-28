# ADR-0004: Dedup Sanitario Canonico Estruturado

> **Status:** Accepted
> **Data:** 2026-04-27
> **Contexto:** Saneamento sanitario P0.3
> **Autores:** Codex + revisao tecnica

## Contexto

O dedup sanitario tinha duas formas ativas: TypeScript gerava chave estruturada e SQL renderizava templates livres. Essa divergencia podia gerar duplicidade, ausencia de agenda ou colisao semantica entre protocolo oficial, standard e custom.

## Decisao

O contrato canonico de dedup sanitario e estruturado:

```txt
sanitario:{scopeType}:{scopeId}:{familyCode}:{itemCode}:v{regimenVersion}:{periodMode}:{periodKey}
```

TypeScript gera esse contrato por `buildSanitaryDedupKey`. SQL deve gerar a mesma chave por funcao canonica equivalente, mantendo `render_dedup_key` apenas como wrapper compatibilizado quando existir no caminho ativo.

## Alternativas consideradas

- Manter templates livres no SQL: descartado por risco de drift semantico.
- Criar contrato novo fora de TS/SQL: descartado por custo maior e falta de necessidade para o ciclo atual.

## Consequencias

- `scopeType`, `scopeId`, `familyCode`, `itemCode`, `regimenVersion`, `periodMode` e `periodKey` sao campos obrigatorios do contrato.
- Dedup nao deve depender apenas de nome textual, ano isolado, dose solta ou template livre.
- Golden tests devem falhar se TS e SQL divergirem.

## Evidencias e referencias

- `src/lib/sanitario/engine/dedup.ts`
- `supabase/migrations/20260427090000_sanitario_canonical_dedup_contract.sql`
- `src/lib/sanitario/__tests__/dedup.test.ts`
- `src/lib/sanitario/__tests__/golden/sanitario_engine_parity.golden.test.ts`

## Plano de rollout

- Manter o contrato canonico nos testes de dedup e golden.
- Qualquer novo protocolo deve escolher `familyCode`, `itemCode`, `regimenVersion`, `periodMode` e `periodKey` explicitamente.
