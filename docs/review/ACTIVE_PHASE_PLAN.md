# ACTIVE_PHASE_PLAN - Fase 12D2

**Status:** Fase 12D2 executada em escopo reduzido com builders/adapters puros
**Foco:** Snapshots técnicos e ponte controlada com Agenda Sanitária v2
**Criado:** 2026-06-08
**Atualizado:** 2026-06-08
**Plano base:** 12D2 — Builders/adapters de snapshot técnico e ponte controlada com Agenda Sanitária v2

---

## Objetivo em 1 parágrafo

Criar builders e adapters TypeScript puros para montar `AgendaTechnicalSnapshot`, `EventTechnicalSnapshot` e payload técnico futuro de `sanitario_agenda_v2` a partir dos contratos v2 de fonte, produto, carência, protocolo e item versionado. A fase não cria persistência, IO, Dexie, sync-batch, UI, seed, agenda, evento, estoque, carência ativa, venda, abate ou rastreabilidade animal.

---

## Decisão 12D2

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Implementação autorizada nesta subfase:

- criar builders puros de snapshot técnico;
- criar adapter puro para payload de `sanitario_agenda_v2.protocol_item_snapshot` e `produto_snapshot`;
- compor validações existentes da 12D1;
- normalizar fontes por `field_key`;
- criar testes sentinela dos builders/adapters;
- atualizar docs vivos de fase/status/decisão/domínio.

Implementação não autorizada nesta subfase:

- criar migration SQL ou alterar RLS;
- alterar Dexie/offline stores;
- alterar sync-batch;
- criar UI ou fluxo operacional;
- importar guideline como seed ou carga curatorial;
- criar agenda, fechar agenda, criar evento ou baixar estoque;
- calcular carência ativa ou declarar livre de carência;
- liberar venda, abate, aptidão, SISBOV, GTA, PNIB ou rastreabilidade animal.

---

## Evidência técnica

Arquivos principais:

- `src/lib/sanitario/rules/sanitarySnapshotBuildersV2.ts`;
- `src/lib/sanitario/rules/sanitaryAgendaBridgeV2.ts`;
- `src/lib/sanitario/rules/__tests__/sanitarySnapshotBuildersV2.test.ts`;
- `src/lib/sanitario/rules/__tests__/sanitaryAgendaBridgeV2.test.ts`.

Base consumida da 12D1:

- contratos `SanitarySourceRefV2`, `SanitaryProductV2`, `WithdrawalRuleV2`, `SanitaryProtocolV2`, `SanitaryProtocolItemVersionV2`, `AgendaTechnicalSnapshot` e `EventTechnicalSnapshot`;
- validadores de fonte forte por campo, produto, espécie, dose/via, carência, protocolo, item versionado e snapshots.

---

## Critérios de aceite da fase

- `buildAgendaTechnicalSnapshotV2` criado;
- `buildEventTechnicalSnapshotV2` criado;
- adapter puro para payload de `sanitario_agenda_v2` criado;
- snapshot de agenda não carrega carência ativa;
- snapshot de evento exige produto executado;
- produto planejado não vira produto executado;
- guideline isolado não valida campo crítico;
- fonte forte precisa cobrir `field_key`;
- bubalino não herda autorização de bovino;
- carência zero exige fonte explícita;
- carência `unknown` e `not_permitted` bloqueiam leitura/liberação;
- Agenda permanece intenção;
- Evento permanece fato.

---

## Próxima fase segura

12E — Integração offline/sync da Agenda Sanitária v2 usando contrato canônico, ou 12D3 se for necessário revisar builders antes da integração.

Escopo mínimo da próxima fase: mapear `agenda_intent`, payloads offline e handlers de sync para consumir snapshots já estabilizados, sem transformar agenda em histórico nem criar evento por fechamento administrativo.
