# ACTIVE_PHASE_PLAN - Fase 12D5

**Status:** Fase 12D5 concluída como contratos TypeScript puros para ProductClass, ProductClassGroup e ExecutionProductPolicy.
**Foco:** Definição de contratos TS, guards, validadores e testes unitários.
**Criado:** 2026-06-10
**Atualizado:** 2026-06-10
**Plano base:** 12D5 — Contratos TypeScript de ProductClass, ProductClassGroup e ExecutionProductPolicy

---

## Objetivo em 1 parágrafo

Traduzir as decisões documentais da Fase 12D4 em contratos TypeScript puros, guards de tipo, funções validadoras e testes unitários sem persistência (sem SQL, RLS, Dexie, sync ou UI). Garantir que o validador de itens de protocolo e o versionamento semântico (`requiresNewProtocolItemVersionV2`) suportem de forma robusta e segura o novo campo estruturado `productRequirementRule`, prevenindo mismatches ou ausência de regras para grupos de classes.

---

## Decisão 12D5

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Implementação autorizada nesta fase:
- criar contratos TypeScript em `sanitaryProductClassV2.ts`;
- implementar validadores puros para regras de exigência, grupos de classes e classes técnicas;
- integrar o campo estruturado `productRequirementRule` no item de protocolo versionado;
- atualizar `requiresNewProtocolItemVersionV2` para incluir o novo campo no versionamento semântico;
- implementar testes de cobertura e regressão para o novo comportamento.

Implementação não autorizada nesta fase:
- criar migration SQL ou RLS;
- alterar Dexie/offline stores;
- alterar sync-batch;
- criar UI ou fluxos operacionais;
- alterar agenda real ou evento real.

---

## Evidência técnica

Arquivos gerados/alterados:
- `src/lib/sanitario/rules/sanitaryProductClassV2.ts` (novo)
- `src/lib/sanitario/rules/__tests__/sanitaryProductClassV2.test.ts` (novo)
- `src/lib/sanitario/rules/sanitaryProtocolV2.ts` (alterado)
- `src/lib/sanitario/rules/__tests__/sanitaryProtocolV2.test.ts` (alterado)

---

## Critérios de aceite da fase

- [x] Contratos de `ProductClassV2` e `ProductClassGroupV2` criados.
- [x] Enums `SanitaryCurationStatusV2`, `SanitaryAutomationStatusV2` e `ExecutionProductPolicyV2` definidos.
- [x] Union discriminada `SanitaryProductRequirementRuleV2` implementada.
- [x] Validador runtime bloqueia `fixed_by_protocol` em `product_class` e `product_class_group`.
- [x] Item de protocolo valida `productRequirementRule` quando presente.
- [x] Mismatch entre `productRequirementKind` e `productRequirementRule.kind` é bloqueado.
- [x] `productRequirementKind = product_class_group` exige `productRequirementRule` definido.
- [x] `requiresNewProtocolItemVersionV2` detecta alterações em `productRequirementRule`.
- [x] Suíte de testes com 100% de aprovação.
- [x] Sem SQL, RLS ou migrações físicas.
- [x] Sem Dexie/sync/UI.

---

## Próxima fase segura

`12D6 — Schema SQL, RLS e Tabelas no Banco de Dados para ProductClass`

Escopo mínimo da próxima fase: criar tabelas físicas no Supabase, habilitar RLS com isolamento por `fazenda_id` e preparar a persistência remota para a curadoria.
