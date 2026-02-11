   # Plano Tecnico de Unificacao e Implantacao dos Fluxos de Eventos

Data: 2026-02-11
Escopo: dominios `sanitario`, `pesagem`, `movimentacao`, `nutricao`, `financeiro` e `agenda`.

## 1. Objetivo

Unificar o modelo de eventos para:

1. Padronizar contratos de dados, validacoes e tipagens.
2. Fechar lacunas de integridade entre os dominios.
3. Implantar fluxo consistente de captura, sincronizacao, processamento e propagacao.
4. Garantir rastreabilidade auditavel ponta a ponta.

## 2. Baseline analisada

Fontes principais:

1. `docs/ANALISE_EVENTOS_FINANCEIRO.md`
2. `docs/ANALISE_EVENTOS_SANITARIOS.md`
3. `docs/ANALISE_EVENTOS_PESAGEM.md`
4. `docs/ANALISE_EVENTOS_MOVIMENTACAO.md`
5. `docs/ANALISE_EVENTOS_NUTRICAO.md`
6. `docs/EVENTOS_AGENDA_SPEC.md`
7. `supabase/migrations/0001_init.sql`
8. `supabase/migrations/0004_rls_hardening.sql`
9. `supabase/functions/sync-batch/index.ts`
10. `src/lib/offline/types.ts`
11. `src/lib/offline/tableMap.ts`
12. `src/lib/offline/syncWorker.ts`

## 3. Mapeamento completo atual

### 3.1 Estrutura comum (envelope) - `eventos`

Todos os tipos de evento herdam esta estrutura.

| Campo | Tipo | Obrigatorio | Validacao atual | Relacionamento |
|---|---|---|---|---|
| `id` | uuid | Sim | PK | - |
| `fazenda_id` | uuid | Sim | not null | FK `fazendas(id)` |
| `dominio` | `dominio_enum` | Sim | enum | - |
| `occurred_at` | timestamptz | Sim | not null | - |
| `occurred_on` | date (generated) | Sim | derivado de `occurred_at` | - |
| `animal_id` | uuid | Nao | opcional | FK composta `animais(id,fazenda_id)` |
| `lote_id` | uuid | Nao | opcional | FK composta `lotes(id,fazenda_id)` |
| `source_task_id` | uuid | Nao | opcional | referencia agenda |
| `source_tx_id` | uuid | Nao | opcional | rastreabilidade tecnica |
| `source_client_op_id` | uuid | Nao | opcional | rastreabilidade tecnica |
| `corrige_evento_id` | uuid | Nao | opcional | self-FK logica |
| `observacoes` | text | Nao | opcional | - |
| `payload` | jsonb | Sim | default `{}` | - |
| `client_id` | text | Sim | not null | id origem |
| `client_op_id` | uuid | Sim | idempotencia | chave tecnica |
| `client_tx_id` | uuid | Nao | agrupador transacao | chave tecnica |
| `client_recorded_at` | timestamptz | Sim | not null | - |
| `server_received_at` | timestamptz | Sim | default `now()` | - |
| `deleted_at` | timestamptz | Nao | soft delete | - |
| `created_at` | timestamptz | Sim | default `now()` | - |
| `updated_at` | timestamptz | Sim | default `now()` | - |

Regras globais:

1. Trigger `prevent_business_update` (append-only de negocio).
2. RLS por `has_membership(fazenda_id)` para leitura e insercao.
3. Correcao por novo evento (`corrige_evento_id`), sem update de negocio.

### 3.2 Estruturas por dominio (tabelas de detalhe 1:1)

Todos os detalhes possuem:

1. `evento_id` (PK, FK para `eventos(id,fazenda_id)`).
2. `fazenda_id`.
3. `payload`.
4. metadados de sync (`client_*`, `server_received_at`).
5. `deleted_at`, `created_at`, `updated_at`.
6. trigger append-only.

#### 3.2.1 Sanitario - `eventos_sanitario`

| Campo | Tipo | Obrigatorio | Validacao atual | Relacionamento |
|---|---|---|---|---|
| `evento_id` | uuid | Sim | PK | FK `eventos(id,fazenda_id)` |
| `fazenda_id` | uuid | Sim | not null | tenant |
| `tipo` | `sanitario_tipo_enum` | Sim | enum (`vacinacao`,`vermifugacao`,`medicamento`) | - |
| `produto` | text | Sim | not null | - |
| `payload` | jsonb | Sim | default `{}` | extensao de dominio |
| metadados sync/sistema | diversos | Sim/Opcional | padrao | - |

Observacao: os documentos de analise citam campos extras (fabricante, dose, via, lote etc.) que hoje nao estao tipados no schema principal e devem ser tratados via `payload` ate padronizacao v2.

#### 3.2.2 Pesagem - `eventos_pesagem`

| Campo | Tipo | Obrigatorio | Validacao atual | Relacionamento |
|---|---|---|---|---|
| `evento_id` | uuid | Sim | PK | FK `eventos(id,fazenda_id)` |
| `fazenda_id` | uuid | Sim | not null | tenant |
| `peso_kg` | numeric(10,2) | Sim | `check (peso_kg > 0)` | - |
| `payload` | jsonb | Sim | default `{}` | extensao de dominio |
| metadados sync/sistema | diversos | Sim/Opcional | padrao | - |

#### 3.2.3 Movimentacao - `eventos_movimentacao`

| Campo | Tipo | Obrigatorio | Validacao atual | Relacionamento |
|---|---|---|---|---|
| `evento_id` | uuid | Sim | PK | FK `eventos(id,fazenda_id)` |
| `fazenda_id` | uuid | Sim | not null | tenant |
| `from_lote_id` | uuid | Nao | sem check | sem FK dedicada na tabela de detalhe |
| `to_lote_id` | uuid | Nao | sem check | sem FK dedicada na tabela de detalhe |
| `from_pasto_id` | uuid | Nao | sem check | sem FK dedicada na tabela de detalhe |
| `to_pasto_id` | uuid | Nao | sem check | sem FK dedicada na tabela de detalhe |
| `payload` | jsonb | Sim | default `{}` | extensao de dominio |
| metadados sync/sistema | diversos | Sim/Opcional | padrao | - |

Regra de integridade relevante:

1. `sync-batch` aplica pre-validacao anti-teleporte: `UPDATE animais.lote_id` so e aceito quando existe `eventos` de `movimentacao` + `eventos_movimentacao` correlato no mesmo `client_tx_id`.

#### 3.2.4 Nutricao - `eventos_nutricao`

| Campo | Tipo | Obrigatorio | Validacao atual | Relacionamento |
|---|---|---|---|---|
| `evento_id` | uuid | Sim | PK | FK `eventos(id,fazenda_id)` |
| `fazenda_id` | uuid | Sim | not null | tenant |
| `alimento_nome` | text | Nao | sem check | - |
| `quantidade_kg` | numeric(12,3) | Nao | sem check | - |
| `payload` | jsonb | Sim | default `{}` | extensao de dominio |
| metadados sync/sistema | diversos | Sim/Opcional | padrao | - |

#### 3.2.5 Financeiro - `eventos_financeiro`

| Campo | Tipo | Obrigatorio | Validacao atual | Relacionamento |
|---|---|---|---|---|
| `evento_id` | uuid | Sim | PK | FK `eventos(id,fazenda_id)` |
| `fazenda_id` | uuid | Sim | not null | tenant |
| `tipo` | `financeiro_tipo_enum` | Sim | enum (`compra`,`venda`) | - |
| `valor_total` | numeric(14,2) | Sim | not null, sem `check > 0` | - |
| `contraparte_id` | uuid | Nao | opcional | sem FK explicita no detalhe |
| `payload` | jsonb | Sim | default `{}` | extensao de dominio |
| metadados sync/sistema | diversos | Sim/Opcional | padrao | - |

### 3.3 Estrutura de agenda e protocolos (rail mutavel)

#### 3.3.1 Agenda - `agenda_itens`

| Campo | Tipo | Obrigatorio | Validacao atual | Relacionamento |
|---|---|---|---|---|
| `id` | uuid | Sim | PK | - |
| `fazenda_id` | uuid | Sim | not null | FK `fazendas(id)` |
| `dominio` | `dominio_enum` | Sim | enum | - |
| `tipo` | text | Sim | not null | - |
| `status` | `agenda_status_enum` | Sim | default `agendado` | - |
| `data_prevista` | date | Sim | not null | - |
| `animal_id` | uuid | Nao | `ck_agenda_alvo` | FK composta `animais(id,fazenda_id)` |
| `lote_id` | uuid | Nao | `ck_agenda_alvo` | FK composta `lotes(id,fazenda_id)` |
| `dedup_key` | text | Nao | obrigatoria quando `source_kind=automatico` | unique parcial ativo |
| `source_kind` | `agenda_source_kind_enum` | Sim | default `manual` | - |
| `source_ref` | jsonb | Nao | opcional | - |
| `source_client_op_id` | uuid | Nao | opcional | trilha tecnica |
| `source_tx_id` | uuid | Nao | opcional | trilha tecnica |
| `source_evento_id` | uuid | Nao | opcional | referencia evento de conclusao |
| `protocol_item_version_id` | uuid | Nao | opcional | referencia protocolo/versao |
| `interval_days_applied` | int | Nao | opcional | agenda automatica |
| `payload` | jsonb | Sim | default `{}` | extensao |
| metadados sync/sistema | diversos | Sim/Opcional | padrao | - |

## 4. Padroes comuns e divergencias

### 4.1 Padroes comuns identificados

1. Two Rails: `eventos` append-only + `agenda_itens` mutavel.
2. Modelo de detalhe 1:1 por dominio.
3. Metadados de sync em todas as tabelas (`client_*`, `server_received_at`).
4. Multi-tenant por `fazenda_id` + RLS por membership.
5. Correcao historica por novo evento, sem sobrescrita.

### 4.2 Divergencias e lacunas

1. Cobertura de UI desigual: `sanitario/pesagem/movimentacao` ativos; `nutricao/financeiro` sem fluxo completo em tela.
2. Validacoes assimetricas: `peso_kg > 0` existe; `valor_total`, `quantidade_kg` e campos de movimentacao sem checks equivalentes.
3. Integridade referencial incompleta: `contraparte_id` e campos de origem/destino de movimentacao sem FK dedicada no detalhe.
4. Heterogeneidade semantica: parte dos atributos sanitarios aparece nos documentos, mas no schema atual esta concentrada no `payload`.
5. Contratos de tipos com drift: `src/lib/offline/types.ts` nao reflete 100% das colunas de `eventos` (ex.: `source_tx_id`, `source_client_op_id`) e omite `server_received_at` em `EventoFinanceiro`.
6. Nomenclatura de papeis inconsistente na documentacao (`admin` vs `manager`).

## 5. Modelo unificado v2 (proposta)

### 5.1 Principios

1. Preservar append-only e idempotencia.
2. Padronizar contratos sem quebrar sync offline existente.
3. Tipar campos de alto valor analitico/auditoria; manter extensoes em `payload`.
4. Migrar por estrategia expand-migrate-contract.

### 5.2 Evolucao de schema proposta

#### 5.2.1 Campos novos no envelope `eventos`

| Campo novo | Tipo | Objetivo |
|---|---|---|
| `tipo` | text | subtipo canonico dentro do dominio |
| `schema_version` | int | versao do contrato (v1, v2...) |
| `correlation_id` | uuid | rastrear fluxo de negocio ponta a ponta |
| `causation_id` | uuid | evento/acao que originou o atual |
| `composite_root_id` | uuid | encadear eventos compostos |
| `producer` | text | origem (`ui`, `import`, `integration`) |

#### 5.2.2 Regras minimas por dominio (v2)

| Dominio | Regras obrigatorias v2 |
|---|---|
| `sanitario` | `tipo`, `produto` obrigatorios; `payload` com schema versionado para dose, via, lote e validade |
| `pesagem` | manter `peso_kg > 0`; incluir faixa plausivel por categoria no backend |
| `movimentacao` | exigir `to_lote_id` ou `to_pasto_id`; bloquear origem=destino; manter anti-teleporte |
| `nutricao` | exigir `alimento_nome` e `quantidade_kg > 0`; unidade padrao em payload (`kg`,`g`,`l`) |
| `financeiro` | exigir `valor_total > 0`; `contraparte_id` obrigatoria quando `tipo in ('compra','venda')` |

#### 5.2.3 Eventos compostos

Padrao: um `composite_root_id` por operacao multi-entidade.

1. `movimentacao_com_estado`: `eventos` + `eventos_movimentacao` + `UPDATE animais`.
2. `execucao_agenda`: mudanca `agenda_itens.status` + evento(s) de execucao vinculados.
3. `sanitario_com_custo`: evento sanitario + evento financeiro associado por `correlation_id`.
4. `nutricao_com_custo`: evento nutricao + evento financeiro associado por `correlation_id`.

### 5.3 Estados e transicoes

#### 5.3.1 Estados de evento (processamento)

Implementar em tabela tecnica `eventos_pipeline` (nao no evento de negocio):

1. `capturado` -> `validado` -> `persistido` -> `publicado`.
2. `capturado` -> `rejeitado` (erro de regra ou contrato).
3. `persistido` -> `corrigido` (quando houver evento com `corrige_evento_id`).

#### 5.3.2 Estados de agenda

Manter `agendado`, `concluido`, `cancelado`, com guardas:

1. `agendado -> concluido`: requer `source_evento_id` ou justificativa tecnica.
2. `agendado -> cancelado`: requer justificativa em `observacoes`.
3. Bloquear reabertura sem evento de replanejamento explicito.

## 6. Arquitetura de integracao

### 6.1 Fluxo alvo

1. Captura (UI/importacao/API) -> `queue_gestures` / `queue_ops` (offline-first).
2. Ingestao (`sync-batch`) com validacao:
   1. membership/RLS
   2. contrato por dominio
   3. anti-teleporte e dedup
3. Persistencia atomica no rail de eventos/agenda.
4. Escrita em outbox (`eventos_outbox`) no mesmo commit.
5. Dispatcher assincro publica para:
   1. projections internas (timeline, dashboards, relatorios)
   2. integracoes externas (ERP, BI, webhooks)
6. Consumo idempotente por `event_id` + `schema_version`.

### 6.2 Componentes tecnicos

1. `sync-batch` v2 com validadores por dominio.
2. `eventos_outbox` com status (`pending`,`sent`,`failed`) e retry exponencial.
3. `vw_eventos_unificados` para leitura padronizada cross-dominio.
4. `schema registry` simples (JSON Schema versionado em repositorio).
5. Projecoes denormalizadas para consulta operacional (`timeline`, `agenda`, `financeiro`).

### 6.3 Propagacao entre sistemas

1. Interno: leitura direta no Postgres + views/materialized views.
2. Externo: webhook assinado/HMAC e lote por janela temporal.
3. Observabilidade: metricas de latencia, rejeicao e lag de outbox.

## 7. Versionamento e migracao de dados

### 7.1 Estrategia de versionamento

1. Banco: migrations sequenciais (`00xx`) com compatibilidade backward.
2. Contratos de evento: `schema_version` inteiro no envelope.
3. API sync: header ou campo `contract_version` (default v1, novo v2).

### 7.2 Plano de migracao (expand-migrate-contract)

#### Fase A - Expandir

1. Adicionar colunas novas (`tipo`,`schema_version`,`correlation_id`, etc.) nullable.
2. Criar constraints novas como `NOT VALID`.
3. Criar `eventos_outbox` e `eventos_pipeline`.

#### Fase B - Migrar

1. Backfill por dominio:
   1. `schema_version=1` para legado.
   2. gerar `tipo` por regra de dominio.
   3. popular `correlation_id/composite_root_id` quando inferivel.
2. Adequar dados inconsistentes (`valor_total<=0`, `quantidade_kg<=0`, movimentacoes incompletas) para rejeicao controlada ou correcao.

#### Fase C - Contrair

1. Tornar constraints obrigatorias (`VALIDATE CONSTRAINT` + `NOT NULL`).
2. Trocar leituras para `vw_eventos_unificados`.
3. Remover caminhos legados do cliente quando adocao > 95%.

### 7.3 Compatibilidade de cliente offline

1. `sync-batch` aceita v1 e v2 durante janela de transicao.
2. Cliente antigo continua escrevendo v1; servidor enriquece metadados.
3. Feature flag por fazenda para ativar regras estritas gradualmente.

## 8. Seguranca, auditoria e rastreabilidade

### 8.1 Seguranca

1. Manter RLS em todas as tabelas de evento/agenda.
2. Reforcar separacao de privilegios por role para operacoes sensiveis.
3. Assinatura HMAC para webhooks de propagacao externa.
4. Criptografia em transito (TLS) e em repouso (padrao plataforma).

### 8.2 Auditoria

1. Append-only preservado.
2. Log tecnico imutavel por operacao (`client_op_id`, `client_tx_id`, usuario, timestamp).
3. Tabela `eventos_auditoria` para trilha de aprovacao/acao administrativa.
4. Encadeamento de correcao por `corrige_evento_id`.

### 8.3 Rastreabilidade operacional

1. `correlation_id` para cadeia completa agenda -> evento -> financeiro.
2. `causation_id` para causalidade.
3. Relatorio de proveniencia por origem (`producer`).

## 9. Testes e validacao

### 9.1 Camadas de teste

1. Unitarios: validadores por dominio e dedup.
2. Integracao: `sync-batch` com cenarios APPLIED/APPLIED_ALTERED/REJECTED.
3. Contrato: JSON Schema v1/v2 e compatibilidade.
4. Migracao: testes de backfill e rollback de dados.
5. E2E: fluxos offline-first (captura, sync, rejeicao, rollback local).
6. Performance: carga de batch e throughput outbox.
7. Seguranca: testes de RLS por role e tenant isolation.

### 9.2 Criterios minimos de aceite tecnico

1. 0 regressao de integridade referencial.
2. >= 99% de lotes sincronizados sem erro em ambiente piloto.
3. 100% dos eventos v2 com `schema_version` e `tipo` preenchidos.
4. Reprocessamento de rejeicao validado em todos os dominios.
5. Dashboards e timeline lendo de modelo unificado sem divergencia.

## 10. Cronograma de implantacao em fases

### Fase 0 - Planejamento detalhado (Semana 1)

1. Fechar ADRs de modelo unificado.
2. Definir schemas JSON por dominio.

Aceite:

1. ADR aprovado por arquitetura e produto.
2. Especificacoes versionadas publicadas.

### Fase 1 - Fundacao de dados (Semanas 2-3)

1. Migrations de expansao (`eventos` v2, outbox, pipeline, constraints `NOT VALID`).
2. Ajustes em `sync-batch` para v2 com compatibilidade v1.

Aceite:

1. Migrations aplicam sem downtime.
2. Testes de integracao verdes.

### Fase 2 - Validacao por dominio (Semanas 4-5)

1. Implementar regras obrigatorias por dominio.
2. Uniformizar contratos de erro por campo/regra.

Aceite:

1. Suite de contrato 100% aprovada.
2. Rejeicoes explicitas por `reason_code` padronizado.

### Fase 3 - UI e experiencia operacional (Semanas 6-7)

1. Habilitar formularios de `nutricao` e `financeiro`.
2. Evoluir telas de eventos/agenda com detalhes unificados e rastreabilidade.

Aceite:

1. Registro completo dos 5 dominios na UI.
2. Timeline e filtros funcionando por dominio/tipo.

### Fase 4 - Migracao e backfill (Semanas 8-9)

1. Executar backfill historico.
2. Corrigir dados invalidos mapeados no diagnostico.

Aceite:

1. 100% eventos historicos com `schema_version`.
2. Relatorio de inconsistencias zerado ou com excecoes aprovadas.

### Fase 5 - Piloto controlado (Semanas 10-11)

1. Ativar feature flag v2 em fazendas piloto.
2. Monitorar rejeicoes, latencia e lag de outbox.

Aceite:

1. SLA de sync atendido.
2. Sem incidentes de tenant leakage ou perda de evento.

### Fase 6 - Rollout geral (Semana 12)

1. Expandir para todas as fazendas.
2. Encerrar caminho legado v1 (apos janela acordada).

Aceite:

1. Adocao > 95% no novo contrato.
2. Plano de rollback documentado e testado.

## 11. Documentacao tecnica de referencia (entregaveis)

1. `docs/EVENTOS_MODELO_UNIFICADO_V2.md` - modelo canonicamente tipado.
2. `docs/EVENTOS_CONTRATOS_JSON_SCHEMA.md` - schemas por dominio e exemplos.
3. `docs/EVENTOS_MIGRACAO_V2.md` - runbook de migracao/backfill/rollback.
4. `docs/EVENTOS_OPERACAO_E_OBSERVABILIDADE.md` - monitoracao, alertas e SLO.
5. `docs/EVENTOS_TEST_PLAN_V2.md` - plano de testes completo.
6. Atualizacao de `docs/CONTRACTS.md`, `docs/OFFLINE.md`, `docs/RLS.md`, `docs/DB.md`.

## 12. Riscos e mitigacoes

| Risco | Impacto | Mitigacao |
|---|---|---|
| Rejeicoes altas apos regras v2 | Alto | rollout por feature flag + monitoracao por dominio |
| Drift entre schema e tipos TS | Alto | CI de comparacao schema vs `types.ts` |
| Quebra em clientes offline antigos | Medio/Alto | compat v1/v2 e janela de deprecacao |
| Backfill com dados historicos incompletos | Medio | estrategia de quarentena + correcao assistida |
| Aumento de latencia no sync | Medio | batch tuning + indices + outbox assincrono |

## 13. Decisoes imediatas recomendadas (P0)

1. Adicionar checks de negocio faltantes: `eventos_financeiro.valor_total > 0`, `eventos_nutricao.quantidade_kg > 0` (quando preenchido).
2. Tornar obrigatoria a validacao de destino em movimentacao (`to_lote_id` ou `to_pasto_id`).
3. Corrigir drift de tipos em `src/lib/offline/types.ts` para espelhar schema atual.
4. Definir contrato minimo de `payload` por dominio com `schema_version`.
