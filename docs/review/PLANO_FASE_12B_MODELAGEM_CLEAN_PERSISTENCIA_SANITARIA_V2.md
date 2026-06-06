# Comite Tecnico Global - Fase 12B

## Modelagem clean da persistencia sanitaria v2

Atualizado em: 2026-06-06

## Decisao consolidada

`PROSSEGUIR COM ESCOPO REDUZIDO`

A 12B fica aceita como desenho tecnico/documental do modelo clean/reset. O primeiro patch seguro desta subfase e documental: registrar a decisao clean, a estrategia de reset e o contrato minimo para a migration futura. Nenhuma migration, RLS, Dexie, sync-batch, UI, seed ou regra funcional foi aplicada nesta rodada.

## Justificativa

A 12A confirmou que o fluxo legado materializa agenda sanitaria em `agenda_itens`, usa `status='concluido'` com semantica ambigua e ainda passa por RPC/recompute SQL legado. A nova diretriz de produto remove a necessidade de preservar compatibilidade reversa com a agenda sanitaria antiga. Assim, a arquitetura alvo deve abandonar o legado como restricao de produto e preservar apenas fatos executados e fontes historicas reais.

## Diagnostico inicial

### Estado Git

- HEAD: `dd441b0`
- Branch: `main...origin/main`
- Worktree: limpo
- Staged: vazio
- Untracked: vazio
- 12A commitada/staged?: commitada em `dd441b0 docs(sanitario): audit legacy flow and define schema direction for phase 12A`
- `git diff --check`: sem erros
- `git diff --cached --check`: sem erros

### Estado documental

- Fase atual antes deste patch: documentos ativos ainda apontavam para 12A.
- 12A concluida?: sim, com decisao `PROSSEGUIR COM ESCOPO REDUZIDO`.
- Plano ativo antes deste patch: 12A.
- Decisao clean/reset registrada antes deste patch?: nao.
- Inconsistencias: 12A recomendava transicao mantendo `agenda_itens`; a diretriz da 12B autoriza abandonar compatibilidade com a agenda sanitaria legada e resetar dados operacionais antigos.

### Estado tecnico

- Schema atual de agenda: `agenda_itens` e tabela operacional comum, com `dominio`, `tipo`, `status`, `dedup_key`, `source_evento_id`, `protocol_item_version_id`, `payload` e mistura entre dominios.
- Schema atual de eventos: `eventos` preserva fato executado e pode apontar para `source_task_id`; evento nao deve ser apagado por reset de agenda.
- Schema atual de `eventos_sanitario`: detalhe historico sanitario ligado a `eventos` por `evento_id` e `fazenda_id`.
- Sync atual: `sync-batch` conhece `agenda_itens`, `eventos`, `eventos_sanitario` e `insumo_movimentacoes`; ainda nao conhece intents/tabelas v2.
- Dexie atual: possui `state_agenda_itens`, `event_eventos`, `event_eventos_sanitario`, `state_insumo_movimentacoes` e `queue_ops`; nao possui stores v2.
- RLS atual: padrao por `fazenda_id` e membership; novas estruturas devem repetir isolamento e FKs compostas.
- Pontos legados descartaveis: agenda sanitaria antiga em `agenda_itens`, `state_agenda_itens` sanitario, filas antigas incompatíveis, dedup/status/payload sanitario legado, seeds/demo sanitarios obsoletos.
- Pontos factuais preservaveis: `eventos`, `eventos_sanitario`, `insumo_movimentacoes` de evento real, protocolos usados como snapshot historico e catalogos tecnicos usados em eventos reais.

## Modelo clean recomendado

Criar persistencia sanitaria v2 explicita, separando:

1. Intencao futura: agenda sanitaria v2.
2. Escopo planejado: animais planejados da agenda.
3. Fechamento administrativo: closure da agenda.
4. Fato executado: continua exclusivamente em `eventos` + `eventos_sanitario`.
5. Estoque: continua exclusivamente derivado de evento real.
6. Carencia: futura leitura/snapshot apenas a partir de produto executado e fonte tecnica.

`agenda_itens` nao deve ser a fonte operacional sanitaria v2. Pode permanecer para outros dominios e como superficie transitoria nao sanitaria, mas a migration clean deve remover/resetar registros sanitarios legados e impedir recompute legado de repovoar agenda sanitaria antiga.

## Estruturas/tabelas propostas

### `sanitario_agenda_v2`

Tabela tenant-scoped para intencao sanitaria futura.

Campos obrigatorios recomendados:

- `id`
- `fazenda_id`
- `status` administrativo v2, sem valor `concluido`
- `dedup_key`
- `client_op_id`
- `source_demand_key`
- `preview_group_id`
- `protocolo_id`
- `protocol_item_version_id`
- `protocol_item_snapshot`
- `janela_inicio`
- `janela_fim`
- `data_programada`
- `lote_id`
- `produto_veterinario_id` ou snapshot de produto/classe, quando houver
- `acao_sanitaria`
- `execution_evento_id` nullable, apenas quando houver evento real associado
- `metadata`
- `created_at`, `updated_at`, `deleted_at`

Regras:

- `dedup_key` deve ser unico por `fazenda_id` enquanto a agenda estiver aberta/programada.
- `execution_evento_id`, quando preenchido, deve ter FK composta com `eventos(id, fazenda_id)`.
- status administrativo com execucao deve exigir evento real.
- status administrativo sem execucao nao pode exigir nem criar evento.

### `sanitario_agenda_animais_v2`

Tabela tenant-scoped para escopo planejado por animal.

Campos recomendados:

- `agenda_id`
- `fazenda_id`
- `animal_id`
- `planned_status`
- `execution_evento_id` nullable
- `not_executed_reason`
- `metadata`
- `created_at`, `updated_at`

Regras:

- PK ou unique por `(agenda_id, animal_id)`.
- FK composta para `sanitario_agenda_v2(id, fazenda_id)`.
- FK composta para `animais(id, fazenda_id)`.
- animal executado exige `execution_evento_id`.
- animal nao executado exige motivo administrativo.

### `sanitario_agenda_closures_v2`

Tabela tenant-scoped para fechamento administrativo.

Campos recomendados:

- `id`
- `fazenda_id`
- `agenda_id`
- `closure_type`
- `dedup_key`
- `client_op_id`
- `closed_at`
- `closed_by`
- `execution_evento_id` nullable
- `reason`
- `partial_payload`
- `metadata`
- `created_at`

Regras:

- closure com execucao total/parcial exige evento real compativel.
- closure sem execucao, cancelamento ou dispensa exige motivo e rejeita evento.
- closure nao cria evento.
- evento real pode fechar agenda administrativamente.

## Estrategia de reset

Reset controlado autorizado para a agenda sanitaria legada:

- remover registros sanitarios de `agenda_itens`;
- limpar `state_agenda_itens` sanitario no cliente durante migracao local;
- descartar filas antigas de agenda sanitaria incompatíveis;
- abandonar payload/dedup/status sanitario legado;
- recriar seeds/demo sanitarios conforme o contrato v2;
- desabilitar ou substituir recompute SQL legado para que ele nao repovoe `agenda_itens` sanitario.

O reset deve ser documentado como destrutivo apenas para dados operacionais de agenda sanitaria antiga. Ele nao pode apagar fatos executados.

## Dados descartaveis

- `agenda_itens` com `dominio='sanitario'`;
- `state_agenda_itens` sanitario;
- payload/dedup/status sanitario legado;
- filas locais/remotas de agenda sanitaria antiga incompatíveis com v2;
- seeds/demo sanitarios obsoletos;
- materializacoes derivadas por recompute legado.

## Dados factuais preservados

Proibido apagar em migration comum:

- `eventos` reais;
- `eventos_sanitario` reais;
- `insumo_movimentacoes` vinculadas a evento real;
- protocolos usados como fonte historica;
- catalogos de produtos/insumos usados em eventos reais;
- snapshots tecnicos associados a evento real.

Se algum ambiente for declarado 100% demo/descartavel, reset total deve ser decisao separada e explicita.

## Idempotencia

Requisitos minimos:

- `agenda_intent`: idempotente por `fazenda_id + dedup_key` e rastreavel por `client_op_id`.
- `event_execution_intent`: idempotente por `fazenda_id + dedup_key` de evento e por PK de detalhes; retry nao duplica `eventos` nem `eventos_sanitario`.
- `agenda_closure_intent`: idempotente por `fazenda_id + dedup_key`; retry nao duplica closure.
- baixa de estoque: idempotente por evento real/source tecnico, nunca por agenda.
- conflito remoto equivalente: deve retornar aplicado/idempotente.
- conflito remoto divergente: deve rejeitar ou exigir resolucao explicita.
- sucesso parcial: precisa registrar quais intents foram aplicadas e quais ficaram pendentes.
- rollback: nunca pode apagar fato executado para compensar fechamento administrativo.

## RLS/multi-tenant

Requisitos minimos:

- toda tabela v2 deve ter `fazenda_id`;
- RLS por membership da fazenda;
- FKs compostas devem impedir vinculo cross-fazenda;
- client nao depende de `service_role`;
- `sync-batch` nao pode aceitar escrita cross-farm;
- `eventos`, `eventos_sanitario` e estoque devem manter consistencia por `fazenda_id`;
- policies devem cobrir `select`, `insert`, `update` administrativo permitido e bloquear delete funcional indevido.

## Dexie/offline-first

Impacto esperado para fase futura:

- adicionar stores locais v2 para agenda, animais planejados e closures;
- versionar Dexie com migration local explicita;
- limpar/resetar `state_agenda_itens` sanitario;
- marcar ou descartar `queue_ops` antigas incompatíveis;
- reconciliar replay por `client_op_id` e `dedup_key`;
- suportar conflito equivalente/divergente;
- manter eventos e estoque como fluxos separados de fato executado.

Nao alterar Dexie nesta rodada.

## Sync-batch futuro

O `sync-batch` deve receber tres familias de intent:

- `agenda_intent` -> upsert em `sanitario_agenda_v2` e animais planejados.
- `event_execution_intent` -> cria/aplica `eventos` + `eventos_sanitario` e, quando informado, baixa de estoque por evento real.
- `agenda_closure_intent` -> cria closure administrativa e atualiza estado administrativo da agenda.

Regras:

- fechamento sem execucao nao cria evento;
- evento real pode fechar agenda;
- retry nao duplica agenda, evento, detalhe sanitario, closure ou estoque;
- conflito divergente nao deve ser normalizado como sucesso silencioso.

## Primeiro patch recomendado

Este patch documental e o primeiro passo seguro da 12B.

Patch tecnico seguinte recomendado:

1. criar migration expand/reset com tabelas v2, enums, constraints, RLS e grants;
2. resetar `agenda_itens` sanitario legado;
3. impedir recompute legado de repovoar agenda sanitaria antiga;
4. adicionar testes de migration/RLS/idempotencia basicos;
5. rodar baseline Supabase e suite completa exigida para SQL.

Nao implementar UI, Dexie completo ou `sync-batch` completo no mesmo patch da migration inicial.

## Arquivos candidatos para proxima subfase

- `supabase/migrations/*_sanitario_agenda_v2_clean_foundation.sql`
- `supabase/functions/sync-batch/index.ts`
- `supabase/functions/sync-batch/rules.ts`
- `src/lib/offline/db.ts`
- `src/lib/offline/types.ts`
- `src/lib/offline/tableMap.ts`
- `src/lib/offline/ops.ts`
- `src/lib/sanitario/agenda/*`
- `src/lib/sanitario/execution/*`
- testes sentinela em `src/lib/sanitario/**/__tests__` e `supabase/functions/sync-batch/*.test.ts`

## Testes sentinela

Minimos para liberar 12C+:

- retry offline nao duplica agenda v2;
- retry offline nao duplica evento;
- retry offline nao duplica `eventos_sanitario`;
- retry offline nao duplica `insumo_movimentacoes`;
- agenda fechada sem evento nao satisfaz `completed`;
- fechamento sem execucao nao cria historico;
- evento sanitario real pode fechar agenda administrativamente;
- baixa de estoque nasce apenas de evento real;
- cross-fazenda e bloqueado por RLS/FK;
- conflito remoto equivalente e idempotente;
- conflito remoto divergente e rejeitado ou exige resolucao explicita;
- reset de agenda sanitaria antiga nao apaga eventos reais;
- reset de agenda sanitaria antiga nao apaga detalhes sanitarios reais;
- reset de agenda sanitaria antiga nao apaga movimentacoes de estoque reais.

## Validacao obrigatoria

Como esta rodada e apenas documental:

```bash
git status --short --untracked-files=all
git diff --check
git diff --cached --check
```

Se a proxima subfase criar SQL/schema/RLS:

```bash
pnpm test -- src/lib/sanitario
pnpm test -- supabase/functions/sync-batch
pnpm test
pnpm run lint
pnpm run build
node scripts/codex/validate-supabase-baseline-functional.mjs
git diff --check
git diff --cached --check
git status --short --untracked-files=all
```

## Criterio de aceite

- 12A preservada no git.
- decisao clean/reset documentada.
- schema v2 nao transforma agenda em historico.
- fechamento nao cria evento.
- evento real continua fonte historica.
- baixa de estoque continua dependente de evento real.
- carencia continua dependente de produto executado + fonte tecnica.
- RLS/multi-tenant considerado.
- idempotencia tem chaves claras.
- rollback/reset explicito.
- nenhum legado mantido apenas por compatibilidade reversa.
- nenhuma implementacao funcional feita nesta rodada.

## Checklist final

- [x] Agenda continua intencao.
- [x] Evento continua fato.
- [x] Fechamento nao cria historico.
- [x] Estoque depende de evento real.
- [x] Carencia depende de produto executado + fonte.
- [x] Offline-first preservado como requisito.
- [x] RLS/multi-tenant considerado.
- [x] Idempotencia/retry/replay considerados.
- [x] Reset clean da agenda sanitaria legada documentado.
- [x] Nenhuma implementacao funcional feita nesta rodada.
