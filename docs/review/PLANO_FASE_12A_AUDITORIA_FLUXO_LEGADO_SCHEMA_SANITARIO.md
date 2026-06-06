# Comitê Técnico Global — Análise Preparatória da Fase 12A

Atualizado em: 2026-06-06

## Decisão

`PROSSEGUIR COM ESCOPO REDUZIDO`

Motivo: o diagnóstico local está limpo e a 11.5J está efetivada no histórico local (`HEAD 5ab4adb`), mas a persistência vigente ainda depende do fluxo legado SQL/RPC e `status='concluido'` continua semanticamente ambíguo. A rodada fica limitada a documentação e decisão preparatória. Nenhuma implementação funcional foi feita.

## Fato confirmado

- Estado local do git no início: `git status --short --untracked-files=all` sem saída; `git status -sb` em `main...origin/main`; `git rev-parse --short HEAD` retornou `5ab4adb`.
- Histórico local recente confirma a 11.5J: `5ab4adb docs: rebaseline technical roadmap and update project status`, depois `f9532a8 docs(sanitario): reconcile domain contracts after agenda v2`.
- `git diff --check` e `git diff --cached --check` passaram antes do patch documental.
- Docs ativos confirmam Fase 11.5 fechada, 11.5I reconciliada, 11.5J rebaselineada e Fase 12 ainda não iniciada.
- `docs/context/SOURCE_OF_TRUTH.md`, `docs/domain/SANITARIO.md` e `docs/technical/EVENTS_AGENDA_CONTRACT.md` consolidam: Agenda = intenção, Evento = fato, fechamento de agenda = estado administrativo, `completed` sanitário depende de evento compatível.
- `supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql` define `agenda_status_enum` apenas como `agendado | concluido | cancelado`.
- `agenda_itens` mistura domínios por `dominio`, carrega `dedup_key`, `source_evento_id`, `protocol_item_version_id`, payload e FKs compostas por `fazenda_id`.
- `ux_agenda_dedup_active` protege apenas agenda aberta: `(fazenda_id, dedup_key) where status='agendado' and deleted_at is null`.
- `sanitario_recompute_agenda_core` materializa agenda sanitária atual em `agenda_itens`, marca antigas automáticas inválidas como `cancelado/deleted_at` e evita recriar quando há agenda concluída com `source_evento_id` e evento sanitário válido.
- `sanitario_complete_agenda_with_event` é RPC `security definer`: cria `eventos`, cria `eventos_sanitario`, atualiza `agenda_itens.status='concluido'`, grava `source_evento_id` e chama recompute.
- `vw_sanitario_pendencias` e `vw_sanitario_upcoming` leem `agenda_itens` sanitário aberto; `vw_sanitario_historico` lê `eventos` + `eventos_sanitario`.
- RLS atual existe para `agenda_itens`, `protocolos_sanitarios` e `protocolos_sanitarios_itens`; FKs principais usam `(id, fazenda_id)` para impedir vínculo cruzado.
- `sync-batch` força `fazenda_id` do request para tabelas tenant-scoped, valida membership, rejeita agenda já concluída por evento em insert de evento vinculado e trata `23505`.
- `normalizeMutationError` trata conflito de `agenda_itens` como `APPLIED_ALTERED`/`collision_noop`; outros `23505` genéricos viram `APPLIED`, exceto constraints mapeadas como rejeição.
- Dexie mantém `state_agenda_itens`, `event_eventos`, `event_eventos_sanitario`, `state_insumo_movimentacoes` e `queue_ops`; não há store v2 para `agenda_intent`, `event_execution_intent` ou `agenda_closure_intent`.
- `buildEventGesture` cria evento sanitário real em `eventos` + `eventos_sanitario`; baixa de estoque só nasce quando há evento e `gerarBaixaEstoque`, via `insumo_movimentacoes` com `id=eventId` e `source_evento_id=eventId`.
- Registrar, quando não usa RPC, pode reconciliar agenda sanitária manualmente marcando `agenda_itens.status='concluido'` e `source_evento_id=linkedEventId` para o item mais antigo compatível.
- A Agenda atual ainda expõe ação direta `Fechar pendência`; no caso sanitário, tenta RPC que cria evento. Para demais domínios, atualiza `agenda_itens` via gesture com `status`.
- Contratos 11.5 em `src/lib/sanitario/**` existem como core puro: `agenda_intent`, `event_execution_intent`, `agenda_closure_intent`; eles não persistem, não alteram Dexie, não alteram Supabase e não alteram sync-batch.

## Inferência

- A agenda sanitária legada é materializada hoje em `agenda_itens` por SQL e ainda opera por data exata/item, não por janela agrupada v2.
- `status='concluido'` é insuficiente como estado sanitário v2 porque mistura execução com evento, fechamento administrativo e conclusão genérica de outros domínios.
- `source_evento_id` é o marcador factual mais forte para distinguir conclusão por execução real; agenda concluída sem ele não deve satisfazer `completed`.
- Reaproveitar `agenda_itens` sem estruturas complementares aumentaria risco de duplicidade de fonte de verdade, porque demanda/preview/intent v2 ficariam escondidos em payload genérico.
- Substituir tudo de uma vez aumentaria risco operacional: UI, Dexie, sync-batch, RLS, views e RPC ainda consomem `agenda_itens`.
- A alternativa mais segura é criar estruturas complementares v2 e manter `agenda_itens` como superfície operacional durante transição controlada.
- O fluxo atual tem proteção parcial de idempotência, mas ainda não modela conflito remoto equivalente/divergente no nível de `agenda_intent`, `event_execution_intent` e `agenda_closure_intent`.
- Retry não pode depender só de `23505` genérico; a v2 precisa de `client_op_id` e `dedup_key` por intenção/fato/detalhe/baixa com leitura de equivalência.

## Recomendação do Comitê

Decisão de schema recomendada: **criar estruturas complementares v2 mantendo `agenda_itens` como superfície operacional transitória**.

Estratégia:

- preservar `agenda_itens` para compatibilidade de UI, relatórios operacionais e sync atual;
- adicionar em fase futura estruturas explícitas para intenções v2, ou tabela/contrato equivalente versionado, com `fazenda_id`, `client_op_id`, `dedup_key`, status administrativo, vínculo de preview/demanda e metadados de replay;
- manter evento executado em `eventos` + `eventos_sanitario`;
- manter baixa em `insumo_movimentacoes` apenas vinculada a evento real;
- tratar `agenda_itens` sanitário legado como superfície resetável/arquivável apenas para materializações antigas, não para fatos;
- bloquear qualquer migration que faça `concluido` equivaler a histórico sanitário;
- bloquear constraint global `status='concluido' => source_evento_id not null` antes de separar domínios e fechamento administrativo.

## Proposta de Fase 12A

Objetivo: documentar a auditoria do fluxo legado, fechar decisão de schema e preparar critérios de aceite para 12B sem implementar persistência.

Escopo:

- mapear fluxo legado Protocolo -> Agenda -> Evento -> Estoque;
- decidir schema alvo em nível arquitetural;
- documentar matriz de dados legados;
- definir requisitos de idempotência, conflito, RLS e Dexie;
- definir testes sentinela obrigatórios para 12B+.

Fora de escopo:

- migration SQL;
- enum/tabela/constraint/RLS/RPC/Edge Function;
- alteração de Dexie ou sync-batch;
- alteração de UI;
- seed;
- evento real, baixa de estoque, carência ativa, venda, abate ou aptidão operacional.

Arquivos a documentar:

- `docs/review/ACTIVE_PHASE_PLAN.md`;
- `docs/review/CURRENT_PHASE_HANDOFF.md`;
- `docs/review/LAST_PHASE_RESULT.md`;
- `docs/context/PROJECT_STATUS.md`;
- `docs/product/DECISION_LOG.md`.

Arquivos a auditar em 12B:

- `supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql`;
- `supabase/functions/sync-batch/**`;
- `src/lib/offline/db.ts`;
- `src/lib/offline/types.ts`;
- `src/lib/sanitario/**`;
- `src/lib/events/**`;
- `src/lib/inventory/**`;
- `src/pages/Agenda/**`;
- `src/pages/Registrar/**`;
- `src/features/operationalInsights/**`.

Critérios de aceite:

- decisão de schema explícita;
- matriz de dados legados documentada;
- risco de `status='concluido'` tratado como bloqueio de schema;
- reset/arquivamento sanitário definido;
- impacto Dexie/sync/RLS mapeado;
- testes sentinela de 12B definidos;
- nenhuma regra crítica criada por agenda, preview, demanda ou fechamento.

## Matriz de decisão de schema

| Alternativa | Offline-first | RLS/multi-tenant | Sync-batch | Regressão | Fonte paralela | Dados antigos | Rollback | Migration | UI atual | Risco operacional | Veredito |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1. Reaproveitar `agenda_itens` com extensão mínima | Baixo custo inicial, mas payload cresce e conflitos ficam implícitos | Usa RLS/FKs existentes, mas status sanitário fica misturado com outros domínios | Menor alteração inicial, porém dedup v2 ficaria parcial | Alto em `status='concluido'` e agrupamento | Alto, porque demanda/preview/intent podem virar payload opaco | Compatível, mas herda ambiguidade | Simples no curto prazo | Baixa/média | Melhor compatibilidade | Alto | Não recomendado como alvo |
| 2. Criar estruturas complementares v2 mantendo `agenda_itens` como superfície operacional | Exige versionamento Dexie, mas modela replay/idempotência explicitamente | Requer `fazenda_id` e FKs compostas novas; preserva isolamento se bem modelado | Exige novos handlers/contrato, mas permite conflito equivalente/divergente | Médio, controlável por rollout | Baixo/médio se `agenda_itens` for superfície, não verdade duplicada | Permite arquivar/resetar materialização antiga | Bom: desativar v2 e manter legado | Média | Compatível durante transição | Médio | Recomendado |
| 3. Substituir parcialmente agenda sanitária legada por novo modelo v2 | Melhor modelo final, mas maior quebra local/offline | Exige RLS completo novo | Exige reescrita coordenada | Alto | Baixo no final, alto durante migração | Exige plano destrutivo forte | Mais difícil | Alta | Exige adaptação ampla | Alto | Futuro, após 12B/12C |

## Matriz de dados legados

| Classe | Tratamento | Observação |
|---|---|---|
| Agenda sanitária antiga materializada por recompute legado | Resetável/arquivável em rollout controlado | Apenas `dominio='sanitario'`, origem automática/materialização antiga, sem tratar como fato |
| `state_agenda_itens` sanitário antigo local | Resetável localmente | Recriar por pull/recompute/novo contrato |
| Filas antigas de agenda sanitária incompatíveis com v2 | Resetável ou rejeitável com motivo explícito | Exige janela de rollout e mensagem auditável |
| Seeds/demo sanitários obsoletos | Resetável | Não misturar com dados reais |
| Pendências corretivas vinculadas a ocorrência real por `source_evento_id` | Exige auditoria manual | Podem precisar preservação ou migração própria |
| Protocolos usados por eventos históricos | Preservação obrigatória | Versionamento físico explica passado |
| Catálogos/produtos/insumos usados em eventos reais | Preservação obrigatória | Fonte técnica e snapshot histórico dependem deles |
| `eventos` | Proibido apagar em migration comum | Fato executado |
| `eventos_sanitario` | Proibido apagar em migration comum | Detail factual |
| `insumo_movimentacoes` vinculadas a evento real | Proibido apagar em migration comum | Baixa factual/custo |
| Carência em evento sanitário estruturado | Preservação obrigatória | Não recalcular por agenda |

## Idempotência e conflitos

Requisitos para 12B+:

- `agenda_intent` precisa de `client_op_id`, `client_tx_id`, `fazenda_id`, `dedup_key`, payload canônico, status administrativo e vínculo de origem.
- `event_execution_intent` precisa gerar no máximo um `eventos` e um `eventos_sanitario` equivalentes por dedup/operação.
- `agenda_closure_intent` precisa ser administrativo e idempotente; fechamento sem execução não cria evento.
- `dedup_key` deve separar protocolo, item, produto/classe, ação, lote, janela/data e animais ordenados; labels mutáveis não entram.
- Replay offline deve aceitar remoto equivalente como sucesso idempotente.
- Retry não pode duplicar agenda, evento, `eventos_sanitario` ou `insumo_movimentacoes`.
- Sucesso parcial deve ser explícito: agenda criada, evento criado, detalhe falhou, baixa falhou ou fechamento falhou não podem ser mascarados.
- Conflito remoto equivalente deve reconciliar para `APPLIED`/equivalente.
- Conflito remoto divergente deve rejeitar ou exigir resolução explícita.
- Rollback local deve restaurar `before_snapshot` quando operação otimista falhar, sem apagar fato remoto confirmado.
- Evento real pode fechar agenda administrativamente, mas fechamento de agenda não cria evento.

## RLS e multi-tenant

Requisitos mínimos:

- toda nova estrutura tenant-scoped deve carregar `fazenda_id`;
- RLS deve isolar select/insert/update/delete por membership/papel;
- FKs internas devem ser compostas com `fazenda_id`;
- `sync-batch` não pode aceitar escrita cross-farm e deve continuar forçando `fazenda_id` remoto;
- cliente não deve depender de `service_role`;
- RPC `security definer`, se mantida ou criada, deve validar usuário, fazenda, payload e `search_path`;
- eventos, detalhes e estoque devem manter consistência por `fazenda_id`.

## Dexie/offline-first

Impacto esperado, sem alteração nesta fase:

- nova persistência v2 exigirá versionamento Dexie;
- `queue_ops` precisa preservar operações de intenção, execução e fechamento com metadados completos;
- `state_agenda_itens` pode continuar superfície operacional, mas não deve esconder demanda/preview/intent como payload sem contrato;
- replay precisa diferenciar agenda, evento, detalhe sanitário e baixa;
- reconciliação deve tratar sucesso parcial e conflito divergente;
- migração local deve permitir reset controlado de agenda sanitária antiga sem apagar eventos;
- rollback de operação otimista deve ser determinístico.

## Riscos

### P0

- Tratar `agenda_itens.status='concluido'` como `completed` sanitário sem `source_evento_id` e evento compatível.
- Migration comum apagar `eventos`, `eventos_sanitario` ou `insumo_movimentacoes` factuais.
- Nova estrutura sem `fazenda_id`, RLS ou FK composta permitir cross-tenant.

### P1

- Criar fonte paralela de verdade entre `agenda_itens` e estruturas v2.
- Retry/replay duplicar agenda, evento, detalhe sanitário ou baixa de estoque.
- RPC-first continuar como caminho principal e quebrar offline-first.

### P2

- UI atual continuar mostrando `concluido` genérico sem estado sanitário v2.
- Payloads legados dificultarem migração/arquivamento.
- Tests sentinela ficarem apenas unitários e não cobrirem fluxo sync/local-remoto.

## Testes sentinela futuros

- Retry offline não duplica agenda.
- Retry offline não duplica evento.
- Retry offline não duplica `eventos_sanitario`.
- Retry offline não duplica `insumo_movimentacoes`.
- Agenda concluída sem evento não satisfaz `completed`.
- Fechamento sem execução não cria histórico.
- Evento sanitário real pode fechar agenda administrativamente.
- Baixa de estoque nasce apenas de evento real.
- Cross-fazenda é bloqueado por RLS/FK.
- Conflito remoto equivalente é idempotente.
- Conflito remoto divergente é rejeitado ou exige resolução explícita.
- Dados antigos sanitários são resetados apenas conforme matriz documental.
- Dados factuais nunca são apagados em migration comum.

## Próximos passos

Menor próxima fase segura: **12B — Desenho técnico persistido e testes sentinela sem migration destrutiva**.

12B deve produzir contrato técnico detalhado de schema/Dexie/sync-batch/RLS e testes sentinela iniciais, ainda podendo manter migrations destrutivas para uma subfase posterior somente após aceite explícito.

## Checklist final

- [x] Agenda continua intenção.
- [x] Evento continua fato.
- [x] Fechamento não cria histórico.
- [x] Estoque depende de evento real.
- [x] Carência depende de produto executado + fonte.
- [x] Offline-first preservado.
- [x] RLS/multi-tenant considerado.
- [x] Idempotência/retry/replay considerados.
- [x] Nenhuma implementação funcional feita nesta rodada.
