# ACTIVE_PHASE_PLAN - Fase 12D4

**Status:** Fase 12D4 concluída como rebaseline conceitual documental — ProductClass, status e política de execução
**Foco:** Rebaseline conceitual das matrizes sanitárias v2
**Criado:** 2026-06-09
**Atualizado:** 2026-06-09
**Plano base:** 12D4 — Rebaseline conceitual das matrizes sanitárias v2: ProductClass, status curatorial e política de execução

---

## Objetivo em 1 parágrafo

Reestruturar os documentos curatoriais da Agenda Sanitária v2 para consolidar o modelo canônico com `ProductClass` como entidade central, separar `ProductClassDefaultRule` de `SanitaryProduct`, aplicar enums canônicos de `CurationStatus`, `AutomationStatus` e `ExecutionProductPolicy`, e corrigir a linguagem de bulas para produto-específica. A fase é documental — sem SQL, sem TS, sem Dexie, sem sync, sem UI, sem seed, sem agenda, sem evento, sem estoque, sem carência ativa.

---

## Decisão 12D4

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Implementação autorizada nesta subfase:

- reescrever matrizes curatoriais com modelo canônico ProductClass;
- aplicar enums canônicos de CurationStatus, AutomationStatus e ExecutionProductPolicy;
- separar ProductClass, ProductClassDefaultRule e SanitaryProduct nas matrizes;
- corrigir linguagem de bulas para produto-específica;
- criar relatório de rebaseline 12D4;
- atualizar README curatorial com modelo canônico;
- atualizar docs ativos de fase/status/decisão/domínio.

Implementação não autorizada nesta subfase:

- criar migration SQL ou alterar RLS;
- alterar Dexie/offline stores;
- alterar sync-batch;
- criar UI ou fluxo operacional;
- importar como seed ou carga final;
- criar agenda, fechar agenda, criar evento ou baixar estoque;
- calcular carência ativa ou declarar livre de carência;
- liberar venda, abate, aptidão, SISBOV, GTA, PNIB ou rastreabilidade animal;
- alterar contratos TypeScript 12D1/12D2.

---

## Evidência técnica

Arquivos gerados/reescritos:

- `docs/review/evidence/RELATORIO_REVISAO_12D4_PRODUCT_CLASS_E_STATUS.md` (novo);
- `docs/review/evidence/MATRIZ_PROTOCOLOS_SANITARIOS_CANDIDATOS_V2.md` (reescrito);
- `docs/review/evidence/MATRIZ_ITENS_PROTOCOLO_SANITARIO_V2.md` (reescrito);
- `docs/review/evidence/MATRIZ_PRODUTOS_SANITARIOS_CANDIDATOS_V2.md` (reescrito — separado em Seção A/B/C);
- `docs/review/evidence/MATRIZ_FONTES_TECNICAS_SANITARIAS_V2.md` (reescrito — critério de inclusão + linguagem produto-específica);
- `docs/review/evidence/README_CURADORIA_SANITARIA_V2.md` (reescrito — modelo canônico e enums).

---

## Critérios de aceite da fase

- [x] README curatorial atualizado com modelo `SanitaryProtocol -> ProductClass -> SanitaryProduct`.
- [x] Matriz de protocolos usa `SanitaryProtocol` como entidade final, não "candidato" como tipo.
- [x] Matriz de itens usa `ProductClass` como requisito do item (`product_class_key`).
- [x] Matriz de produtos/classes separa Seção A (ProductClass), B (ProductClassDefaultRule) e C (SanitaryProduct).
- [x] Matriz de fontes tem critério de inclusão explícito.
- [x] Bulas comerciais descritas como produto-específicas com `scope_note`.
- [x] `approved_for_seed` não é usado como status canônico.
- [x] `approved_for_catalog` é o status canônico de aprovação.
- [x] `requires_product_at_execution` saiu de `automation_status` e virou `ExecutionProductPolicy`.
- [x] `required_at_agenda` documentado como produto planejado, não executado.
- [x] `ProductClassDefaultRule` tem `can_validate_execution = false` explícito.
- [x] Carência não aparece em protocolo, item ou classe como regra final.
- [x] Produto executado continua sendo a fonte da carência.
- [x] Sem SQL.
- [x] Sem TypeScript.
- [x] Sem Dexie/sync/UI.
- [x] Docs ativos atualizados.

---

## Próxima fase segura

`12D5 — Schema/contratos ProductClass, defaults e memberships`

Escopo mínimo: migration expand-only criando `sanitario_product_classes_v2`, `sanitario_product_class_defaults_v2`, `sanitario_product_class_memberships_v2`; ajustar contratos TypeScript; validar snapshots; sem seed; sem UI; sem sync amplo.


---

## Decisão 12D3

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Implementação autorizada nesta subfase:

- extrair candidatos do guideline curatorial;
- criar matrizes revisáveis com status curatorial e de automação;
- declarar lacunas por campo e fonte necessária;
- atualizar docs ativos de fase/status/decisão/domínio.

Implementação não autorizada nesta subfase:

- criar migration SQL ou alterar RLS;
- alterar Dexie/offline stores;
- alterar sync-batch;
- criar UI ou fluxo operacional;
- importar guideline como seed ou carga final;
- criar agenda, fechar agenda, criar evento ou baixar estoque;
- calcular carência ativa ou declarar livre de carência;
- liberar venda, abate, aptidão, SISBOV, GTA, PNIB ou rastreabilidade animal;
- alterar contratos TypeScript 12D1/12D2.

---

## Evidência técnica

Arquivos gerados:

- `docs/review/evidence/MATRIZ_PROTOCOLOS_SANITARIOS_CANDIDATOS_V2.md`;
- `docs/review/evidence/MATRIZ_ITENS_PROTOCOLO_SANITARIO_V2.md`;
- `docs/review/evidence/MATRIZ_PRODUTOS_SANITARIOS_CANDIDATOS_V2.md`;
- `docs/review/evidence/MATRIZ_FONTES_TECNICAS_SANITARIAS_V2.md`;
- `docs/review/evidence/README_CURADORIA_SANITARIA_V2.md`.

Fontes consumidas:

- guideline curatorial Markdown localizado em `docs/review/evidence/Guideline_Atualizado_Vacinacao_Imunizacao_Controle_Parasitario_Bovinos_Bubalinos.md`;
- contratos v2 em `src/lib/sanitario/rules/*V2.ts`;
- plano canônico em `docs/review/PLANO_FASE_12D_MODELO_CANONICO_PROTOCOLO_SANITARIO_V2.md`;
- docs ativos de fase, status, decisão e domínio.

---

## Critérios de aceite da fase

- [x] Guideline usado como fonte curatorial, não automação.
- [x] Matriz de protocolos candidatos criada.
- [x] Matriz de itens versionáveis criada.
- [x] Matriz de produtos/classes candidatos criada.
- [x] Matriz de fontes técnicas criada.
- [x] README curatorial criado.
- [x] Cada linha tem status curatorial.
- [x] Cada linha tem status de automação.
- [x] Lacunas estão explícitas.
- [x] Nenhuma linha vira seed final.
- [x] Nenhuma linha gera agenda automática.
- [x] Nenhuma carência foi liberada sem fonte forte.
- [x] Bubalino não herdou bovino.
- [x] Itens experimentais/alerta ficaram bloqueados.
- [x] Docs ativos atualizados.
- [x] Nenhum código foi alterado.
- [x] Nenhum SQL foi alterado.
- [x] Nenhum sync/Dexie/UI foi alterado.

---

## Próxima fase segura

`12D4 — Revisão técnico-veterinária das matrizes curatoriais`

Escopo mínimo da próxima fase: revisar cada linha das matrizes com MV responsável, confirmar bulas e normas vigentes, elevar candidatos para `validated_for_review`, identificar protocolos prontos para seed controlado.
