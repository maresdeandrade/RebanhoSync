# ACTIVE_PHASE_PLAN - Fase 12D3

**Status:** Fase 12D3 concluída como extração curatorial documental — matrizes revisáveis geradas
**Foco:** Extração curatorial de protocolos sanitários candidatos v2 para revisão
**Criado:** 2026-06-08
**Atualizado:** 2026-06-09
**Plano base:** 12D3 — Extração curatorial de protocolos sanitários candidatos v2 para revisão

---

## Objetivo em 1 parágrafo

Criar matrizes curatoriais revisáveis de protocolos sanitários candidatos v2, itens versionáveis candidatos, produtos/classes candidatos e fontes técnicas identificadas — sem seed, sem migration, sem código funcional, sem agenda automática e sem sync. O objetivo é gerar artefatos documentais para análise e validação humana antes de qualquer carga real em banco.

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
