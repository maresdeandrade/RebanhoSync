# ACTIVE_PHASE_PLAN - Fase 12D1

**Status:** Fase 12D1 executada em escopo reduzido com SQL/RLS e contratos TypeScript puros
**Foco:** Schema e contratos mínimos de Produto, Protocolo e Fonte Técnica v2
**Criado:** 2026-06-08
**Atualizado:** 2026-06-08
**Plano base:** 12D1 — Schema e contratos mínimos de Produto, Protocolo e Fonte Técnica v2

---

## Objetivo em 1 parágrafo

Persistir a fundação canônica mínima definida na 12D0 para fonte técnica, cobertura por campo, produto sanitário, autorização por espécie, dose/via, carência, protocolo sanitário v2 e item versionado. A fase estabiliza contratos TypeScript puros e snapshots técnicos mínimos antes de qualquer Dexie, sync-batch, UI, seed curatorial, agenda automática, evento, estoque, carência ativa, venda, abate ou rastreabilidade animal.

---

## Decisão 12D1

Decisão: `PROSSEGUIR COM ESCOPO REDUZIDO`.

Implementação autorizada nesta subfase:

- criar migration SQL nova em paralelo;
- criar enums, tabelas, constraints, índices, RLS, policies, grants e comentários v2;
- criar contratos TypeScript puros para fonte, produto, protocolo e snapshots;
- criar validadores mínimos e testes sentinela;
- atualizar docs vivos de fase/status/decisão/domínio.

Implementação não autorizada nesta subfase:

- alterar Dexie/offline stores;
- alterar sync-batch;
- criar UI ou fluxo operacional;
- importar guideline como seed;
- criar agenda, fechar agenda, criar evento ou baixar estoque;
- calcular carência ativa ou declarar livre de carência;
- liberar venda, abate, aptidão, SISBOV, GTA, PNIB ou rastreabilidade animal.

---

## Evidência técnica

Arquivos principais:

- `supabase/migrations/20260608090000_sanitario_protocol_product_source_v2.sql`;
- `src/lib/sanitario/rules/sanitarySourceV2.ts`;
- `src/lib/sanitario/rules/sanitaryProductV2.ts`;
- `src/lib/sanitario/rules/sanitaryProtocolV2.ts`;
- `src/lib/sanitario/rules/sanitarySnapshotsV2.ts`;
- `src/lib/sanitario/rules/__tests__/sanitarySourceV2.test.ts`;
- `src/lib/sanitario/rules/__tests__/sanitaryProductV2.test.ts`;
- `src/lib/sanitario/rules/__tests__/sanitaryProtocolV2.test.ts`;
- `src/lib/sanitario/rules/__tests__/sanitarySnapshotsV2.test.ts`.

Legados auditados com dependência ativa:

- `produtos_veterinarios`;
- `protocolos_sanitarios`;
- `protocolos_sanitarios_itens`;
- `catalogo_protocolos_oficiais`;
- `catalogo_protocolos_oficiais_itens`.

Decisão sobre legado nesta fase:

- não resetar;
- não limpar;
- não migrar UI/sync;
- marcar como operacional legado não-canônico em comentários SQL.

---

## Critérios de aceite da fase

- schema persistido v2 de fonte técnica criado;
- cobertura de fonte por campo criada;
- produto sanitário v2 criado;
- autorização por espécie criada;
- dose/via estruturada criada;
- carência por produto/contexto criada;
- protocolo sanitário v2 criado;
- item versionado de protocolo v2 criado;
- contratos TypeScript e validadores puros criados;
- snapshots técnicos mínimos tipados;
- testes sentinela implementados;
- guideline isolado não valida campo crítico;
- bubalino não herda autorização de bovino;
- carência zero exige fonte explícita;
- produto planejado não vira produto executado;
- Agenda permanece intenção;
- Evento permanece fato.

---

## Próxima fase segura

12D2 — Builders/adapters de snapshot técnico e ponte controlada com Agenda Sanitária v2.

Escopo mínimo da 12D2: criar builders puros para montar `AgendaTechnicalSnapshot` e `EventTechnicalSnapshot` a partir de produto/protocolo/fonte v2, sem Dexie/sync/UI amplo e sem criar evento por agenda.
