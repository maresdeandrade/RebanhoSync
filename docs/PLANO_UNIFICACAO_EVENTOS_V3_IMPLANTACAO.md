# Plano V3 de Unificacao e Implantacao dos Eventos

Data: 2026-02-11
Base comparada:

1. Plano A: `docs/PLANO_UNIFICACAO_EVENTOS.md`
2. Plano B: `c:/Users/mares/Downloads/PLANO_UNIFICACAO_EVENTOS_v2.md`

## 1. Analise comparativa objetiva

### 1.1 Pontos fortes do Plano A (`docs/PLANO_UNIFICACAO_EVENTOS.md`)

1. Alta aderencia ao schema real (`0001_init.sql`, `0004_rls_hardening.sql`).
2. Cobertura forte de arquitetura de integracao, versionamento e migracao.
3. Boa governanca (seguranca, auditoria, rastreabilidade, rollout por fases).
4. Criterios de aceite e riscos mais completos.

### 1.2 Pontos fortes do Plano B (`PLANO_UNIFICACAO_EVENTOS_v2.md`)

1. Foco muito pratico em implementacao de cliente (factory unica, validators, tipos TS).
2. Escopo MVP bem direto para entregar rapido.
3. Boa clareza de fluxo offline-first no caminho UI -> Dexie -> sync-batch -> Postgres.
4. Propoe fases curtas com entrega funcional (factory, timeline, hardening).

### 1.3 Gaps tecnicos do Plano A

1. Menos prescritivo em tarefas de codigo no frontend.
2. Introduz componentes mais avancados cedo (ex.: outbox/pipeline), elevando risco de prazo.

### 1.4 Gaps tecnicos do Plano B

1. Mistura schema documentado com schema desejado em alguns pontos:
   1. `eventos_sanitario` aparece com `id` e campos extras, mas schema atual usa `evento_id` e payload para extensoes.
   2. `agenda_itens` cita `protocolo_item_id`, enquanto schema atual usa `protocol_item_version_id`.
   3. `agenda_itens.tipo` no schema atual e `not null`.
2. Menor detalhamento de migracao gradual v1/v2 e rollback.
3. Menor cobertura de observabilidade operacional no rollout.

### 1.5 Conclusao comparativa

1. O Plano A e mais robusto para governanca e implantacao segura.
2. O Plano B e melhor para acelerar a entrega de codigo no MVP.
3. O melhor caminho e um hibrido: executar MVP no estilo Plano B, com controles de migracao/seguranca do Plano A.

## 2. Diretrizes do Plano V3 (hibrido)

1. Schema-first: contrato TS deve espelhar o schema atual antes de qualquer extensao.
2. MVP orientado a fluxo real: unificar caminho de criacao para os 5 dominios.
3. Migracoes apenas aditivas no MVP.
4. Compatibilidade offline: manter cliente legado funcionando durante transicao.
5. Rollout por feature flag em nivel de fazenda.

Artefatos da Fase 0:

1. Matriz canonica: `docs/MATRIZ_CANONICA_EVENTOS_SCHEMA.md`
2. ADR de baseline: `docs/adr/ADR-001-unificacao-eventos-fase0.md`
3. Backlog detalhado Fase 1/2: `docs/TAREFAS_IMPLEMENTACAO_FASE1_FASE2_EVENTOS.md`

## 3. Plano V3 de implantacao (executavel)

## Fase 0 - Convergencia de baseline (Semana 1)

Objetivo: eliminar drift entre docs, tipos TS e schema.

Entregas:

1. Matriz canonica de campos por tabela (schema real).
2. Ajuste em `src/lib/offline/types.ts` para refletir 100% das colunas atuais.
3. ADR de unificacao (escopo MVP vs Pos-MVP).

Aceite:

1. Nenhum campo do schema sem representacao no tipo TS.
2. Nomenclatura unificada (`manager` em vez de `admin` no contexto de role).

## Fase 1 - Unificacao de escrita no cliente (Semanas 2-3)

Objetivo: todos os dominios criando eventos pelo mesmo caminho tecnico.

Entregas:

1. `src/lib/events/types.ts` com contratos canonicos por dominio.
2. `src/lib/events/validators/` com validacao comum + por dominio.
3. `src/lib/events/buildEventGesture.ts`:
   1. cria evento base + detalhe 1:1
   2. inclui operacoes compostas (movimentacao com update de animal)
   3. preenche metadados (`client_op_id`, `client_tx_id`, `client_recorded_at`)
4. Adaptacao das telas para usar o builder unificado.

Aceite:

1. `sanitario`, `pesagem`, `movimentacao`, `nutricao`, `financeiro` usam o mesmo pipeline de criacao.
2. Sem regressao no sync offline.

## Fase 2 - Hardening de banco e sync (Semanas 4-5)

Objetivo: elevar integridade sem quebrar compatibilidade.

Entregas (migracoes aditivas):

1. `check (valor_total > 0)` em `eventos_financeiro`.
2. Regra para `eventos_nutricao`: quantidade positiva quando preenchida.
3. Regras de movimentacao:
   1. destino obrigatorio (`to_lote_id` ou `to_pasto_id`)
   2. bloquear origem = destino
4. FK composta de `eventos_financeiro(contraparte_id, fazenda_id)` para `contrapartes(id, fazenda_id)` (ou regra equivalente de tenant-safe).
5. Padronizacao de `reason_code` no `sync-batch`.

Aceite:

1. Testes de integridade e anti-teleporte aprovados.
2. Rejeicoes retornando motivo consistente por campo/regra.

## Fase 3 - Leitura unificada e UX operacional (Semanas 6-7)

Objetivo: consolidar consumo do modelo unificado.

Entregas:

1. Tela `/eventos` funcional com filtros por dominio, animal, lote, periodo e status de sync.
2. Timeline unificada exibindo detalhes corretos por dominio.
3. Fluxo de rejeicoes locais com reprocessamento assistido.
4. Integracao agenda <-> evento por `source_task_id` e `source_evento_id`.

Aceite:

1. Operacao ponta a ponta: criar offline, sincronizar, visualizar timeline.
2. Agenda concluida gera vinculo rastreavel com evento.

## Fase 4 - Piloto e rollout geral (Semanas 8-10)

Objetivo: implantar com controle de risco.

Entregas:

1. Feature flags por fazenda para regras estritas.
2. Dashboards operacionais:
   1. taxa de sucesso do sync
   2. taxa de rejeicao por dominio/regra
   3. backlog de gestos pendentes
3. Runbook de rollback operacional.

Aceite:

1. >= 99% de sync sem erro no piloto.
2. Zero incidente de isolamento entre fazendas.
3. Rollout concluido com monitoracao ativa.

Implementacao de referencia:

1. Feature flags por fazenda:
   1. `supabase/functions/sync-batch/flags.ts`
   2. `supabase/functions/sync-batch/index.ts`
   3. `src/pages/EditarFazenda.tsx`
2. Dashboard operacional:
   1. `src/pages/Dashboard.tsx`
3. Runbook:
   1. `docs/RUNBOOK_ROLLBACK_EVENTOS_FASE4.md`
4. Checklist executavel de go-live:
   1. `docs/CHECKLIST_GO_LIVE_FASE4_EXECUTAVEL.md`
   2. `docs/sql/FASE4_GO_LIVE_QUERIES.sql`

## 4. Pos-MVP (arquitetura evolutiva)

Itens recomendados apos estabilizar MVP:

1. Envelope v2 em `eventos`:
   1. `schema_version`
   2. `correlation_id`
   3. `causation_id`
   4. `producer`
2. `eventos_outbox` para publicacao assincrona e integracoes externas.
3. Contratos JSON Schema versionados por dominio.
4. Normalizacoes adicionais (ex.: sanitario tipado alem do payload).

## 5. Matriz de decisao (o que entra no MVP)

Entra no MVP:

1. Factory unica de eventos.
2. Validadores unificados.
3. Hardening de constraints e FKs criticas.
4. Tela `/eventos` e timeline unificada.
5. Rollout com feature flag.

Nao entra no MVP:

1. Outbox distribuido completo.
2. Pipeline de processamento multi-estagio.
3. Mudancas estruturais grandes em todos os detalhes de dominio.

## 6. Backlog tecnico inicial (ordem de execucao)

1. Corrigir drift em `src/lib/offline/types.ts`.
2. Criar `src/lib/events/types.ts`.
3. Criar `src/lib/events/validators/common.ts`.
4. Criar `src/lib/events/validators/{sanitario,pesagem,movimentacao,nutricao,financeiro}.ts`.
5. Criar `src/lib/events/buildEventGesture.ts`.
6. Integrar builder em `src/pages/Registrar.tsx`.
7. Implementar UI minima para nutricao e financeiro em `src/pages/Registrar.tsx`.
8. Criar/ativar pagina `/eventos` com leitura unificada.
9. Aplicar migracoes de hardening no Supabase.
10. Cobrir com testes unitarios, integracao e E2E basico offline->online.

## 7. Riscos e mitigacoes (V3)

| Risco | Impacto | Mitigacao |
|---|---|---|
| Divergencia entre docs e schema | Alto | fase 0 obrigatoria + checklist schema->TS |
| Rejeicoes elevadas apos constraints | Alto | feature flag + rollout por dominio |
| Regressao no offline sync | Alto | testes E2E offline em cada fase |
| Prazo estourar por escopo amplo | Medio | separar MVP estrito e Pos-MVP |
