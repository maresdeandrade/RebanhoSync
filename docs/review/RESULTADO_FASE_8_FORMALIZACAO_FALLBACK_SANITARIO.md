# Resultado — Fase 8 Formalização Fallback Legado Sanitário

Atualizado em: 2026-06-02  
**Baseline Commit:** `3fe7a81`

## 1. Status

```txt
CONCLUÍDA LOCALMENTE
```

---

## 2. Objetivo

Formalizar o contrato mínimo do fallback legado sanitário para o scheduler, sem alterar regra sanitária crítica.

---

## 3. Arquivos alterados

| Arquivo | Motivo |
|---|---|
| `src/lib/sanitario/engine/nextOccurrenceService.ts` | Remover import incorreto de `legacyScheduler`, implementar adapter interno `tryLegacyCompatibleCompute` com contrato mínimo, tipos alinhados. |
| `src/lib/sanitario/__tests__/nextOccurrenceService.test.ts` | Refatorar fixture para contrato mínimo explícito, adicionar testes para campos obrigatórios ausentes, remover dependência de fixtures externos. |
| `src/components/sanitario/__tests__/FarmProtocolManager.test.tsx` | Adicionar Future Flag `v7_startTransition: true` ao wrapper de teste. |
| `src/pages/__tests__/PastosP2.test.tsx` | Adicionar Future Flags `v7_startTransition: true` ao wrapper de teste, corrigir import faltando. |

---

## 4. Contrato mínimo do fallback sanitário

### Shape mínimo esperado

Campos obrigatórios no `payload` para `parseLegacyProtocolItemToDomain`:

- `family_code` — identifica a família lógica do protocolo (ex: "brucelose", "raiva");
- `item_code` — identifica a etapa do item (ex: "dose_1", "dose_unica", "reforco_anual").

### Comportamento quando campo obrigatório ausente

- Quando `family_code` ausente: `parseLegacyProtocolItemToDomain` lança erro capturado;
- Quando `item_code` ausente: `parseLegacyProtocolItemToDomain` lança erro capturado;
- O wrapper `computeNextOccurrence` retorna `null` em caso de falha;
- `computeWithMetadata` retorna resultado com `error` definido.

### Testes cobrindo fallback

| Teste | Comportamento |
|---|---|
| `retorna null quando fazendaId ausente` | Valida guard defensivo de `fazendaId`. |
| `retorna null quando animalId ausente` | Valida guard defensivo de `animalId`. |
| `retorna resultado bloqueado quando payload faltando family_code` | Valida tratamento de campo obrigatório. |
| `retorna resultado bloqueado quando payload faltando item_code` | Valida tratamento de campo obrigatório. |

---

## 5. Validações executadas

| Comando | Resultado |
|---|---|
| `pnpm test -- src/lib/sanitario/__tests__/nextOccurrenceService.test.ts` | Passou (23 tests). |
| `pnpm test -- src/lib/sanitario` | Passou (63 arquivos, 645 tests). |
| `pnpm test -- --run` | Passou (259 arquivos, 1744 tests). |
| `pnpm run lint` | Passou. |
| `pnpm run build` | Passou com warnings conhecidos. |
| `git diff --check` | Passou. |

---

## 6. Próximas etapas

Pendências remanescentes em `docs/review/OPEN_REVIEW_ITEMS.md`:

1. Ruído residual em `stderr/stdout` de testes (P2).
2. Warnings conhecidos de build (P2).
3. Revisar Future Flags do React Router em wrappers de teste (P2) — **parcialmente abordado**.
4. Revisar avisos de Dialog/act em testes (P2).

---

## 7. Riscos

| Risco | Mitigação |
|---|---|
| `tryLegacyCompatibleCompute` pode degradar performance em lote | Adapter inofensivo - apenas usado quando nova feature flag falha; não altera regra. |
| Testes futuro podem precisar de ajuste adicional | Já alinhado para contrato mínimo; warnings reduzidos.