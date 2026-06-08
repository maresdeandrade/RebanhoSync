# ACTIVE_PHASE_PLAN - Fase 12D0

**Status:** Fase 12D0 documentada em escopo reduzido; sem SQL, Dexie, sync-batch, UI ou seed
**Foco:** Modelo canônico de Protocolo Sanitário v2, Produto e Fonte Técnica
**Criado:** 2026-06-07
**Atualizado:** 2026-06-07
**Plano base:** `docs/review/PLANO_FASE_12D_MODELO_CANONICO_PROTOCOLO_SANITARIO_V2.md`

---

## Objetivo em 1 parágrafo

Estabilizar o contrato canônico que alimentará a Agenda Sanitária v2 antes de qualquer offline/sync amplo. A 12D0 define fonte técnica, produto sanitário, carência, protocolo versionado, item versionado, bovino/bubalino, status de autorização, campos que exigem fonte forte e snapshots técnicos de agenda/evento. O guideline de vacinação, imunização e controle parasitário é usado como fonte curatorial e matriz de casos, não como seed final, protocolo automático ou autorização crítica.

---

## Decisão 12D0

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Implementação autorizada nesta subfase:

- criar plano técnico/documental da 12D0;
- registrar modelo canônico de produto, protocolo, fonte técnica, carência e snapshot;
- registrar matriz de fonte mínima por campo;
- registrar casos mínimos extraídos do guideline;
- atualizar docs vivos de fase/status/decisão.

Implementação não autorizada nesta subfase:

- migration SQL;
- alteração de Dexie;
- alteração de sync-batch;
- alteração de UI;
- seed/carga de produtos ou protocolos;
- criação de agenda, evento, estoque ou carência ativa.

---

## Evidência curatorial

Arquivo localizado:

- `docs/review/evidence/Guideline_Atualizado_Vacinacao_Imunizacao_Controle_Parasitario_Bovinos_Bubalinos.md`

Observação:

- O prompt citou um PDF homônimo, mas o workspace contém a versão Markdown. A 12D0 usa essa versão como fonte curatorial disponível e registra a inconsistência.

---

## Escopo permitido nesta subfase

- documentação de contrato;
- matriz de fonte forte;
- delimitação de schema futuro;
- delimitação de contrato TypeScript futuro;
- testes sentinela futuros.

## Escopo proibido nesta subfase

- importar guideline como seed;
- gerar agenda;
- criar evento;
- calcular carência ativa;
- liberar venda, abate ou aptidão operacional;
- alterar SQL, Dexie, sync-batch ou UI;
- automatizar item experimental;
- tratar uso bubalino extrapolado como autorizado.

---

## Critérios de aceite

- guideline usado como fonte de casos e curadoria, sem cópia integral;
- modelo canônico de produto definido;
- modelo canônico de protocolo definido;
- modelo canônico de fonte técnica definido;
- modelo canônico de carência definido;
- regra bovino/bubalino definida;
- regra para itens experimentais/alerta definida;
- snapshot técnico mínimo definido;
- separação clara entre estrutura e carga de dados;
- próxima fase delimitada antes de offline/sync.

---

## Próxima fase segura

12D1 — Migration/contrato persistido de produto, protocolo e fonte técnica.

Offline/sync da Agenda Sanitária v2 fica postergado para 12E ou fase equivalente após estabilização do contrato persistido de protocolo/produto/fonte.
