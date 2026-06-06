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

### Complemento 2026-06-06 — Agenda Sanitária v2 em core puro

A Fase 11.5 consolidou dedup lógico adicional em contratos TypeScript puros para:

* `agenda_intent`;
* `event_execution_intent`;
* `agenda_closure_intent`.

Esse dedup lógico ainda não é constraint final de banco e não deve ser documentado como persistência real sem migration/schema específica.

Regras v2:

* `previewGroupId` identifica o grupo operacional de preview;
* `sourceDemandKey` preserva a demanda agrupada de origem;
* `agenda_intent` deve considerar protocolo, item, `productId`, `productClass`, ação, lote, data, janela e animais ordenados;
* `event_execution_intent` deve considerar protocolo, item, `productId`, `productClass`, ação, lote, data/hora executada, animais executados e vínculo de agenda quando houver;
* `agenda_closure_intent` deve considerar versão lógica, agenda, tipo de fechamento, data/hora, evento quando houver e animais ordenados;
* `productName` e `loteName` são exibição e não podem compor identidade;
* `productId` e `productClass` precisam permanecer separados para evitar colisão semântica.

## Alternativas consideradas

- Manter templates livres no SQL: descartado por risco de drift semantico.
- Criar contrato novo fora de TS/SQL: descartado por custo maior e falta de necessidade para o ciclo atual.

## Consequencias

- `scopeType`, `scopeId`, `familyCode`, `itemCode`, `regimenVersion`, `periodMode` e `periodKey` sao campos obrigatorios do contrato.
- Dedup nao deve depender apenas de nome textual, ano isolado, dose solta ou template livre.
- Dedup v2 nao deve depender de `productName`, `loteName` ou labels mutaveis de UI.
- Dedup logico de core puro nao deve virar constraint de banco sem decisao explicita, auditoria do legado e migration validada.
- Golden tests devem falhar se TS e SQL divergirem.

## Evidencias e referencias

- `src/lib/sanitario/engine/dedup.ts`
- `supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql`
- `src/lib/sanitario/__tests__/dedup.test.ts`
- `src/lib/sanitario/__tests__/golden/sanitario_engine_parity.golden.test.ts`

## Plano de rollout

- Manter o contrato canonico nos testes de dedup e golden.
- Qualquer novo protocolo deve escolher `familyCode`, `itemCode`, `regimenVersion`, `periodMode` e `periodKey` explicitamente.
