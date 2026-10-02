# F24.4E2 — Movement Event/State Design Contract

Atualizado em: 2026-10-01

Subfase: `F24.4E2 — MOVEMENT_EVENT_STATE_CONVERGENCE`

Modo atual: `IMPLEMENTATION` — fundação PostgreSQL Animal→Lote; design/characterization anteriores preservados abaixo.

Status: `DESIGN_CONTRACT = DEFINED`; `E2.1_COMMAND_CONTRACT = DEFINED`; `E2.1A = SERVER_FOUNDATION_LOCAL_VALIDATED`; `E2.1A.1 = READY_FOR_REVIEW`; `E2.1B = READY_FOR_REVIEW`; `G3 = OPEN`. Evidência atual na seção 16; seções 1–15 registram as etapas anteriores.

## 1. Baseline e escopo

```ini
repository = maresdeandrade/RebanhoSync
branch = feat/f24-4e2-movement-event-state-convergence
HEAD = 040c3c0605ff4f6ecabeedec1b28c5017455f6ac
origin/main = 040c3c0605ff4f6ecabeedec1b28c5017455f6ac
worktree = C:/Users/mares/dyad-apps/GestaoAgro
initial_worktree = DIRTY_TWO_UNTRACKED_FILES
F24_4E = IN_PROGRESS
F24_4E1_ANIMAIS_DELETE_TOMBSTONE_CAS = INTEGRATED
PR_173_MERGE_COMMIT = 040c3c0605ff4f6ecabeedec1b28c5017455f6ac
F24_4E2_CHARACTERIZATION = LOCAL_OBSERVED_WITH_LIMITATIONS
F24_4E2_DESIGN_CONTRACT = DEFINED
F24_4E2_RUNTIME = NOT_STARTED
```

`git fetch origin --prune` e comparação de refs confirmaram o baseline. Antes do patch,
este documento e `src/lib/offline/__tests__/movementEventStateConvergence.characterization.test.ts`
eram **existentes e untracked**, não committed nem tracked. Não havia alterações tracked ou
staged. O relato anterior de worktree clean era incorreto. As outras worktrees inventariadas
não foram alteradas. Status/diffs delimitam esta execução; não certificam ausência de
processos externos concorrentes.

Escopo: este design, fortalecimento do teste existente e correção dos apontadores ativos de
E1/E2. Sem runtime, migration, schema, RLS, RPC, trigger, deploy, merge, push ou acesso a
dados remotos. Não inicia E3/F24.4F.

## 2. Comportamento atual e gap

```ini
ARCHITECTURE_CURRENT = MODEL_E
EVENT_STATE_ATOMICITY = NOT_IMPLEMENTED_FOR_GENERIC_MOVEMENT
DOMAIN_MOVEMENT_RECONCILER = ABSENT_IN_AUDITED_PATH
GENERIC_PULL_REBUILDS_MOVEMENT_STATE = NO
F24_4E_G3 = CONFIRMED_BY_CODE_AND_LOCAL_CHARACTERIZATION
LOTE_PASTO_CAS = ABSENT_IN_GENERIC_SYNC_PATH
```

O caminho genérico admite `eventos = APPLIED`, `eventos_movimentacao = APPLIED` e
`animais = CONFLICT / STATE_REVISION_CONFLICT`. O worker preserva fatos, reverte operações
rejeitadas, registra rejeição e obrigação durável de pull. O pull copia `animais` remoto;
não calcula `lote_id` pelos Eventos. Convergência da cópia local ao snapshot remoto não
resolve o efeito de domínio do fato conflitante.

“Commit order wins” era impreciso no documento anterior: entre mutações da mesma revision,
vence o CAS que efetivamente atualizar a linha primeiro. Revisões sucessivas podem permitir
mais de uma aplicação. Ordem HTTP, recebimento, commit e tempo factual são coisas distintas.
Não há sequenciador factual de movimentação implementado nesse caminho.

## 3. Fontes de verdade auditadas

| Estrutura | Evidência do contrato atual |
| --- | --- |
| `eventos` | PK `id` = `eventId` do builder; `fazenda_id`, `occurred_at`, `animal_id`, `lote_id`, `source_task_id`, `source_tx_id`, `source_client_op_id`, `corrige_evento_id`. `buildEventGesture.ts:36`, `types.ts:1581`, baseline SQL:506. |
| `eventos_movimentacao` | PK/FK real `evento_id`, não `event_id`; `from_lote_id`, `to_lote_id`, `from_pasto_id`, `to_pasto_id`, tenant. Baseline SQL:630. |
| `animais.lote_id` | Localização corrente, com revision remota. Migration `20260927120000_f24_4c_animais_state_revision.sql` incrementa revision em UPDATE. |
| `animais.pasto_id` | Ausente do schema ativo auditado e da interface Animal. A menção defensiva na regra anti-teleporte não comprova existência. Pasto atual é derivado do lote corrente e `lotes.pasto_id`. |
| `lotes.pasto_id` | Localização corrente do lote; FK tenant-scoped; sem revision/CAS no caminho genérico auditado. |
| `pastos` | Cadastro/estado do pasto. Mover lote não altera cadastro do pasto. |
| Stores Dexie | `tableMap.ts`: animais→state_animais; lotes→state_lotes; pastos→state_pastos; eventos→event_eventos; eventos_movimentacao→event_eventos_movimentacao; pasto_ocupacoes→state_pasto_ocupacoes. Não presumir tabela remota `state_*`. |
| `pasto_ocupacoes` | Read model de períodos, referências entrada_evento_id/saida_evento_id; uma ocupação aberta por fazenda+lote. Migration `20260508003000_pasto_ocupacoes.sql`. |
| Occupancy calculada | `buildAnimalOccupancyTimeline` ordena occurred_at para períodos, sem escrever animais. `historicalLotPastureOccupancy.ts:336` marca correção `UNSUPPORTED_CORRECTION`. Análise histórica não arbitra current state. |

Migrations são evidência do contrato versionado, não inspeção do banco remoto nesta execução.
FKs compostas preservam tenant de animal, lote, pasto e correção. `prevalidateAntiTeleport`
exige base/detail correlatos para UPDATE de localização do animal, mas não compara origem
com state corrente, nem protege UPDATE de lote pelo mesmo contrato. O validator local
bloqueia destino ausente/origem=destino conforme o tipo; UI não é barreira de autorização.

### Append-only e correção atuais

O builder carrega `corrige_evento_id` na nova base; a FK valida tenant, mas não domínio,
sujeito, ciclo ou ramificação. Movimento com esse campo ainda emite UPDATE comum de animal.
Não foi encontrado resolvedor canônico de correção no writer/worker/Edge/pull auditados.

A baseline `00000000000000_rebuild_base_schema_sanitario.sql:16/2131` define
`prevent_business_update` e triggers em base/detail. Impede alteração de negócio, mas
permite updated_at/deleted_at/server_received_at, cobre UPDATE e não DELETE físico;
há FKs on-delete set-null/cascade. Não é imutabilidade absoluta contra operador privilegiado.
A ACL forward-only existente deve ser preservada. **O design proíbe** editar/apagar/tombstonar
fato aplicado para corrigir state. Correção é novo Evento e nova decisão auditável.

## 4. Pipeline real e boundaries atuais

| Etapa | Arquivo/função real | Boundary / limite |
| --- | --- | --- |
| UI animal | `src/components/manejo/MoverAnimalLote.tsx`, handleConfirm | Origem local, destino e clock; builder→gesture. |
| UI lote | `src/components/manejo/MudarPastoLote.tsx`, handleConfirm | movementKind=lote_pasto; acrescenta occupancy. |
| Builder | `src/lib/events/buildEventGesture.ts`, buildBaseEventOp/buildEventGesture | INSERT base+detail e UPDATE animal ou opt-in lote. |
| Occupancy | `src/lib/pastos/pastoOcupacoes.ts`, buildPastoOcupacaoOps | Fecha/abre períodos. Comentário “atômicas” não comprova transação remota. |
| Local/enqueue | `src/lib/offline/ops.ts`, createGesture/applyOpLocal/persistExpectedAnimalRevision | Transação Dexie: gesto, ops, optimistic; before_snapshot/revision persistidos; sem incrementar revision local. |
| Transporte | `src/lib/offline/syncWorker.ts`, processGesture/mapOperationForSync/sendBatchRequest | Identidades/revision no envelope; Web Locks/claim local, não lock PostgreSQL. |
| Edge | `supabase/functions/sync-batch/index.ts`, handler Deno.serve | Autenticação/membership/tenant; loop por op. Movimento sem RPC de domínio. |
| Replay | `rules.ts`, isPersistedOperationReplay; handler:773 | client_op_id+client_tx_id antes do CAS; PK com outra identidade é conflito, não dedup por conteúdo. |
| INSERTs remotos | handler:1588 | PostgREST individual; base/detail/state não compartilham transação PostgreSQL. |
| CAS animal | validateStateExpectedRevision/buildMutationMatch; handler:826/1599 | UPDATE/DELETE por PK+fazenda+revision; missing revision rejeita; mismatch/zero rows terminal. |
| Lote/occupancy | mutações genéricas | PK+fazenda, sem CAS revision. Constraints não dão atomicidade conjunta. |
| Resultado/rollback | reconcileGenericOperationResults, syncWorker:1376; rollbackOpLocal | Rejeitadas revertidas em ordem reversa, aplicadas reaplicadas; fatos aceitos preservados. |
| Compensação | caminho genérico auditado | Não há compensação remota nem apagar Evento para corrigir state. |
| Obligations | sync_reconcile_obligations; upsertReconciliationObligations/drainReconciliationObligations | ACK/resultado com persistência local; fazenda+scope+generation; failure preserva obrigação. |
| Pull | `pull.ts`, pullDataForFarm/applyFarmPull/writeMergeResults | Fetch tenant-scoped+transação Dexie; pending protegido; copia dados sem rebuild factual de localização. |
| Consumo | state_animais/state_lotes/state_pastos/useOccupancyData | Current state e análises históricas separados. |

Replay genérico de state consulta a identidade atualmente na linha, não um ledger durável
de toda mutação antiga após outras escritas. O boundary novo precisa de resultado persistido
por identidade mesmo depois do avanço da projeção.

## 5. Decisão de autoridade e tempo (D1–D4)

**Escolha: comando de domínio transacional no servidor com CAS e classificação durável
do efeito.** Receber fato válido não significa que venceu state. Convergência significa
projeção explicável, cópias locais convergentes e conflitos expostos; não inventar ordem física
total para fatos ambíguos.

```ini
MOVEMENT_HISTORY_AUTHORITY = EVENTOS_PLUS_EVENTOS_MOVIMENTACAO
MOVEMENT_CURRENT_STATE_AUTHORITY = SERVER_DOMAIN_DECISION_WITH_CAS
MOVEMENT_PROJECTION_ORDER = PER_SUBJECT_SERVER_SERIALIZED_ACCEPTED_TRANSITIONS
CLIENT_CLOCK_STATE_AUTHORITY = NONE
STATE_WINNER_AUTHORITY = SERVER_REVISION_CAS
CLIENT_CLOCK_STATE_AUTHORITY_FOR_ANIMAIS = NONE_FOR_ANIMAIS_CAS
EVENT_TIME_AUTHORITY = DOMAIN_FACTUAL_INPUT_OR_CLIENT_CLOCK_FALLBACK
EVENT_STATE_BOUNDARY = POSTGRES_DOMAIN_TRANSACTION_FACT_DETAIL_EFFECT_DECISION_AND_DUE_STATE
EVENT_STATE_WRITE_BOUNDARY = POSTGRES_DOMAIN_TRANSACTION_FACT_DETAIL_EFFECT_DECISION_AND_DUE_STATE
LATE_EVENT_POLICY = HISTORY_ONLY_IF_EXPLICIT_OR_CAUSALLY_SUPERSEDED_OTHERWISE_CONFLICT
SAME_TIME_TIE_BREAK = SERVER_SERIALIZED_CAS_ACCEPTANCE
TIE_BREAK_POLICY = SERVER_SERIALIZED_CAS_ACCEPTANCE_NO_TIMESTAMP_COMPARISON
CORRECTION_POLICY = APPEND_EVENT_AND_EXPLICIT_EFFECT_DECISION_NO_ORIGINAL_EDIT
LEGACY_CLIENT_POLICY = EDGE_VERSIONED_ADAPTER_PRESERVE_IDENTITIES_FAIL_CLOSED_ON_AMBIGUITY
ANIMAL_MOVEMENT_POLICY = SERVER_MOVEMENT_VERSION_AND_MATCHING_ORIGIN_AND_PROJECTION_HEAD
LOT_PASTURE_MOVEMENT_POLICY = DEDICATED_LOCATION_CAS_WITH_OCCUPANCY_IN_SAME_BOUNDARY
SERVER_TRIGGER_BY_OCCURRED_AT = NOT_AUTHORIZED
CLIENT_FORCE_RECONCILER = NOT_AUTHORIZED
FIELD_LEVEL_MERGE = NOT_AUTHORIZED
AUTO_MERGE = NOT_AUTHORIZED
```

Comandos, resultados e metadados abaixo são **contrato proposto**, não schema/enum/API
implementados. Definir semântica não autoriza migration/rollout.

STATE_WINNER_AUTHORITY acima descreve o CAS genérico existente de animal (F24.4D/C/E1).
E2.1 decide explicitamente a especialização futura R2 de movimentação; ambas as autoridades
são servidor, sem relógio do cliente. Não altera o runtime ou o CAS genérico nesta etapa.

### D1 — Critérios comparados

| Candidato | Decisão / razão |
| --- | --- |
| server revision | CAS genérico existente para animal; freshness do registro inteiro, não tempo factual. E2.1 mantém esse contrato e especializa o novo comando. |
| server commit sequence | Serialização das transições elegíveis aceitas sob lock/CAS por sujeito; não último fato recebido. |
| occurred_at | Histórico/períodos; não escolhe localização atual. |
| server_received_at | Auditoria de recebimento; não cronologia offline nem desempate transacional. |
| Sequência factual especializada | Ausente; E2.1 define referência imutável ao predecessor, validada pela decisão e pelo token de saída dele. Não é rebase. |
| Versão de projeção | Metadado server-authoritative por sujeito detecta ABA e invalidação de elegibilidade. Não substitui revision genérica nem vira fato. |
| Combinação escolhida | Token especializado+origem+cabeça+elegibilidade; efeito/versão/identidade persistidos no mesmo commit. Conflitos explícitos, sem merge. |

Sujeito = fazenda+animal para animal→lote; fazenda+lote para lote→pasto. Sem ordem global
entre sujeitos independentes. Revision de animal avança por qualquer UPDATE. O token
especializado também invalida snapshots após mudança de status/tombstone; uma invalidação
não cria Evento de movimentação nem altera a cabeça factual (detalhes em E2.1).

Para A/B do mesmo snapshot, primeiro CAS elegível que efetivamente atualiza e commita vence;
o outro fato recebe conflito de efeito e permanece no histórico. Isso desempata operação,
sem provar qual fato foi fisicamente mais recente. Dois fatos distintos nunca são deduplicados
por mesma origem/destino/data. Revisões sucessivas seguem transições aceitas.

### D2 — T2 recebido antes de T1

| Evidência | Tratamento definido |
| --- | --- |
| T2 já influenciou state, T1 tem snapshot/cabeça anteriores | T1 não altera state. HISTORY_ONLY se precedência factual for explícita, senão HISTORY_CONFLICT. |
| T1 explicitamente histórico | HISTORY_ONLY; origem não precisa ser localização corrente. |
| T2 declara dependência T1 ainda ausente | Preservar T2 como PENDING_CAUSAL_DEPENDENCY, sem state; servidor retoma usando o token de saída de T1, sem reescrever input. |
| T1 elegível e T2 referencia T1 explicitamente | T2 pode aplicar se origem, cabeça e token de saída de T1 continuam atuais e elegibilidade é válida. |
| T2 legado carrega apenas revision antiga | Mantém CAS estrito legado; não inferir sucessão nem atualizar expected_revision. |
| Causalidade desconhecida | Hora menor não prova atraso; preservar conflito, sem ordenar ou criar nova intenção silenciosamente. |

E2.1 define encadeamento por identidade factual imutável. O sucessor recebe offline um
seletor simbólico do predecessor, não uma revision numérica fabricada. O servidor resolve
somente o token de saída registrado daquele predecessor; token/cabeça atuais diferentes
produzem conflito. Filas legadas sem esse vínculo podem exigir resolução após reconnect.

A pendência causal é durável no servidor, vinculada ao Evento dependente. Ao aceitar o
predecessor, o comando de domínio deve registrar uma nova decisão vinculada para os
dependentes do mesmo sujeito: dependência satisfeita e seletor causal original ainda válido
permitem efeito; caso contrário, conflito explícito. Não depende de um cliente permanecer aberto.
Nenhuma reavaliação altera o resultado original de replay ou o seletor capturado. Pendência
não satisfeita continua consultável e pode ser tratada por resolução operacional explícita.

`resolve_projection` é comando explícito que referencia fatos preservados, snapshot atual
reconciliado, escolha/evidência da localização e ator autorizado. É nova intenção de resolução
auditada, não novo movimento fictício nem retry técnico do perdedor. Novo CAS stale conflita;
não ressuscita animal tombstonado/inativo. Replay do comando original mantém resultado original.

Não é possível demonstrar ordem física T1/T2 somente por clocks não confiáveis. Sem evidência
causal ou decisão operacional, não há inferência inequívoca de “histórico atrasado”.

### D3 — Clock skew +55/-55 minutos

Horários permanecem como input factual com proveniência. Invertê-los não muda revision,
cabeça, origem ou predicado CAS. Clock servidor também não prova tempo físico.
Scheduling pode variar, mas não pode reabrir conflito terminal. Datas de períodos
inconsistentes geram pendência/limitação; não timestamps corrigidos silenciosamente.

### D4 — Mesmo occurred_at

Sem sort por timestamp, UUID cliente ou ordem de array para escolher state. Desempate
operacional = CAS serializado servidor, com versão persistida. Replay consulta resultado
antes do CAS. Histórico pode exibir empate/ambiguidade; versão operacional não prova
precedência física. Rebuild técnico usa ordem inequívoca de versões aceitas.

## 6. Correções e origem (D5–D6)

### D5 — Correção append-only

Validar tenant/domínio/sujeito, detalhe completo, referência existente, ciclos e ramificação.
Correções formam cadeia explícita; ramificação é conflito, não última hora vencedora.
A projeção reconhece original substituído por corrige_evento_id validado + decisão persistida;
ambos os Eventos permanecem.

- Correção apenas de data/metadado/história: sem efeito na localização corrente.
- Correção de destino do Evento ainda na cabeça: pode substituir efeito por CAS atual+cabeça,
  validando original/correção. Não representa movimento físico realizado agora.
- Correção de ancestral com sucessores: não retrocede state nem reexecuta cadeia por hora;
  marca impactos/conflitos históricos. Alterar localização exige resolve_projection explícito.
- Correção concorrente/stale: preserva correção válida com conflito de efeito; sem editar
  original, apagar fato aplicado ou fabricar contra-movimento físico.

Decisão posterior é outro registro vinculado; não reescreve o ACK/replay original.

### D6 — Origem factual

Movimento normal que quer alterar current state exige from_lote_id igual à origem persistida
sob lock/CAS, incluindo null explícito, e snapshot/cabeça válidos. Destino, atividade, tenant
e mudança efetiva são revalidados. Valor igual sem versão é insuficiente (ABA).

Histórico descreve origem factual, não precisa coincidir com state atual. Origem divergente
em história sem modo/causalidade explícitos = HISTORY_CONFLICT, não dedução automática de atraso.
No comando operacional E2.1, guard de origem/token falho é PROJECTION_CONFLICT; em ambos
os casos, fato válido é preservado sem efeito automático.
Tenant/FKs/sujeito/identidade inválidos rejeitam antes da inserção. Fato válido incompatível
com projeção é preservado com conflito. Correção compara efeito original (D5); sua origem
antiga não precisa ser o destino atual. Sem certificação de GTA/liberação sanitária nesta etapa.

## 7. Lote→pasto (D7)

`REVISION_PROTECTED_STATE_TABLES` em rules.ts:9 contém apenas animais. Lotes/occupancy não
capturam revision nem recebem predicado CAS. Índice de ocupação aberta não impede LWW
em lotes.pasto_id nem fechamento parcial.

Contrato lote: token monotônico dedicado da localização/cabeça, CAS fazenda+lote+token+origem
e lock da linha do lote. Não generaliza revision para todos os state_*. Cadastro de pasto
não muda. Animal segue no lote; não exige UPDATE de cada animal nem cria animais.pasto_id.

Base/detail/decisão, lotes.pasto_id, fechamento/abertura de pasto_ocupacoes e token pertencem
à mesma transação. to_pasto_id=null remove lote do pasto mantendo sujeito lote identificado.
Somente efeito aceito atualiza occupancy; históricos/conflitos não fecham a ocupação vigente.
Identidades de occupancy são estáveis no replay, com referências factuais de entrada/saída.

Se intervalo factual viola saida_em>=entrada_em, não recortar datas nem apagar período.
Efeito composto recebe conflito/pendência temporal, sem commit parcial de lote/occupancy;
fato+decisão permanecem. Pode exigir correção de data antes da projeção: limitação explícita,
não arbitragem por “hora mais recente”. Clock não elege vencedor, embora data inválida
possa impedir materialização dos períodos.

## 8. Clientes antigos e cutover (D8)

**Adapter versionado no Edge antes de qualquer escrita de movimentação do bundle.**
Servidor novo interpreta envelope antigo; nenhum cutover/deploy está autorizado agora.

| Entrada legado | Estratégia definida |
| --- | --- |
| Base+detail+UPDATE animal com expected_revision | Converter ao comando preservando event ID e identidades ops/tx; não buscar revision nova para autorizar state. |
| Animal pré-CAS sem expected_revision | Preservar base/detail válidos; UPDATE REJECTED/STATE_EXPECTED_REVISION_REQUIRED; sem efeito; reconciliação+nova decisão. |
| Lote→pasto sem token | Preservar fato; não fabricar token nem fazer LWW. Rejeição terminal versionada de projeção/occupancy, confirmação por cliente atualizado. |
| Base/detail sem UPDATE | HISTORY_ONLY se modo explícito; legado sem modo = LEGACY_HISTORY_UNCLASSIFIED, sem state. |
| UPDATE redundante do bundle já comandado | Não executar novamente; devolver resultado original por identidade; nunca APPLIED para efeito rejeitado. |
| Fragmentos aplicados antes do cutover | Reconhecer cada PK+identidade+tenant, completar apenas fragmentos compatíveis. Sem prova de efeito, não inferir por destino atual: pendência legada e decisão explícita. |
| Bundle incompleto/associação ambígua | Dependência durável; vínculo inválido terminal. UPDATE jamais cai no genérico por falha de parsing. |
| Mesma identidade/outro conteúdo | Rejeição de identidade divergente, sem heurística de dedup. |

Resposta antiga por op_id: base/detail persistidos = APPLIED; state aceito = APPLIED;
state animal conflita = CONFLICT/STATE_REVISION_CONFLICT; sem revision = rejeição existente.
Lote sem token usa reason específico versionado. Occupancy segue resultado do efeito.
Cliente novo recebe classificação/cabeça/versão/revision/pendência. Cliente antigo pode
mostrar gesto misto rejeitado; ACK factual não significa sucesso operacional.

Ledger preserva todas as identidades, digest e resultado por op, inclusive replay após
avanço posterior. Resolução é outra decisão, consultável pelo pull, sem alterar ACK original.
Associação por fazenda+tx+Evento+op e vínculos exatos; source_task_id, conteúdo ou hora
semelhantes não deduplicam fatos.

Adapter sozinho não impede PostgREST direto de cliente antigo. Cutover precisa inventariar
todos os writers de localização/occupancy e enforcement server-side que impeça bypass,
preservando cadastro/comercial e suas filas. Isso exige futuro escopo de banco; não houve
mudança de grants/RLS agora. Gate desligado mantém comportamento atual. Ativação só após
testes de legados completos/parciais e comunicação explícita das rejeições. Processável não
significa aceitar silenciosamente mutação insegura.

## 9. Alternativas arquiteturais

| Critério | A — comando transacional | B — trigger | C — reconciliador cliente | D — rebuild por Eventos |
| --- | --- | --- | --- | --- |
| Fonte histórica | Base/detail preservados | Preserva se contrato completo | Preservar remoto obrigatório | Preserva se sem edição |
| Autoridade state | CAS+decisão durável | Precisa resolver mesma autoridade de A | Cliente não arbitra disputa | Histórico bruto insuficiente |
| Offline longo | Enqueue; conflitos explícitos | Reconnect exige contrato completo | Depende de app/rede | Exige histórico/checkpoint |
| Idempotência | Ledger antes de CAS | Precisa ledger/head | Precisa resultado remoto | Determinismo com versões/decisões |
| Concorrência | Lock+CAS sujeito | INSERT isolado não resolve ordem | Reenvio nova revision é arbitragem | Timestamp não resolve disputa |
| Partial success | Fato+detail+classificação atômicos, state devido junto | Não torna INSERT base separado atômico | Não elimina parcial remoto | Não cria boundary no writer |
| Clock skew | Clock não elege state | occurred_at sozinho viola contrato | Comparar hora viola contrato | Fold por occurred_at viola contrato |
| Farm switch | Tenant revalidado; obligation | Tenant/FKs obrigatórios | Drain por fazenda necessário | Particionar por tenant |
| Crash/restart | Replay consulta ledger | Precisa dedup durável | Retomada exige persistência extra | Versão/checkpoint necessários |
| Clientes antigos | Adapter+enforcement | UPDATE legado sobrescreve/duplica | Legado não tem resolvedor | UPDATE legado diverge |
| Auditoria | Fato/efeito separados | Precisa ledger para explicar | Exige autoridade remota | Explicar inclusões/correções |
| Reversibilidade | Expand+gate, sem backfill cego | Side effects em qualquer INSERT | Código menor, contrato inadequado | Histórico/backfill/leitores amplos |

**Escolha A.** Rejeitado B simples por occurred_at; trigger não é boundary primário.
C permanece para pull/apresentação de decisão explícita, nunca force UPDATE.
D serve futuramente para verificar/reconstruir projeção por **decisões aceitas**, usando
checkpoint+versões+Eventos+correções, não ordenar todo histórico por clock. Custo cresce
com histórico por sujeito; checkpoint evita pull integral contínuo. Sem decisões/baseline,
não se reconstrói current state inequívoco do histórico bruto existente.

## 10. Boundary e menor patch implementável

Comando conceitual apply_movement_operation: versão, tenant/sujeito, identidades, base/detail,
modo, origem/destino e seletor imutável snapshot/predecessor. expected_revision é autoridade
somente na conversão privada de legado. Input e limites da primeira vertical estão em E2.1.
Edge autentica/adapta; transação revalida membership/papel, tenant, FKs, atividade e contrato.

1. Validar autorização/integridade/identidade; replay durável antes de CAS.
2. Reservar identidade com unicidade transacional, bloquear sujeito, verificar snapshot,
   cabeça e origem. Dependência desconhecida não autoriza state.
3. Persistir base+detail e efeito: STATE_APPLIED, HISTORY_ONLY, HISTORY_CONFLICT,
   PROJECTION_CONFLICT, PENDING_CAUSAL_DEPENDENCY ou LEGACY_HISTORY_UNCLASSIFIED.
4. Efeito elegível atualiza projeção/versão no mesmo commit (lote inclui occupancy).
   Constraint no efeito desfaz todo sub-bloco de projeção e registra conflito no commit
   externo com fato/detail preservados. Falha de infraestrutura antes do commit desfaz
   tudo; não devolver APPLIED sem commit.
5. Persistir resultado/identidades/auditoria. Conflito de negócio é resultado durável,
   não exception que desfaz fato válido depois de inserido.
6. ACK+obrigação local durável+pull de snapshot/classificação. Sem elevar expected_revision
   nem reconstruir pelo relógio. Resolve_projection é comando novo, explícito e auditado.

Metadados mínimos futuros: ledger tenant/sujeito/Evento/identidades/digest/contrato/resultado/
efeito/cabeça/versão/revisions antes-depois/ator-motivo; token dedicado por sujeito; decisão
vinculada de resolução. São suporte técnico de projeção, **não histórico paralelo**.
Checkpoint de ativação preserva state existente com proveniência legada, sem inventar
Evento vencedor. Novas estruturas exigirão evolução forward-only local/remota autorizada.

Menor incremento animal = command+ledger+dependência durável+adapter+token especializado+
resultado/pull, preservando revision genérica e reutilizando fila existente. Incremento lote
exige seu próprio token+occupancy no mesmo boundary. Não
declarar ambos resolvidos entregando só animal. Cutover/enforcement/legado integram o patch,
não são dívida opcional. Sem refatoração geral, trigger temporal ou dependência nova prevista.

Arquivos potencialmente afetados em execução futura, **não modificados nesta etapa**:

- src/lib/events/types.ts, buildEventGesture.ts, validators/movimentacao.ts.
- src/lib/offline/types.ts, ops.ts, syncWorker.ts, pull.ts, tableMap.ts; db.ts somente se necessário.
- supabase/functions/sync-batch/index.ts, adapter de domínio novo e testes focados.
- Migration forward-only nova para boundary/ledger/token/enforcement, após escopo explícito
  e skill de banco; nenhuma criada agora.
- src/lib/pastos/pastoOcupacoes.ts, componentes de manejo e consumidores occupancy somente
  para opt-in novo e exibição de pendências/correções.

## 11. Validações e evidência

O teste anterior tinha quatro casos: worker/Dexie com ACKs mockados em E2.1/E2.2, helper de
replay em E2.3 e apenas identidades em E2.6. Comentários não eram execução de concorrência.
Removidas alegações não exercitadas e ampliado o mesmo arquivo.

| Cenário | Evidência executada | Limite |
| --- | --- | --- |
| Evento APPLIED + state CONFLICT | E2.1/E2.2: rollback, fatos, rejeição, obligations | ACK Edge fixture, sem commit remoto |
| Lost ACK + replay | E2.3 helper; E2.8 falha transporte/reenvio idêntico/revision original/DONE | Replay remoto APPLIED simulado |
| Pull após partial success | E2.9 pullDataForFarm real+Dexie, query Supabase mockada | Revision remota 6, lote divergente preservado; sem servidor real |
| Dois Eventos/conteúdo igual | E2.6/E2.7+crossDeviceCausalIdentity | Sem dedup local; sem devices físicos |
| Fora de ordem | E2.7 T2 antes de T1 | CAS fixture, command novo inexistente |
| Clock +55/-55 | E2.7 envelope/matcher só revision | Não executa CAS remoto |
| Mesmo occurred_at | E2.7 envelope/terminalidade | Não testa sequenciador futuro |
| Farm switch | E2.10+reconciliationObligations | Drain por fazenda, sem ampliar certificação |
| Lote→pasto sem CAS | E2.11+mudarPastoLote | Builder/queue/matcher reais; sem concorrência PostgreSQL |
| Cliente legado | E2.12 missing revision | Não existe adapter novo |
| Correção | E2.13+auditoria schema/occupancy | UPDATE comum, resolvedor novo ausente |
| Crash/restart obligation | Suíte reconciliationObligations existente | Retomada lógica; sem kill real |

```powershell
pnpm test -- src/lib/offline/__tests__/movementEventStateConvergence.characterization.test.ts src/lib/offline/__tests__/reconciliationObligations.test.ts src/lib/offline/__tests__/crossDeviceCausalIdentity.characterization.test.ts src/lib/events/__tests__/mudarPastoLote.test.ts
```

Resultado observado: **4/4 arquivos, 50/50 testes passaram**: E2 14, obligations 17,
identidade causal 5, lote→pasto 14. Logs de rede falha são fixtures esperadas.
Prettier somente no teste alterado. Inspeção final: status untracked, diffs tracked/staged,
diff --check e whitespace dos dois untracked. `pnpm run gates:docs` passou (headers,
continuidade e auditoria de governança). ESLint focado no teste terminou com exit code 0.
Após fortalecer E2.7 com destinos distintos e confirmar ausência de reenvio do conflito
terminal, o arquivo E2 foi reexecutado: 14/14 testes passaram; demais suítes não foram
repetidas porque não mudaram. Os dois untracked foram também verificados com
`git diff --no-index --check -- /dev/null <arquivo>`; removidos espaços finais do cabeçalho.

Não executados regressão global/build/E2E remoto/banco real/devices físicos/validação funcional
Supabase, pois sem runtime/banco. Nenhum teste implementa decisão futura inexistente.

Antes de implementação/ativação: PostgreSQL e Auth→Edge→RLS→PostgreSQL focados em A/B real,
falha entre base/detail/projeção/ledger, replay após outro vencedor, identidade divergente,
origem/tenant/tombstone, T2→T1 com/sem causalidade, skew/empates, correções cabeça/ancestral/
ramificação, lote/occupancy com falha/datas inválidas, legados completos/incompletos/parciais/
missing revision-token, direct-write bypass/cutover. Cliente: restart/farm switch/ACK
desconhecido e nova intenção explícita stale.

## 12. Riscos residuais e próximo passo

1. Ambiguidade factual: sem causalidade/evidência confiável, clock não determina ordem física.
   Conflitos reais e cadeias legadas sem vínculo podem exigir decisão humana; datas de occupancy
   requerem correção/limitação explícita.
2. Compatibilidade/cutover: fragmentos antigos sem prova de efeito não ganham autoridade
   inventada. Adapter/ledger/enforcement/checkpoint e rejeição explicada exigem validação,
   preservando writers de cadastro/comercial.
3. Gap ainda em runtime: MODEL_E, lote sem CAS e correções sem resolvedor persistem.
   Nova transação/ledger ainda inexistentes e sem certificação PostgreSQL.

Próximo passo: revisar contrato definido e delimitar execução posterior de banco/adapter/cliente
com os critérios acima. Design definido não fecha F24.4E nem remove G3 no produto.

## 13. F24.4E2.1 — Movement Domain Command Contract

### 13.1 Escopo, baseline e problema

**PROPOSED_CONTRACT = DEFINED; RUNTIME = NOT_STARTED.** Primeira vertical futura:
Animal→Lote. Esta seção congela somente causalidade offline e concorrência de localização.
Preserva a arquitetura A, as fontes históricas e a ausência de autoridade do clock.
Lote→pasto, occupancy, resolvedor de correção/resolução e E3/F não entram na implementação
desta vertical. Desenhos dessas extensões nas seções anteriores permanecem propostas.

Em E2.1 foram novamente observados branch/HEAD/origin/main da seção 1, após fetch.
Entrada desta execução: três apontadores ativos tracked modified, este documento e o teste
untracked, staged vazio; alterações produzidas na etapa E2 anterior foram preservadas.
Esta execução altera somente este documento e o teste de characterization existente.
Os três apontadores não precisam de nova alteração: E2 já estava DESIGN_CONTRACT=DEFINED.

**CURRENT_BEHAVIOR:** A→B e B→C offline podem capturar a mesma revision remota. A primeira
aplicação tornaria a segunda stale pelo CAS atual. Uma edição de nome também avança essa
revision, embora não altere localização. Resolver ambos buscando current_revision apagaria
a distinção entre sucessão legítima e arbitragem silenciosa de concorrentes.

### 13.2 Auditoria de identidade e dependências existentes

| Mecanismo atual | O que representa | Expressa T2 predecessor T1? |
| --- | --- | --- |
| event_id conceitual / eventos.id / detalhe.evento_id | Identidade estável do fato; builder aceita eventId ou cria UUID | Identifica T1, mas não contém vínculo causal |
| client_tx_id / gesture | Agrupa ops de um gesto; createGesture pode preservar identidade fornecida | Não entre gestos distintos |
| client_op_id | Identidade de cada mutação/envelope e replay | Não; state é uma op distinta da base/detail |
| source_task_id | Proveniência da intenção Agenda | Não é ordem factual ou predecessor de movimentação |
| corrige_evento_id | Referência de correção factual | Não; usá-la para sucessão mudaria sua semântica |
| op_order | Índice emitido por createGesture; compareOpsForSync ordena operações | Ordem interna do gesto, sem causalidade entre Eventos |
| before_snapshot / expected_revision | Snapshot otimista e revision remota capturada | Não; snapshot pode conter lote otimista com revision antiga |
| dependencies / BLOCKED_DEPENDENCY | Regras específicas e estado de processamento | Não há resolvedor de cadeia de movimentação no caminho auditado |

Evidência: `src/lib/events/types.ts` (BaseEventInput/MovimentacaoEventInput),
`buildEventGesture.ts`, `src/lib/offline/types.ts` (Operation), `ops.ts`
(createGesture/persistExpectedAnimalRevision), `syncOrder.ts` (compareOpsForSync),
`syncWorker.ts` (isOperationReadyForSync/buildTerminalBlockedDependencyClassifier),
`syncReconciliation.ts` (planOperationReconciliation) e
`supabase/functions/sync-batch/inventory-dependency.ts`.
Há dependência reprodução detalhe→sua própria base e dependência sanitária especializada;
nenhuma prova T2→T1 de movimentação. BLOCKED_DEPENDENCY por si só não define essa relação.

### 13.3 Decisão causal: seletor imutável, não refresh de revision

Nomes conceituais comparados: previous_movement_event_id seria claro para a cadeia, porém
um campo opcional junto a expected_location_version permitiria inputs contraditórios.
expected_projection_head sozinho não diferencia predecessor ainda pendente de cabeça
remota já confirmada. **Escolha: união discriminada movement_base**, com uma só autorização
de efeito por comando. Não reutilizar source_task_id, corrige_evento_id ou domain_op_id
especializado de outro domínio.

```text
movement_base =
  { kind: snapshot, movement_version: <decimal string>, head_event_id: <UUID|null> }
  | { kind: after_movement, event_id: <UUID do predecessor>, command_digest: <digest do input original dele> }
```

Snapshot vem de pull/resultado canônico confirmado. Token começa em 0 no checkpoint de
ativação por animal; cabeça null significa ausência de vencedor factual conhecido nesse
checkpoint. Não criar Evento vencedor retroativo. O token é monotônico servidor, nunca
incrementado/estimado pelo cliente. String decimal evita perda de precisão no transporte.

T1 recebe snapshot confirmado. T2 nasce com after_movement(T1), T3 com after_movement(T2),
incluindo o digest do comando pai persistido offline. A versão contratual define a mesma
normalização/digest no cliente e servidor; digest não é segredo nem credencial.
O seletor é persistido antes do enqueue, no mesmo gesto local; crash/restart/farm-switch
não o substituem por snapshot posterior. Um gesto novo sobre estado otimista de movimento
pendente deve referenciar esse predecessor, inclusive se o ACK dele está desconhecido.
Sem predecessor identificável não converter lote otimista em snapshot confirmado: impedir
efeito automático até obter snapshot ou decisão explícita. Legado continua na regra 13.9.

Sob lock, after_movement só é elegível se:

1. O predecessor possui decisão automática STATE_APPLIED, na mesma fazenda e animal,
   com token de saída conhecido e proveniência canônica. Seu digest original é exatamente
   o command_digest referido pelo filho; identidade reutilizada com outro input não serve.
2. from_lote_id do filho é exatamente to_lote_id do predecessor, incluindo null explícito.
3. Cabeça atual é o Evento predecessor e movement_version atual é exatamente o token
   de saída **gravado na decisão dele**; nenhum movimento/invalidação interveniente ocorreu.
4. Origem persistida, autorização, atividade e tombstone satisfazem os mesmos guards do root.
5. Não há autoreferência/ciclo, referência a correção como sucessor operacional ou outra
   relação incompatível com o sujeito/modo. Validar ciclos também em dependências pendentes.

Isso prova encadeamento do comando declarado e aceito, não a ordem física independente
da declaração factual do usuário. client_id/dispositivo não é credencial nem prova de
causalidade. Identidade+decisão servidor+head/token validam o vínculo; conteúdo/hora não.
Resolver token de saída do predecessor é execução do input original, não pegar token atual
para reviver um perdedor. Relação imutável é incluída no digest de identidade.

```ini
MOVEMENT_CAUSAL_IDENTITY = FAZENDA_ANIMAL_EVENT_ID
MOVEMENT_PREDECESSOR_REFERENCE = MOVEMENT_BASE_AFTER_MOVEMENT_EVENT_ID_AND_ORIGINAL_COMMAND_DIGEST
OFFLINE_SUCCESSOR_POLICY = APPLY_ONLY_FROM_ACCEPTED_PARENT_OUTPUT_TOKEN_AND_CURRENT_HEAD
MISSING_PREDECESSOR_POLICY = DURABLE_SERVER_PENDING_NO_STATE_NO_CLIENT_LIVENESS_REQUIREMENT
FAILED_PREDECESSOR_POLICY = TERMINAL_NO_EFFECT_PRESERVE_VALID_CHILD_FACT
CAUSAL_REPLAY_POLICY = ORIGINAL_RECEIPT_BEFORE_CAS_NEVER_REBASE_CHILD_SELECTOR
```

### 13.4 C1–C6: efeitos, espera e retomada

| Caso | Contrato definido |
| --- | --- |
| C1 A→B→C | T1 snapshot(v,h) aplica e grava (v+1,T1). T2 after_movement(T1) usa exatamente essa saída; aplica se ainda vigente. Rename entre ambos não invalida o token especializado. |
| C2 A→B versus A→C independentes | Ambos snapshot(v,h), sem vínculo. Um efeito aceita CAS; outro PROJECTION_CONFLICT. Ambos os fatos válidos permanecem. Filhos irmãos do mesmo predecessor também disputam um único efeito. |
| C3 T2 antes de T1 | Evento+detail+receipt PENDING_CAUSAL_DEPENDENCY+trabalho durável no servidor, sem efeito. Após decisão de T1, retomar no mesmo comando/boundary; não exige app aberto. |
| C4 T1 não elegível/rejeitado | Decisão acessível de rejeição, HISTORY_ONLY, HISTORY_CONFLICT ou PROJECTION_CONFLICT termina efeito de T2 com PREDECESSOR_NOT_STATE_APPLIED. Digest do pai divergente também impede efeito, mesmo se existir outro comando aceito sob o mesmo event_id. Origem inválida de T1 não autoriza filho por destino coincidente. Fato válido do filho permanece. |
| C5 commit T1 / lost ACK / restart | Replay T1 devolve receipt original, mesmo após outros commits. T2 mantém after_movement(T1); aplica apenas se saída de T1 ainda é vigente, senão conflito terminal. |
| C6 A→B→C→D e além | Repetir a mesma regra por aresta. Drain iterativo com limite de trabalho por transação e continuação durável; sem regra especial para duas etapas. |

Tenant inválido, animal inexistente ou identidade divergente podem impedir até o fato de
T1: não inserir fato inválido para satisfazer dependência. Rejeição autenticada no tenant
permitido pode ter receipt negativo sem fato. Não escrever nem revelar ledger de fazenda
sem autorização. T2 que também referencia animal inexistente é REJECTED, não fato válido.
Referência de outro sujeito/ciclo detectáveis no tenant é inválida; fato próprio válido
pode permanecer com HISTORY_CONFLICT/INVALID_CAUSAL_RELATION e nenhum efeito.
Referência inexistente ou inacessível de outro tenant não revela existência/resultado:
fica missing/pending, nunca efeito automático por fallback. Orfandade requer ação explícita;
timeout sozinho não transforma pendência em autorização de state.

Servidor mantém trabalho de dependência transacional e retomável após crash. Processador
interno revalida autorização do ator original/membership, tenant e elegibilidade, não usa
service_role como autorização de domínio. Recepção do pai sinaliza filhos; varredura
durável recupera sinal perdido. Locks por sujeito e ordem estável de intake servidor para
irmãos pendentes (sequência persistida, não hora/UUID cliente) evitam desempate indeterminado.
Não é ordenação factual nem prioridade de occurred_at. Relações ilegais/ciclos são terminais;
pai ausente permanece consultável. Worker/retries servidor são futuros, não existentes.

### 13.5 Revision × versão: escolha R2

| Modelo | Segurança/ABA | Cadastro concorrente | Legado/replay | Decisão |
| --- | --- | --- | --- | --- |
| R1 revision+origem+head | Seguro sob lock; revision detecta ABA | Rename provoca falso conflito | Preserva E1; replay antigo ainda exige ledger durável | Manter no genérico e conversão legado, não novo comando |
| R2 movement_version+origem+head+elegibilidade | Token monotônico e invalidação crítica detectam ABA | Nome/observação não invalidam movimento | Novo ledger preserva ACK; legado não ganha token fabricado | Escolhido para novo Animal→Lote |
| R3 revision genérica E token especializado | Seguro, mas mantém conflito falso de R1 | Rename ainda bloqueia | Mais metadados sem resolver problema | Rejeitado |
| R3 somente origem/head ou clocks/vetor cliente | Valores/head podem voltar; não detecta ciclo de status | Falta freshness crítica | Sem contrato existente que justifique vetor | Rejeitado |

`movement_version` é o nome escolhido para o token de localização **e elegibilidade de
movimentação**. location_version puro esconderia a invalidação necessária por status.
Token/cabeça/ledger são infraestrutura técnica; animais.lote_id continua current state e
Evento+detail continuam histórico. Não há segunda tabela factual nem merge de campos.

Quem cria/incrementa: exclusivamente servidor, na mesma transação que altera localização
ou tuple crítico `(lote_id, status, deleted_at)`. Todo writer permitido deve respeitar isso,
inclusive venda/morte/retirada/restauração e legado. Uma transição aceita incrementa uma
vez, mesmo se mudar vários campos críticos; o comando não soma de novo sobre mecanismo de
invalidação. Mudança crítica sem movimento incrementa token e mantém head; não fabrica fato.
Novo efeito de localização grava também a cabeça. Não resetar contador após correção/ABA.
Alteração explícita de cabeça por resolução futura também deve invalidar token.

Futuro enforcement servidor deve cobrir todos os writers e impedir atualização de localização
fora da boundary autorizada. Um hook de invalidação por mudança real de campos pode compor
esse enforcement; **não é trigger de projeção por occurred_at e não foi criado nesta etapa**.
Nome/observação/cadastro sem mudança crítica avançam apenas revision genérica. Replay,
INSERT factual sem efeito, rejeição, pendência e consulta não incrementam token.

Contrato genérico E1/F24.4C intacto: revision aumenta em todo UPDATE e continua obrigatório
no CAS genérico de UPDATE/DELETE animais. Uma movimentação aceita também é UPDATE, portanto
avança revision a partir do valor servidor atual. O novo comando atualiza apenas localização
e metadados de efeito, nunca reaplica registro cadastral inteiro capturado offline.

**CAS exato do novo comando**, resolvido sob lock da linha animal e com destino protegido
contra mudança concorrente durante a validação:

```text
animal.id = subject_id
AND animal.fazenda_id = fazenda_id
AND animal.movement_version = resolved_original_movement_base_version
AND animal.projection_head IS NOT DISTINCT FROM resolved_original_head_event_id
AND animal.lote_id IS NOT DISTINCT FROM from_lote_id
AND animal.status = 'ativo'
AND animal.deleted_at IS NULL
AND authorized_actor_and_active_tenant_membership
AND destination_lot_same_tenant_active_not_deleted
```

Snapshot resolve sua própria versão/head; after_movement resolve a saída imutável do pai.
Não há AND animais.revision no novo lane R2. Destino Animal→Lote é lote interno não-null;
remoção/venda/óbito não entram como destino null desse comando. from null é válido para
animal ativo ainda sem lote, desde que snapshot/head/token correspondam. Destino distinto
da origem; validar FKs e domínio antes de persistir. Elegibilidade crítica é status ativo,
animal não tombstonado e destino ativo/não tombstonado; nenhum guard apenas na UI.

```ini
ANIMAL_GENERIC_REVISION_AUTHORITY = EXISTING_SERVER_REVISION_CAS_UNCHANGED
MOVEMENT_LOCATION_VERSION_AUTHORITY = SERVER_MONOTONIC_MOVEMENT_VERSION_PER_FARM_ANIMAL
MOVEMENT_CAS_PREDICATE = PK_TENANT_TOKEN_HEAD_ORIGIN_ACTIVE_NOT_DELETED_AND_AUTHORIZED_DESTINATION
ABA_PROTECTION = NEVER_RESET_TOKEN_INCREMENT_ON_LOCATION_OR_CRITICAL_ELIGIBILITY_CHANGE
NON_LOCATION_UPDATE_EFFECT_ON_MOVEMENT = NONE_UNLESS_CRITICAL_STATUS_OR_TOMBSTONE_CHANGES
CRITICAL_STATUS_REVALIDATION = LOCKED_SAME_TRANSACTION_ACTIVE_ONLY_AND_TOKEN_INVALIDATION
TOMBSTONE_REVALIDATION = LOCKED_SAME_TRANSACTION_DELETED_AT_NULL_AND_TOKEN_INVALIDATION
```

| Caso | Resultado proposto |
| --- | --- |
| R-A nome mudou, lote/head/token iguais | Movimento não conflita por rename; preservar nome atual. Revision genérica avança no UPDATE aceito. |
| R-B vendido/morto/retirado/tombstone | Sem efeito automático; PROJECTION_CONFLICT com motivo de inelegibilidade/token. Revalidar na transação, inclusive processamento de pendência. |
| R-C outro movimento venceu | Token/head divergem; PROJECTION_CONFLICT, sem rebase. |
| R-D A→B→A | Token avançou duas vezes; snapshot do primeiro A rejeitado mesmo com origem novamente A. ativo→vendido→ativo também invalida token duas vezes. |
| R-E cadastro depois de movimento aplicado | Replay consulta ledger antes de olhar state; receipt antigo, zero novo UPDATE/efeito. |

“Inativo” é conceito de inelegibilidade no enunciado; AnimalStatusEnum auditado contém
ativo/vendido/morto/retirado, não inativo. Não adicionar enum. Se outra condição crítica
entrar no domínio futuro, revisar explicitamente tuple/guards, sem inferência silenciosa.

### 13.6 Input mínimo conceitual

`apply_movement_operation` é nome conceitual, não função disponível. Novo envelope:

| Campo | Obrigação e finalidade |
| --- | --- |
| contract_version | Versão explícita do contrato Animal→Lote; versão desconhecida rejeitada de forma versionada |
| fazenda_id, subject_type=animal, subject_id | Tenant e animal; eventos.animal_id deve corresponder |
| event_id | Identidade factual estável; eventos.id e detalhe.evento_id |
| client_tx_id, client_op_id | Gesto e comando estáveis; aliases client_op_ids de base/detail/state no adapter legado |
| movement_mode | operational ou history_only na primeira vertical; não inferir modo por timestamp |
| from_lote_id, to_lote_id | Origem explícita nullable e destino interno não-null; detalhe factual |
| occurred_at | Input factual/proveniência; nunca guard de winner |
| movement_base | Obrigatório em operational; exatamente snapshot OU after_movement. Ausente em history_only |
| source_task_id, corrige_evento_id, observacoes, payload | Opcionais quando houver proveniência/conteúdo factual; nunca causality fallback |

Não expor legacy_revision como opção livre a clientes novos. Conversão privada legado usa
expected_revision capturada, sem exigir novo token que o cliente antigo não possui.
Não adicionar domain_op_id redundante: event_id identifica domínio, client_op_id transporte.
Base.lote_id/contexto factual legado é preservado e validado no adapter; não é estado atual.
Campos/tokens desconhecidos/inconsistentes não autorizam state.

Correção mantém D5: corrige_evento_id não é predecessor. Na primeira vertical, correção
factual em history_only é preservada com referência tenant/sujeito/ciclo validada, sem state.
Pedido de efeito de correção recebe HISTORY_CONFLICT/CORRECTION_EFFECT_NOT_IN_VERTICAL,
preservando fato válido. Resolver cabeça/ancestral corrigido exige extensão explícita D5;
não implementar resolvedor de correção ou resolve_projection nesta vertical.

### 13.7 Resultados e persistência

Classificação de domínio é distinta dos ACKs por op. Estado abaixo é **semântica proposta**:

| Resultado | Evento/detail | State / token | Ledger | Retry / nova intenção / humano |
| --- | --- | --- | --- | --- |
| STATE_APPLIED | Ambos persistidos | Atualiza lote+head; token +1 e revision +1 | Receipt+decisão final no mesmo commit | Sem retry de efeito; lost ACK replay mesma identidade; sem nova intenção |
| HISTORY_ONLY | Ambos persistidos | Nenhum | Receipt final | Sem retry/nova intenção; só resolução explícita se quiser efeito futuro |
| HISTORY_CONFLICT | Ambos, se fato válido | Nenhum | Receipt final com motivo | Sem retry automático; esclarecer história/relação/correção; decisão humana se houver efeito desejado |
| PENDING_CAUSAL_DEPENDENCY | Ambos persistidos | Nenhum nesta decisão | Receipt imutável+trabalho durável | Servidor retoma automaticamente; cliente não refaz intenção; órfão pode exigir resolução humana |
| PROJECTION_CONFLICT | Ambos persistidos | Nenhum nesta decisão | Receipt final+guard que falhou | Terminal automático; pull e decisão explícita se usuário quiser resolver, nunca refresh técnico |
| REJECTED | Não inserir fatos inválidos; fatos anteriores preservados | Nenhum | Receipt negativo no tenant autorizado quando possível; sem sobrescrever identidade anterior | Corrigir input/autorização; não reexecutar identidade com payload diferente |
| REPLAY | Exatamente persistência anterior | Zero novo efeito/incremento | Consulta receipt original, replayed=true | Sem recalcular; pendência atual consultada separadamente |

REPLAY é marca ortogonal, não substitui outcome original. Falha de infraestrutura sem ACK
durável permite retransmitir a mesma identidade/input; não é PROJECTION_CONFLICT retryable.
Fato válido com animal existente porém agora vendido/tombstonado pode continuar histórico;
inelegibilidade bloqueia efeito, não apaga fato. Erros de tenant/FK/identidade estrutural
impedem inserção inválida. STATE_APPLIED só depois do commit.

Boundary permanece:

```ini
EVENT_STATE_BOUNDARY = POSTGRES_DOMAIN_TRANSACTION_FACT_DETAIL_EFFECT_DECISION_AND_DUE_STATE
```

Intake válido persiste fato+detail+receipt+efeito devido ou classificação de não efeito na
mesma transação. Pendência retorna decisão explícita, não sucesso operacional. Retomada
servidor persiste nova decisão vinculada+state devido+token+head+conclusão do trabalho em
uma transação de domínio. Limite de drain deixa continuação durável, nunca metade de efeito.
Falha entre essas escritas desfaz transação; fatos preexistentes não são apagados.

### 13.8 Ledger durável e replay após avanço

- Chave canônica única: `(fazenda_id, apply_movement_operation, event_id)`; sujeito e versão
  de contrato fazem parte do conteúdo vinculado. Aliases op_id/tx/bundle preservados;
  alias já vinculado a outra identidade é conflito. Nova event_id com conteúdo igual é fato distinto.
- Digest SHA-256 de payload canônico normalizado: tenant/sujeito/identidade/modo, base+detail
  factual, occurred_at, referência de correção e **movement_base original**; registrar aliases
  e verificar sua consistência. Excluir retry counters, tempos de transporte e campos técnicos
  servidor. Mesma identidade com outro digest não altera receipt nem fato anterior.
- Normalização versionada comum cliente/servidor: UUIDs em lowercase, timestamps válidos
  em UTC ISO, token decimal canônico, defaults opcionais explícitos e objetos JSON com
  chaves ordenadas recursivamente, sem undefined/NaN. Não incluir metadados injetados pelo
  transporte como se fossem input factual. Mesmo envelope persistido calcula o mesmo digest
  offline e no servidor; publicar essa função pura no patch futuro, com fixtures compartilhadas.
- Receipt imutável: resultado original, classificação, event_id/sujeito, motivo, seleção causal,
  head/token antes-depois, revision animal antes-depois quando conhecida, ator autenticado,
  identidades, contract_version, created_at/tempo servidor e proveniência canônica/legada.
  Valores desconhecidos legados são null explícito, nunca estimados.
- Decisão posterior de pendência é append vinculada ao receipt, com evidência do pai e
  processador/ator/motivo. Unicidade da decisão automática final impede dois efeitos para o
  mesmo comando. Expor current_effect/decision no pull/consulta, separado do receipt inicial.
- Replay retorna sempre **receipt inicial** antes do CAS, inclusive PENDING original já
  resolvido. Consulta da decisão atual informa conclusão; replay não reinterpreta ACK histórico.
  Depois de movimento/cadastro/avanço de ambas as versões, devolve mesma decisão antiga.
- Reservar identidade/unicidade sob transação; chamadas concorrentes esperam e leem receipt.
  Trabalho interno at-least-once consulta decisão final antes do CAS; crash após commit não
  reaplica state. Autorização é revalidada antes de expor receipt, sem vazamento entre fazendas.

Ledger é auditoria/infraestrutura de efeito; não substitui eventos para histórico factual.
Sem retenção que elimine identidades ainda reapresentáveis por cliente offline. Política
de compactação futura precisará preservar chave/digest/receipt, não apagar prova de replay.

### 13.9 Legado: adapter versionado sem causalidade fabricada

Agrupar exatamente farm+tx+Evento+op IDs e referências base/detail/state, antes de executar
qualquer UPDATE de localização. Bundle legado reconhecido com UPDATE é convertido em
operational no lane privado R1; não exige movement_mode que o cliente antigo não envia.
Base/detail sem UPDATE ou modo explícito não autorizam state: receipt HISTORY_CONFLICT com
motivo LEGACY_HISTORY_UNCLASSIFIED, preservando fatos válidos. Formato não reconhecido e
bundle ambíguo falham fechado; não inferir modo apenas por conteúdo ou horário semelhantes.
O adapter chama mesma boundary com lane privado R1: `expected_revision` original+PK+tenant+
origem+status/tombstone/destino sob lock. Não busca movement_version atual para autorizar;
a própria revision capturada protege freshness/ABA legado. Head/checkpoint só é observado
para auditoria; legado não declara cabeça/predecessor inexistentes.

| Situação | Conversão definida |
| --- | --- |
| Bundle completo com expected_revision | Efeito só com CAS R1 original e guards válidos; se aceito, incrementa movement_version servidor e grava head/ledger. Rename pode continuar causando conflito legado. |
| Sem expected_revision | Fatos válidos preservados; state REJECTED/STATE_EXPECTED_REVISION_REQUIRED, nenhum token fabricado. |
| Dois gestos offline antigos A→B→C | Não inferir cadeia de origem/destino, op_order, horário ou cliente; T2 pode conflitar pela revision antiga. |
| Base aplicada, detail pendente (ou ambos aplicados) | Validar PK+tenant+identidades+conteúdo exato, completar apenas partes compatíveis sem editar fato. UPDATE pendente continua no CAS R1 original. |
| Bundle fragmentado/incompleto | Guardar fragments/dependência durável ou responder bloqueio técnico explícito; não declarar Evento APPLIED só porque fragmento foi bufferizado. Nunca executar UPDATE genérico como fallback. |
| UPDATE após novo ledger / lost ACK | Devolver resultado original por aliases, zero segundo UPDATE. Fatos APPLIED não tornam state conflitante APPLIED. |
| UPDATE já aplicado antes do ledger / lost ACK | Adotar efeito legado apenas com prova positiva da identidade state op_id+tx ainda persistida na linha, destino exato e base/detail compatíveis. Não executar UPDATE novamente. |
| Linha já mudou e prova antiga de UPDATE desapareceu | LEGACY_EFFECT_UNPROVEN/PROJECTION_CONFLICT, fatos preservados; destino coincidente não prova aplicação. Resolução explícita, sem reaplicar. |

Adoção legada grava receipt com proveniência LEGACY_ADOPTED, versões históricas desconhecidas
explicitamente null; não inventa resultado canônico pretérito. Não fornece saída causal R2
para filhos: cliente novo precisa de snapshot confirmado para novo movimento. Lost ACK de
comando que já possui ledger conserva o resultado original sem essa limitação de inferência.
Identidade divergente de fragmento/alias rejeita sem modificar o fato original.

Resposta antiga mapeia base/detail efetivamente persistidos para APPLIED; state aceito/adotado
para APPLIED, conflito para CONFLICT/STATE_REVISION_CONFLICT e missing revision para rejeição
existente. Bundle incompleto usa bloqueio técnico retryable com identidades originais,
antes de haver receipt canônico do comando completo; retransmissão pode completar o intake.
Legado não declara predecessor, portanto não recebe PENDING_CAUSAL_DEPENDENCY como efeito.
Após receipt canônico, replay retorna resultado original terminal. Client novo
separa receipt/effect atual e pendência de sincronização técnica. Nenhuma mensagem promete
sucesso operacional a cliente antigo apenas porque histórico chegou.

Enforcement precisa impedir bypass por atribuição de localização Animal→Lote, preservando
writers genéricos já autorizados de cadastro/saída/status/delete e seu CAS E1. Não bloquear
cegamente toda alteração lote_id: o builder financeiro/venda já emite status=vendido+lote_id=null,
e prevalidateAntiTeleport admite essa saída com base/detalhe financeiro correlatos. Essa lane
existente deve continuar validada no servidor, invalidar movement_version uma vez e manter
a última cabeça de movimentação; não é destino null do novo comando. Não ampliar permissões
de outros domínios nem corrigir seus gaps nesta vertical. Critério de cutover inclui esses
writers e seus testes atuais. Migration/adapter/gate/cutover só na execução posterior,
com validação de filas antigas; gate desligado mantém comportamento atual e G3.

### 13.10 Menor patch posterior e arquivos potenciais

1. **Boundary servidor Animal→Lote:** metadados movement_version/head/checkpoint,
   comando+ledger/decisões+trabalho causal durável, invalidação crítica e enforcement de
   writers. Idempotência antes de CAS, drain retomável, nenhum timestamp winner.
2. **Adapter Edge versionado:** preservar aliases, lane legado R1, fragmentos/preaplicados,
   resultado por op e gate de cutover. Sem fallback de localização ao UPDATE genérico.
3. **Cliente opt-in:** capturar/persistir snapshot OU predecessor no gesto existente,
   transportar input estável e pull de token/head/receipt/decisão; reconcile sem rebase,
   restart/farm-switch preservados. Sem mudar schema Dexie se campos aditivos já bastarem.

Esse é o menor conjunto coerente, não entrega runtime nesta execução. Nenhuma etapa isolada
pode ser anunciada como G3 resolvido. Não inclui lote→pasto/occupancy nem resolver correções.
Arquivos potencialmente afetados: `src/lib/events/types.ts`, `buildEventGesture.ts`,
`validators/movimentacao.ts`; `src/lib/offline/types.ts`, `ops.ts`, `syncWorker.ts`, `pull.ts`;
`supabase/functions/sync-batch/index.ts` e adapter/testes de domínio futuros; migration
forward-only futura e writers críticos identificados no inventário. Não criar nomes de
arquivos/migrations inexistentes como se já estivessem presentes. Skill de banco somente
quando execução de banco tiver escopo concreto autorizado.

### 13.11 Validações desta execução e da implementação futura

**CURRENT_BEHAVIOR executado:** teste acrescentado ao arquivo existente usa builder,
createGesture/Dexie e mapOperationForSync reais para A→B→C→D. Observa três gestos distintos,
op_order 0/1/2 em cada gesto, revision 5 nas três ops, origem otimista sucessiva e ausência
de movement_base/previous_movement_event_id. Sem request remoto; não testa command proposto.

Comando: `pnpm test -- src/lib/offline/__tests__/movementEventStateConvergence.characterization.test.ts`.
Resultado observado nesta execução: **1 arquivo, 15/15 testes passaram**. Evidências 50/50
da seção 11 pertencem à etapa E2 anterior; não foram repetidas nesta etapa. PROPOSED_CONTRACT
é decisão documental, sem testes fictícios de RPC/migration inexistentes.

ESLint focado no mesmo teste terminou com exit code 0. git diff --check não encontrou
problemas. Checks --no-index dos dois untracked não emitiram diagnósticos de whitespace
(exit 1 corresponde à presença de diff com /dev/null). Os três apontadores ativos mantiveram
os hashes SHA-256 da entrada; staged vazio e mesmas refs/path set no status final.
Não executar novamente regressão global/build/E2E/DB remoto para este patch docs+characterization.

Validações necessárias antes de ativação futura:

- C1–C6 no PostgreSQL real: T2 antes de T1, irmãos concorrentes, pai inválido/ausente/tenant
  inacessível/ciclo, retomada sem cliente e crash antes/depois de cada commit/drain.
- R-A–R-E: rename sem falso conflito R2, status/tombstone e ABA de localização/eligibilidade,
  locks com venda/delete/destino inativo e todos os writers críticos invalidando token uma vez.
- Replay depois de cadastro/outro movimento/ambas as versões avançadas; receipt pending
  imutável e decisão final consultável; digest divergente, aliases concorrentes, fatos distintos.
- Legado completo/missing revision/fragmentado/base/detail preaplicados/UPDATE pendente,
  lost ACK com/sem prova antiga, bypass direto, cutover/gate e reversibilidade operacional.
- Cliente preserva seletor offline em restart/farm-switch, não promove optimistic snapshot,
  pull de metadados/decisões, skew +55/-55 e empate sem influência no winner.
- Auth/membership/tenant revalidados no intake e trabalho servidor, sem credenciais no cliente.

### 13.12 Riscos residuais e próximo passo

1. **G3 permanece no runtime.** Novo token, command, ledger e retomada servidor não existem;
   characterization local não certifica PostgreSQL/concorrência real. Lote→pasto segue fora.
2. **Enforcement e cutover.** Writer crítico sem invalidação ou localização fora da boundary
   quebraria freshness. Legado parcial pode perder prova de efeito antigo; não preencher
   lacuna por destino/clock nem prometer encadeamento a fila que não declara predecessor.
3. **Causalidade declarada e orfandade.** Vínculo prova sucessão operacional validada, não
   cronologia física. Pai inacessível/ausente pode permanecer pendente; conflitos reais,
   correções e ambiguidade legada exigem resolução explícita, fora desta vertical.

Próximo passo: usar este contrato congelado para delimitar e autorizar a execução posterior
Animal→Lote com as validações acima. Nenhuma implementação iniciada em F24.4E2.1.

## 14. F24.4E2.1A — Animal→Lote Server Foundation

### 14.1 Baseline e escopo autorizado

Baseline inicial real: `98b4455f67d39d94f3f2480bb7412141a5dde05d`, branch
`feat/f24-4e2-movement-event-state-convergence`; `origin/main` após fetch permanece
`040c3c0605ff4f6ecabeedec1b28c5017455f6ac` (ahead 1 / behind 0). Worktree inicial limpa,
staged vazio. O commit anterior contém somente design/characterization/apontadores.

Nova decisão explícita do usuário: LEGACY_DATA_COMPATIBILITY=NOT_REQUIRED e
LEGACY_CLIENT_COMPATIBILITY=NOT_REQUIRED. Supersede o adapter/cutover legado das seções
8 e 13.9 para esta vertical. Não criar receipts/predecessores/heads históricos artificiais.
Inicialização técnica neutra 0/null não declara vencedor factual. Não há autorização para
migration/deploy/destruição remotos. Somente migration local forward-only e banco descartável.
Cliente, builder, worker, pull, UI, lote→pasto e occupancy não são editados.

### 14.2 Inventário concluído antes da migration

| Writer real | Campos críticos | Boundary atual | CAS atual | Invalida token? |
| --- | --- | --- | --- | --- |
| sync-batch/index.ts, INSERT/UPDATE genérico | lote_id/status; envelope pode conter deleted_at | PostgREST por operação | UPDATE animais por revision | Mudança crítica sim; nova atribuição operacional direta será bloqueada |
| sync-batch/index.ts, DELETE | deleted_at (soft delete) | UPDATE PostgREST | Revision E1 | Sim |
| buildEventGesture.ts, movimentação; MoverAnimalLote/AdicionarAnimaisLote | lote_id | Fato/detail/UPDATE separados via gesture | Revision no UPDATE remoto | Sim, porém UPDATE legado será bloqueado; nova RPC é a boundary |
| buildEventGesture.ts, comercial/financeiro | status=vendido, lote_id=null | Gesture genérica | Revision | Sim, uma vez mesmo mudando ambos |
| buildEventGesture.ts, óbito | status=morto, lote_id=null | Gesture genérica | Revision; anti-teleporte existente não generalizado | Sim; não corrige outro domínio |
| apply_commercial_operation_v2, migration 20260813134853 | Compra INSERT inicial; venda status/lote_id=null | RPC transacional | Lock/snapshot comercial; sem CAS revision da venda | Venda invalida; compra inicia 0/null |
| apply_individual_animal_purchase, migration 20260808120000 | INSERT inicial status/lote_id | RPC transacional | Identidade/PK, não UPDATE | Inicialização neutra |
| AnimalNovo / animals/registration.ts; import/importV2.ts | INSERT inicial status/lote_id | createGesture → INSERT | PK/identidade | Inicialização neutra, não Evento inventado |
| reproduction/register.ts, cria | INSERT inicial status/lote_id; outros UPDATEs de cadastro/payload | Gesture | Revision para UPDATE | Só campos críticos invalidam |
| AnimalEditar | Preserva status; DELETE; edição cadastral | Gesture | Revision | Cadastro sem mudança crítica não; tombstone sim |
| trg_animais_state_revision | revision em todo UPDATE | BEFORE UPDATE | Incremento servidor | Mantido; não é autoridade do movement_version |
| trg_animais_updated_at / trg_animais_sanitario_recompute | updated_at / recompute sanitário | BEFORE/AFTER UPDATE | Não aplicável | Não escrevem tuple crítico de animais |
| PostgREST direto / service_role / FK on-delete set-null | UPDATE potencial de tuple crítico | Escrita SQL/RLS/FK | Não há CAS obrigatório no banco genérico | Trigger cobre invalidação e bloqueio de atribuição operacional |

Busca dirigida nas migrations/functions ativas encontrou somente as duas RPCs comerciais
como DML literal de animais; sync-batch usa tabela dinâmica. Pull/rollback/materialização
Dexie não são writers remotos. Outros UPDATEs observados em reprodução/sanitário/Registrar
alteram payload/cadastro, não localização/status/tombstone. Nenhum runtime fora da migration
será modificado para contornar o novo guard.

### 14.3 Autoridade escolhida

`movement_version` permanece o nome: representa validade da projeção e elegibilidade,
nunca ordem física ou revision genérica. Um único BEFORE INSERT/UPDATE guard inicializa
0/null e incrementa exatamente uma vez por mudança real de lote_id/status/deleted_at.
A RPC não incrementa o contador. Head é atualizado somente pela boundary especializada;
saída/status/tombstone genéricos invalidam token e conservam a última cabeça factual.
Mudança real de head também invalida o token no mesmo incremento, sem contador paralelo.
Papel interno sem login separa a autoridade da RPC dos callers authenticated/service_role;
nenhum GUC fornecido pelo cliente autoriza bypass. Administração de DDL é fronteira confiável,
não segurança contra administrador capaz de desabilitar triggers.

```ini
TOKEN_NAME = movement_version
TOKEN_OWNER = trg_animais_movement_projection_guard
TOKEN_INCREMENT_RULE = ONE_PER_UPDATE_CHANGING_LOTE_STATUS_DELETED_AT_OR_HEAD
HEAD_FIELD = movement_head_event_id
ANIMAL_GENERIC_REVISION_AUTHORITY = EXISTING_SERVER_REVISION_CAS_UNCHANGED
MOVEMENT_HISTORY_AUTHORITY = EVENTOS_PLUS_EVENTOS_MOVIMENTACAO
MOVEMENT_CURRENT_STATE_AUTHORITY = SERVER_DOMAIN_DECISION_WITH_LOCATION_CAS
CLIENT_CLOCK_STATE_AUTHORITY = NONE
EVENT_STATE_BOUNDARY = POSTGRES_DOMAIN_TRANSACTION_FACT_DETAIL_EFFECT_RECEIPT_AND_DUE_STATE
```

### 14.4 Schema, ledger e enforcement implementados

Única migration nova: `supabase/migrations/20261001200402_f24_4e21a_animal_lot_movement_foundation.sql`.
Não altera migration aplicada. Adiciona `animais.movement_version bigint NOT NULL DEFAULT 0`,
check não negativo, `movement_head_event_id uuid` e FK composta head/fazenda para Eventos.
Inicialização técnica neutra em registros existentes/novos; sem backfill factual ou limpeza.

`animal_lot_movement_receipts` representa decisão técnica, não histórico paralelo. PK
`(fazenda_id, command_type, event_id)`, command_type fixo `apply_movement_operation`, alias
único `(fazenda_id, client_op_id)`; client_tx_id não é único, pois um gesto pode ter várias
operações. Guarda input normalizado, digest, result/effect, reason, origem/destino, actor,
timestamp servidor, versões/head/revision antes/depois e JSON original do receipt.
FKs compostas isolam animal, Evento e lotes por fazenda. Predecessor ausente não recebe FK;
seu event_id/digest/input ficam duráveis no ledger, com índice parcial de dependências pending.

Ledger possui RLS de leitura para membros e INSERT exclusivo do executor com actor real.
Authenticated tem SELECT, sem escrita; anon/service_role não recebem grants. Triggers
proíbem UPDATE/DELETE de receipt e de Eventos/detalhes gerenciados pelo comando, inclusive
tombstone do fato. Correção não edita o original: input corrige_evento_id não nulo é rejeitado.

O guard é SECURITY INVOKER e verifica current_user, sem GUC de autorização. Bloqueia token
fornecido, head externo, mudança de PK/fazenda, atribuição de novo lote fora da RPC e hard
DELETE por API/service_role. Saídas existentes podem limpar lote somente junto de status
não ativo ou tombstone; invalidam exatamente uma vez. INSERT cadastral pode definir lote
inicial com token 0/head null. Status/tombstone não fabricam nova cabeça factual.

RPC SECURITY DEFINER pertence a `rebanhosync_movement_executor`, NOLOGIN/NOINHERIT/NOBYPASSRLS,
sem membership para authenticated/service_role/authenticator e sem CREATE no schema após
instalação. Grants mínimos e RLS existentes continuam aplicáveis. Política interna de lotes
permite o lock FOR SHARE para membro operacional, com WITH CHECK(false), sem autorizar
UPDATE efetivo. search_path fixo pg_catalog, referências qualificadas. Accessor privado
`animal_lot_movement_actor_uid_v1()` consulta auth.uid() do JWT atual; payload não escolhe actor.
O schema auth da plataforma não teve privilégios ampliados. DDL administrativo permanece
fronteira confiável; não se promete proteção contra administrador capaz de remover guards.

### 14.5 Comando, digest, replay e causalidade

RPC real: `public.apply_animal_lot_movement_v1(p_command jsonb) RETURNS jsonb`.
EXECUTE somente authenticated; autorização por UID/membership antes da leitura de replay.
Contrato v1 aceita subject_type=animal, UUIDs fazenda/subject/event/client_op/client_tx,
from_lote_id explícito (nullable), to_lote_id interno não nulo e diferente da origem,
occurred_at ISO com timezone, movement_mode=operational/history_only; source_task_id,
observacoes, payload e detail_payload opcionais. Campo desconhecido/shape inválido falha
fechado. Correção não suportada é REJECTED, sem fato/receipt. Limite de input: 64 KiB.

Seletores operacionais (exatamente três campos):

```json
{"kind":"snapshot","movement_version":"0","head_event_id":null}
{"kind":"after_movement","event_id":"<predecessor UUID>","command_digest":"<SHA-256 original>"}
```

Token é string decimal canônica para preservar bigint em transporte; history_only não usa
seletor. Normalização tipa UUIDs, aplica defaults explícitos e converte timestamp para UTC
com microssegundos. `animal_lot_movement_command_digest_v1` calcula SHA-256 do input
normalizado em UTF-8: objetos ordenados por chave COLLATE C, arrays em ordem original,
números com escala normalizada. Inclui identidades, tempo factual, seletor e ambos payloads;
não inclui horário de recepção/output. Ordem de chaves, escala numérica e representação
equivalente do fuso não mudam digest. Cliente offline ainda precisa implementar esse contrato.

Lock advisory transacional por identidade serializa replay; lotes em ordem estável são
bloqueados FOR SHARE antes do animal FOR UPDATE. Revalida tenant, origem/destino existentes,
source_task do mesmo tenant, status ativo/tombstone do animal e elegibilidade do destino.
CAS: PK + fazenda + movement_version + head null-safe + origem null-safe + status ativo +
deleted_at IS NULL. Revision genérica é auditada, não usada como CAS de localização.
occurred_at não participa da arbitragem: primeiro efeito que satisfaz CAS vence; perdedor
válido preserva fato com PROJECTION_CONFLICT, sem rebase/auto-merge.

Fato base + detalhe + UPDATE devido + decisão/receipt ficam na mesma transação PostgreSQL.
Falha estrutural no último INSERT reverte todas as escritas. Erro de infraestrutura/serialização
propaga para retry da mesma identidade. A função não executa COMMIT próprio; seu JSON calculado
em uma transação SQL explícita só é definitivo após COMMIT externo. O futuro transporte deve
emitir ACK definitivo apenas após confirmação de commit; Edge novo não foi implementado.

Mesma identidade/digest retorna JSON persistido original com `replayed=true`, antes de CAS ou
elegibilidade, mesmo após rename/movimento subsequente. Identidade/alias divergente retorna
CONFLICT/IDENTITY_DIVERGENCE sem segundo efeito. Eventos distintos nunca são deduplicados por
conteúdo. REJECTED/CONFLICT de input/identidade não produzem receipt factual novo.
Resultados persistidos: STATE_APPLIED, HISTORY_ONLY, HISTORY_CONFLICT (ciclo detectado),
PENDING_CAUSAL_DEPENDENCY e PROJECTION_CONFLICT.

Sucessor exige predecessor do mesmo tenant/animal, digest exato, destino do pai = origem do
filho e receipt STATE_APPLIED. Usa version_after/head_after do pai e exige que ainda sejam
correntes; jamais recebe token atual por conveniência. Snapshot com head não nulo precisa
de receipt aceito do mesmo animal. T1/T2/T3 construídos antes de qualquer aplicação podem
avançar A→B→C→D sem conhecer tokens futuros. Pai errado/falhado/superado não autoriza filho.

Pai ausente/pending preserva fato/detail/input e referência durável, sem state effect.
**EXECUTOR_DE_DEPENDENCIAS = NOT_IMPLEMENTED.** Chegada posterior do pai não modifica o receipt
pending original; replay continua pending. Retomada automática precisará de incremento servidor
explícito e decisão final append-only separada, sem transformar replay em nova arbitragem.
Assim, processamento fora de ordem completo e drain sem cliente não são certificados aqui.

### 14.6 Validações observadas e reprodução local

`node scripts/codex/validate-movement-server-foundation.mjs`: exit 0, **3/3 arquivos, 33/33 testes**
(24 foundation, 5 revision E1, 4 comercial v2). Runner exige Supabase local, cria banco
`f24_movement_<UUID>` descartável, copia apenas schemas public/auth/extensions e owners/ACLs,
usa pgcrypto real e instala a migration se a origem ainda não a contém. Não copia dados.
Restaura objetos da plataforma pelo administrador do container; credenciais ficam no ambiente,
sem logs/arquivos. Encerra conexões e remove somente seu banco temporário. Zero bancos desse
prefixo restantes foi observado após execução. Não houve reset do banco Supabase de origem.

| Evidência PostgreSQL real | Resultado observado |
| --- | --- |
| P1–P3: movimento/replay após rename e outro efeito/divergência | Um efeito, receipt original, divergência sem nova escrita |
| P4: duas sessões sobrepostas, login authenticator → authenticated | Segunda sessão observada em wait_event_type=Lock antes do COMMIT da primeira; um STATE_APPLIED e um PROJECTION_CONFLICT, dois fatos, token +1 |
| P5: rename de outra sessão | Revision avança, movement_version não; movimento aceita |
| P6–P8: vendido/morto/retirado, tombstone, ABA | Invalidação única e intenção stale sem efeito |
| P9: cadeia offline A→B→C→D | Digests construídos antes do intake; três efeitos aceitos |
| P10: filho antes do pai e nova sessão | Dependência durável; pai aplica, replay do filho mantém pending |
| P11–P12: tenant/outsider/FK impossível/correção | Fail closed sem fato/detail/receipt |
| Skew +55/-55, ordem invertida e mesmo occurred_at | Clock não supera CAS aceito |
| Token/head/GUC/tenant/SET ROLE/service_role/hard DELETE | Bypass relevante bloqueado; papéis API não assumem executor |
| Canonicalização, fatos distintos, immutabilidade/RLS | Digest equivalente, identidades preservadas, receipt/fatos protegidos |
| Falha injetada no último INSERT de receipt | Rollback de fato/detail/state/token/revision |

`REAL_POSTGRES_CONCURRENCY = PROVEN` somente para o cenário local P4 observado; não é E2E
novo nem prova de todas as combinações de writers. Os testes usam sessões API reais via
authenticator, não SESSION_USER postgres que poderia assumir arbitrariamente o executor.

`supabase migration up --local`: exit 0, aplicada somente a migration 20261001200402 ao
Supabase local. Consulta posterior confirmou versão, owner da RPC, SECURITY DEFINER,
search_path, ausência de CREATE no schema e ausência de membership API no executor.
Warning de AGENTS.md ignorado pelo CLI e aviso de atualização de CLI não impediram aplicação.

`$env:REBANHOSYNC_DISPOSABLE_LOCAL_DB='1'; node scripts/codex/validate-supabase-baseline-functional.mjs`:
exit 0, run_id `77e08e70`; owner/manager/cowboy/outsider, estrutura produtiva, FK composta
cross-tenant, Sanitário factual/inventário/RLS, sync-batch Edge real e partial success passaram.
Essa baseline valida os fluxos existentes após migration, não o novo transporte de movimentação.
Fixtures factuais locais do script foram preservadas: client_id baseline-functional, fazendas
`f9514f46-ac48-4e56-b528-fc472892f83d` e `99550993-e571-413f-b578-46dfd4a824af`; não remover
histórico como limpeza automática. LOCAL_RESET_USED=NO; REMOTE_DATA_CHANGED=NO.

ESLint focado nos dois arquivos JS/TS novos e node --check do runner: exit 0.
Build e regressão global não executados: nenhum runtime/build de cliente ou Edge foi editado;
validação proporcional de banco usa os três arquivos PostgreSQL e a baseline funcional.
`pnpm run gates:docs`: exit 0; headers/baselines, continuidade e data contract passaram.
`git diff --check`: exit 0. Checks --no-index dos três arquivos novos não emitiram diagnósticos
de whitespace (exit 1 indica diff contra /dev/null). Revisados tracked, staged vazio e cada
untracked: quatro documentos modificados, migration/teste/runner novos; nenhum arquivo de
cliente/Edge ou migration anterior alterado. Marcador temporário do CLI restaurado ao conteúdo
inicial, sem incorporá-lo ao patch. HEAD final igual ao inicial, ahead 1 / behind 0.

### 14.7 Limitações, review e próximo incremento

Fundação implementada e validada localmente, ainda sem commit/push/merge/deploy desta entrega.
Verification gate: **READY WITH CAVEAT**, restrito à review da foundation; validação de banco
e baseline passaram, build global não executado pela delimitação deste incremento. Não é gate
de ativação do produto nem autorização de PR/merge/deploy.
Compatibilidade legada foi explicitamente dispensada; UPDATE genérico de novo lote agora é
bloqueado no banco local. O cliente atual ainda não chama a nova boundary; G3 permanece aberto
no produto e F24.4E2 não está encerrada. Histórico legítimo pode ter classificação sem efeito,
sem compensação destrutiva. Não houve alteração de dados/infraestrutura remotos.

1. Executor de dependências/decisão final posterior ausente: pending é durável, não resolvido.
2. Edge/cliente/pull não integrados; ativação exige revisão e validação do transporte, inclusive
   ACK pós-commit e paridade do digest offline. Baseline funcional não certifica esse E2E novo.
3. Correções, lote→pasto/occupancy e todas as intercalações de writers críticos estão fora da
   evidência desta foundation; DDL administrativo continua confiável, sem proteção contra owner.

Próximo passo: review desta foundation; depois delimitar F24.4E2.1B Edge/transport integration.
Não começar E3/F24.4F nem ampliar autorização de ambiente remoto.

## 15. F24.4E2.1A.1 — Server completion gate

Atualizado em: 2026-10-01

### 15.1 Decisão e baseline

`F24.4E2.1A.1 = READY_FOR_REVIEW`, restrito à boundary PostgreSQL Animal→Lote.
Esta seção substitui as limitações de pending/cross-writers da seção 14; não fecha F24.4E2
nem G3 e não comprova transporte E2E deste comando.

```ini
repository = maresdeandrade/RebanhoSync
branch = feat/f24-4e2-movement-event-state-convergence
HEAD_initial = 07ee8b472ddb6aa76ccc28dc465a9a28ee5886ab
HEAD_final = 07ee8b472ddb6aa76ccc28dc465a9a28ee5886ab
origin/main = 040c3c0605ff4f6ecabeedec1b28c5017455f6ac
ahead = 2
behind = 0
worktree = C:/Users/mares/dyad-apps/GestaoAgro
initial_worktree = CLEAN
patch = UNCOMMITTED
PENDING_DEPENDENCY_AUTO_RESOLUTION = PROVEN_LOCAL_POSTGRES
REVERSE_CAUSAL_CHAIN = PROVEN
BRANCHED_CAUSALITY = PROVEN
DEPENDENCY_RESOLUTION_IDEMPOTENCY = PROVEN
DEPENDENCY_CRASH_ATOMICITY = PROVEN
CROSS_WRITER_LOCK_ORDER = AUDITED
MOVEMENT_VS_SALE = PROVEN
MOVEMENT_VS_DEATH = PROVEN
MOVEMENT_VS_TOMBSTONE = PROVEN
DIRECT_WRITE_BYPASS = BLOCKED
RUNTIME_EDGE_CLIENT = NOT_STARTED
CLIENT_CLOCK_STATE_AUTHORITY = NONE
AUTO_MERGE = NOT_AUTHORIZED
FIELD_LEVEL_MERGE = NOT_AUTHORIZED
REMOTE_DATA_CHANGED = NO
```

Status, branch, três commits, fetch/prune, refs, ahead/behind, worktrees e ambos os diffs
foram inspecionados antes do patch. Nenhuma alteração inicial tracked/staged/untracked.
A migration da foundation está registrada no PostgreSQL local em `20261001200402`.
Foi preservada; a evolução forward-only criada pelo CLI é
`20261002005751_f24_4e211a_server_completion_gate.sql`. O nome foi gerado pelo relógio do CLI;
a data desta execução para o usuário é 2026-10-01 em America/Sao_Paulo.
Não foram consultados nem alterados bancos remotos. Não houve commit, push, merge ou deploy.

### 15.2 Pending resolver e resultado efetivo

- `animal_lot_movement_receipts`: original imutável, inclusive o resultado PENDING e seus tokens.
- `animal_lot_movement_effect_decisions`: uma decisão terminal append-only por comando pending,
  protegida por PK composta, FK ao receipt original e trigger de imutabilidade.
- `animal_lot_movement_effective_results`: view `security_invoker=true`, com resultado original
  e resultado/token/head efetivos. Nunca recalcula replay contra a projeção atual.
- `animal_lot_movement_command_rejections`: identidade técnica terminal de comandos
  normalizados/autorizados rejeitados, sem fabricar Evento ou receipt factual. Input inválido
  que não pode ser normalizado e acesso proibido continuam sem identidade causal confiável.
- `resolve_animal_lot_movement_pending_v1`: função privada chamada pela boundary antes de
  retornar o receipt. Usa digest, sujeito, origem e seletor originalmente persistidos;
  version/head vêm do efeito aceito do predecessor, nunca do token atual como nova autorização.
  Drena iterativamente até não haver progresso, sem limite codificado de três movimentos.
- `terminalize_invalid_movement_dependencies_v1`: trigger privado em receipts/rejeições,
  SECURITY DEFINER administrativo, restrito à terminalização da subárvore de dependências
  com tenant/sujeito incompatível. Valida membership do ator na fazenda do predecessor,
  não altera animais e não expõe dados de outra fazenda nem concede autorização ao seu ator.

Somente a RPC existente recebe EXECUTE de authenticated. Resolver/helpers não recebem
EXECUTE de PUBLIC/anon/authenticated/service_role; a role executora permanece privada.
As tabelas novas têm RLS, leitura por membership e INSERT reservado à role executora;
UPDATE/DELETE são bloqueados inclusive para o administrador normal com triggers ativos.
O trigger de terminalização é uma exceção interna de INSERT técnico entre tenants,
sem qualquer escrita de state. Tests cobrem ator sem membership na fazenda do filho.

Replay continua retornando o JSON original com `replayed=true`, sem efeito/incremento novo.
A informação posterior é consultada na view. Uma bifurcação não declara vencedor factual:
a execução que satisfaz o CAS sob lock obtém o único efeito; a outra recebe conflito,
preservando os dois fatos. Não há ordenação por occurred_at, UUID ou array como autoridade.

Fact/detail/receipt do predecessor, decisão posterior, UPDATE do filho e incrementos pelo
guard pertencem à mesma transação PostgreSQL. Fault injection AFTER INSERT da decisão
abortou a chamada inteira: zero fato do pai, zero decisão do filho, state/head/tokens
anteriores intactos, fato/receipt pending preexistente preservado; retry posterior convergiu.
ACK definitivo continua exigindo COMMIT externo quando a RPC for chamada em transação explícita.

### 15.3 Testes causais

| Caso | Evidência observada |
|---|---|
| D1 | Filho durável em sessão encerrada é promovido na chegada do pai, sem replay; seletor/digest divergente permanece conflito |
| D2 | Chegada T3→T2→T1 converge A→B→C→D, version +3/head T3; cadeia reversa de oito comandos também converge; novo comando usa pai efetivo |
| D3 | Dois filhos pending do mesmo pai: exatamente um STATE_APPLIED e outro PROJECTION_CONFLICT; ambos os fatos preservados |
| D4 | Execução do pai mantém promoção sem commit; segundo processo de resolver privado espera lock real; uma decisão, version +2, sem segunda aplicação |
| D5 | Falha após decisão inserida reverte state/token/head e fato do pai na mesma boundary; pending anterior permanece; retry funciona |
| D6 | Replay após decisão e movimento subsequente retorna receipt original, sem incremento; decisão não aceita UPDATE nem escrita pelo papel API |
| D7 | Pais PROJECTION_CONFLICT/HISTORY_ONLY/HISTORY_CONFLICT/REJECTED e sujeito incompatível terminalizam efeito dependente, preservando fato válido |
| D8 | Pai conhecido cross-farm é REJECTED antes do fato do filho; pai cross-farm que chega depois terminaliza filho/neto sem state effect, mesmo com ator sem acesso à fazenda deles |

### 15.4 Inventário real de writers

Busca nas migrations ativas e catálogo local `pg_proc/pg_get_functiondef` confirmou como
writers SQL explícitos de animais: `apply_commercial_operation_v2`,
`apply_individual_animal_purchase` e `apply_animal_lot_movement_v1`.
O catálogo local ainda contém a foundation; o novo resolver foi validado no banco isolado.
Não foram encontrados outros UPDATE/DELETE SQL explícitos de animais nas migrations ativas.
Buscas nos callers abaixo auditam os writers genéricos, sem editar cliente/Edge.

| Writer | Campo crítico | Lock order | movement_version | Pode bypassar guard? | Testado concorrente? |
|---|---|---|---|---|---|
| apply_animal_lot_movement_v1 / resolver | lote_id/head | advisory de identidade/subject privado → todos os lotes de pending ainda não decidido, UUID apenas como ordem de locks FOR SHARE → animal FOR UPDATE → CAS | guard incrementa uma vez por efeito | Somente executor privado pode atribuir lote/head; caller não escolhe role/GUC | P4, D4 e cruzamentos W1–W5 |
| apply_commercial_operation_v2 venda | status/lote_id=null | lote declarado FOR UPDATE, se presente → advisory de animais em ordem estável → animais FOR UPDATE em ordem estável → UPDATE | guard invalida uma vez; não fabrica head | Não; saída pode limpar lote, não atribuir destino operacional | W2 nas duas ordens; suite comercial 4/4; cenário de lote D bloqueado antes de animal |
| óbito via buildEventGesture + sync-batch | status=morto/lote_id=null | UPDATE da linha animal; nenhum novo lote/FK de destino | guard invalida uma vez | Não | W3 nas duas ordens, SQL que a operação genérica emite; transporte novo não certificado |
| tombstone/delete via sync-batch | deleted_at | UPDATE animal com PK/fazenda/revision no caminho genérico; sem novo lote | guard invalida uma vez | Não; hard DELETE API continua proibido | W4 nas duas ordens + 5/5 state-conflict |
| cadastro via animals/registration | INSERT status/lote inicial | INSERT; FKs de lote/pais do novo registro | checkpoint zero/head null | Não pode inserir token/head; lote inicial é checkpoint permitido | Não aplicável como concorrente sobre animal já existente; constraints/guard foundation preservados |
| importação V2 | INSERT status/lote inicial | operação INSERT genérica, FKs do novo registro | checkpoint zero/head null | Não; duplicata existente não é autorização de movimento | Não, auditoria de caminho INSERT |
| compra individual RPC | INSERT status/lote inicial | advisory animal → INSERT de novo animal/FKs; não UPDATE de animal existente | checkpoint zero/head null | Não; replay não muda lote operacional existente | Suite comercial preservada; caminho individual auditado, sem nova certificação concorrente específica |
| compra RPC v2 | INSERT status/lote inicial | lote declarado, se presente → advisory animais → INSERT/FKs | checkpoint zero/head null | Não; animal existente conflita | suite comercial inclui race de compra 4/4 total |
| cria/nascimento via reproduction/register | INSERT status=ativo/lote inicial | INSERT de cria nova/FKs | checkpoint zero/head null | Não | Auditoria; não certificado concorrente neste incremento |
| outros UPDATEs genéricos de animais | lote_id/status/deleted_at | UPDATE animal; guard rejeita nova atribuição de lote antes do FK de destino | crítico invalida; rename não invalida | Não, inclusive service_role | W1 rename; P6/P7/guard foundation; 5/5 state-conflict |
| hard DELETE direto | DELETE | row lock animal | API rejeitada; administrador/DDL confiável | API não; owner pode administrar schema, fora da fronteira de ameaça | foundation direct-bypass |

Fontes inspecionadas: migrations `20260808120000_individual_animal_purchase_sync.sql`,
`20260813134853_commercial_operation_v2.sql`, foundation e completion; callers
`src/lib/events/buildEventGesture.ts`, `src/lib/animals/registration.ts`,
`src/lib/import/importV2.ts`, `src/lib/import/importV2Persistence.ts`,
`src/lib/comercial/animalPurchaseSync.ts`, `src/lib/comercial/commercialOperationCommand.ts`,
`src/lib/reproduction/register.ts`, `src/lib/reproduction/calfJourney.ts`,
`src/lib/offline/ops.ts` e `supabase/functions/sync-batch/index.ts`.
Movimentação genérica e transição de lote da calfJourney continuam sem novo adapter:
o guard bloqueia atribuição operacional direta, conforme dispensa explícita de clientes legados.

### 15.5 Lock order e cross-writer

O resolver prepara **todos os lotes dos pending ainda não decididos daquele animal** antes
do animal, além dos lotes do novo comando. Um advisory namespaced serializa os comandos
de movimento desse sujeito e estabiliza o conjunto de trabalho. Ele é distinto do advisory
comercial, que é adquirido após o lote: não se introduziu inversão nessa chave compartilhada.
Quando o resolver é chamado dentro de apply, os mesmos lotes já estão bloqueados.
Writers de saída/tombstone atualizam somente animal e não adquirem novo lote depois dele.
Compras/cadastro/nascimento inserem novas identidades, sem aplicar movimento stale a animal existente.

| Caso | Resultado |
|---|---|
| W1 movement × rename | Sessões sobrepostas, lock wait observado; rename preserva validade de localização, movimento aplica |
| W2 movement × venda | RPC comercial real nas duas ordens: venda primeiro invalida movimento; movimento primeiro seguido de venda invalida token e preserva head factual |
| W3 movement × óbito | Duas ordens com sessões sobrepostas: saída primeiro causa conflito; saída após movimento incrementa token sem fabricar head |
| W4 movement × tombstone | Duas ordens com sessões sobrepostas e mesmas garantias; tombstone não recebe movimento stale posterior |
| W5 movement × movement | P4 preservado: sessões sobrepostas, dois fatos, um efeito CAS; D4 cobre resolver concorrente |
| W6 critical writer após movement | Venda/óbito/tombstone deixam token +2, head do movimento original; sucessor stale não aplica |

Há prova adicional do lote de um descendente reverso bloqueado pela sessão de venda:
movement espera esse lote antes de lockar animal; a venda na mesma fronteira de lote consegue
lockar o animal e terminar, sem deadlock. Um fixture inicial artificialmente adquiriu D e
depois vendeu declarando A; criou inversão D→A e falhou. Foi corrigido para adquirir somente
o lote declarado pela RPC; não se apresenta a falha do fixture como prova de compatibilidade.
A auditoria de ordem real e os testes de waits são evidências complementares, não promessa
de ausência de deadlock para qualquer transação arbitrária/admin futura.

### 15.6 Validação, fatos e limites

- `node scripts/codex/validate-movement-server-foundation.mjs`: **57/57**, quatro arquivos:
  foundation 24, completion 24, state-conflict 5, comercial 4. Schema/ACL reais, banco exclusivo
  `f24_movement_<UUID>` criado e removido pelo runner; nenhum dado de aplicação copiado.
- Fault injection existe somente no banco descartável dos testes; não há flag/GUC produtivo.
- `pnpm exec eslint` dos dois testes e runner: exit 0.
- `node --check scripts/codex/validate-movement-server-foundation.mjs`: exit 0.
- Prettier dos arquivos JS/TS alterados: validado.
- Baseline funcional: **5/5**, run `caf01de6`, ambiente Supabase local já descartável da foundation.
  O comando inicial sem `REBANHOSYNC_DISPOSABLE_LOCAL_DB=1` falhou fechado antes de writes;
  repetido com a designação local existente passou. RLS/papéis/FKs e sync-batch existentes
  passaram; esta baseline usa o schema local foundation, não representa E2E do comando novo.
  A completion e suas policies foram exercitadas separadamente no banco isolado.
- Fixtures locais da baseline foram preservadas: client_id `baseline-functional`, run `caf01de6`,
  fazendas `b74577ec-6926-460e-be75-4850b71c1b95` e `a17334b5-827b-4658-ba22-df2cb1bb9732`.
  Nenhuma limpeza destrutiva do ambiente local existente foi executada.
- `pnpm run gates:docs` e `git diff --check`: **PASS**, exit 0; headers/baselines, continuidade e data contract aprovados.
- Build/regressão global não executados: não houve alteração do runtime/build do cliente ou
  Edge; a validação autorizada é proporcional aos contratos PostgreSQL alterados.

FATO CONFIRMADO: resolução durável e autônoma dos filhos válidos, decisões imutáveis, CAS,
rollback, isolamento, proteção de helpers e interferência nos cenários auditados passaram localmente.
INFERÊNCIA: a serialização e o protocolo de locks sustentam outras cadeias de mesma forma;
oito movimentos e os cenários concorrentes observados não medem carga ou todas as intercalações possíveis.

Riscos residuais e pendências reais:

1. Edge/transport, builder/digest offline, worker e pull ainda precisam da E2.1B e seu próprio
   ACK pós-commit/E2E. G3 continua aberto no produto atual.
2. O drain é síncrono na transação do pai e seu custo/tempo de locks cresce com pending do
   animal; não foi feito benchmark de backlog grande. Nenhum worker/limite fixo foi introduzido.
3. Review e integração da migration continuam pendentes; só foi aplicada em bancos isolados
   desta execução. Correções, lote→pasto/occupancy, DDL administrativo e novas ordens compostas
   de writers não estão certificados por este gate.

`REMOTE_DATA_CHANGED = NO`. Próximo passo autorizado por este resultado: delimitar
F24.4E2.1B Edge/transport integration após review deste gate; nenhuma integração iniciada aqui.

### 15.7 Patch e verification gate

Verification gate: **READY**, no escopo servidor desta missão. Tracked/staged/untracked
foram revisados; staged está vazio. HEAD final não mudou. Não houve alteração da migration
anterior, Edge, worker, builder, pull, UI ou arquivos fora dos oito arquivos do patch abaixo.

Arquivos alterados, relativos à worktree registrada no baseline:

- supabase/migrations/20261002005751_f24_4e211a_server_completion_gate.sql (novo).
- supabase/tests/animalLotMovementCompletion.test.ts (novo).
- supabase/tests/animalLotMovementFoundation.test.ts (expectativa P10 acompanha a resolução automática).
- scripts/codex/validate-movement-server-foundation.mjs (migration subsequente e nova suite).
- docs/review/F24_4E2_MOVEMENT_EVENT_STATE_CONVERGENCE.md (contrato e evidências desta subfase).
- docs/context/PROJECT_STATUS.md.
- docs/review/CURRENT_PHASE_HANDOFF.md.
- docs/review/ACTIVE_PHASE_PLAN.md.

Os checks de whitespace dos dois arquivos novos com git diff --no-index --check não
emitiram diagnóstico. Gate documental e formatting terminaram com exit 0.
Sem bloqueador local identificado no escopo. Review/integração continuam pendentes;
este veredito não autoriza operação remota nem comprova transporte do novo comando.

## 16. F24.4E2.1B — Edge / transport integration

Atualizado em: 2026-10-01

### 16.1 Decisão e baseline

`F24.4E2.1B = READY_FOR_REVIEW`, transporte local certificado; sem opt-in produtivo do cliente.
Esta seção é a referência atual de transporte e sucede a seção 15. Não fecha G3 ou F24.4E2.

```ini
repository = maresdeandrade/RebanhoSync
branch = feat/f24-4e2-movement-event-state-convergence
HEAD_initial = 4d1d21e5f95e4bea1ea29ce33b8f766c5c8230de
HEAD_final = 4d1d21e5f95e4bea1ea29ce33b8f766c5c8230de
origin/main = 040c3c0605ff4f6ecabeedec1b28c5017455f6ac
ahead = 3
behind = 0
worktree = C:/Users/mares/dyad-apps/GestaoAgro
initial_worktree = CLEAN
patch = UNCOMMITTED
EDGE_MOVEMENT_DISPATCH = PROVEN
GENERIC_FALLBACK_FOR_MOVEMENT_V1 = BLOCKED
AUTH_EDGE_RPC_POSTGRES = PROVEN_LOCAL
TENANT_ISOLATION = PROVEN
STATE_APPLIED_TRANSPORT = PROVEN
PROJECTION_CONFLICT_TRANSPORT = PROVEN
PENDING_TRANSPORT = PROVEN
LOST_ACK_REPLAY_EDGE_PATH = PROVEN
REMOTE_SINGLE_APPLICATION = PROVEN
PENDING_CHILD_PARENT_EDGE_PATH = PROVEN
SERVER_AUTONOMOUS_RESOLUTION = PRESERVED
CLIENT_RUNTIME_OPT_IN = NOT_STARTED
LEGACY_DATA_COMPATIBILITY = NOT_REQUIRED
LEGACY_CLIENT_COMPATIBILITY = NOT_REQUIRED
REMOTE_DATA_CHANGED = NO
```

Status, branch, quatro commits, fetch/prune, refs, worktrees, ahead/behind, diff e staged
foram verificados antes do patch. Não houve commit/push/merge/deploy/migration remota.

### 16.2 Transport contract

O request continua usando o envelope compartilhado de sync-batch:

```json
{
  "client_id": "<identidade existente do cliente>",
  "fazenda_id": "<fazenda autorizada>",
  "client_tx_id": "<UUID da transação persistida>",
  "ops": [{
    "domain": "movement_v1",
    "command": "apply_animal_lot",
    "contract_version": 1,
    "fazenda_id": "<mesma fazenda do envelope>",
    "subject_type": "animal",
    "subject_id": "<UUID do animal>",
    "event_id": "<UUID do fato>",
    "client_op_id": "<UUID da operação persistida>",
    "client_tx_id": "<mesma transação do envelope>",
    "movement_mode": "operational",
    "from_lote_id": null,
    "to_lote_id": "<UUID do destino>",
    "occurred_at": "<timestamp factual com timezone>",
    "movement_base": {"kind":"snapshot","movement_version":"0","head_event_id":null},
    "observacoes": "<opcional>",
    "payload": {},
    "detail_payload": {}
  }]
}
```

Exemplo conceitual, com placeholders; não cria identidades nem constitui fixture executável.
O input é plano, adicionando somente `domain` e `command` ao contrato v1 PostgreSQL.
`source_task_id` opcional e os demais campos da foundation são preservados. Selector
`after_movement` leva somente event_id e command_digest do predecessor. History-only
usa movement_base=null. Nenhum token futuro, ator, role, head arbitrário ou resultado
pretendido é aceito no envelope. A correção factual continua não suportada pelo banco.

`movement-v1.ts` valida somente discriminadores, shape, identidades, tamanho, tenant e
client_tx_id; retira `domain/command` e chama `apply_animal_lot_movement_v1(p_command)`.
Não calcula SHA, não materializa fatos/estado e não replica o CAS, elegibilidade ou causalidade.
O limite de transporte é 64 KiB; o limite SQL independente permanece em vigor.

O recognizer aceita declarações parciais de movement (domain movement_* ou command
apply_animal_lot) antes dos adapters existentes e antes da validação/writer genéricos.
Formato inválido/futuro falha fechado; um `continue` impede fallback mesmo em rejeição.
Movement não entra na prevalidação genérica anti-teleport nem no caminho service_role
sanitário. Operações genéricas antigas sem esses discriminadores não são removidas ou
adaptadas nesta subfase. O guard server-side da foundation é preservado.

Auth continua `auth.getUser(jwt)` real, membership precoce por request fazenda e RPC
com client user-scoped (Authorization do usuário), sem service_role no movement.
Tenant/transação divergentes são rejeitados antes da RPC; PostgreSQL revalida membership,
RLS e referências. Nenhuma nova identidade é gerada no Edge.

### 16.3 Result mapping

Todos os resultados por operação incluem op_id; resultados duráveis retornam o receipt
original em `canonical_result`, sem consultar ou substituir por decisão posterior.
`reconciliation_required=true` orienta a futura E2.1C tanto para projeção/fatos aceitos
quanto para desfazer intenção otimista rejeitada. Não transforma rejeição em fato.

| Resultado PostgreSQL | Status externo | retryable | terminal | reason_code | state_effect |
|---|---|---|---|---|---|
| STATE_APPLIED | APPLIED | false | true | reason original ou MOVEMENT_STATE_APPLIED | true |
| HISTORY_ONLY | APPLIED | false | true | reason original ou MOVEMENT_HISTORY_ONLY | false |
| HISTORY_CONFLICT | CONFLICT | false | true | reason original ou MOVEMENT_HISTORY_CONFLICT | false |
| PENDING_CAUSAL_DEPENDENCY | BLOCKED_DEPENDENCY | false | false | PREDECESSOR_MISSING/PREDECESSOR_PENDING do receipt | false |
| PROJECTION_CONFLICT | CONFLICT | false | true | reason original (eligibilidade/origem/CAS/predecessor) | false |
| REJECTED | REJECTED | false | true | reason original; envelope inválido tem reason de transporte | false quando retornado pela RPC |
| CONFLICT de identidade | CONFLICT | false | true | IDENTITY_DIVERGENCE original | false |
| Infra/RPC error | RETRYABLE | true | false | MOVEMENT_RPC_ERROR | não confirmado |
| Timeout/network sem ACK | RETRYABLE | true | false | MOVEMENT_RPC_UNCONFIRMED | não confirmado |
| Resposta RPC ilegível/desconhecida | RETRYABLE | true | false | MOVEMENT_RPC_RESULT_INVALID | não confirmado |

Infraestrutura retorna `commit_unknown=true` e não inventa `canonical_result`, receipt
rejeitado ou estado factual. A RPC tem timeout de 12s; o timeout não prova rollback e
não cancela/desfaz fatos possivelmente commitados. Replay da mesma identidade resolve
a incerteza. Resultado de domínio é resposta HTTP 200 por operação, não HTTP 500.
JWT inválido e falta de membership mantêm os HTTP 401/403 atuais do handler.

Pending é uma espera por decisão do servidor: `retryable=false` e `terminal=false`
devem ser consumidos explicitamente pelo worker futuro. Não reemitir child em loop;
reconciliation/pull de decisões pode terminalizar a obrigação local. O ACK histórico
não é reescrito; replay do child continua retornando seu PENDING original, mesmo promovido.
Conflito operacional nunca vira APPLIED apenas porque o fato foi persistido.

### 16.4 Identidade, digest e ACK

event_id/client_op_id/client_tx_id/fazenda_id atravessam Edge/RPC sem substituição.
O receipt normalizado pelo servidor conserva essas identidades e o ator real da sessão.
`animal_lot_movement_command_digest_v1` permanece autoridade canônica. Nenhuma
canonicalização TypeScript foi criada. O teste causal obtém o digest via PostgreSQL.

Requisito explícito da E2.1C: antes de emitir cadeias offline nunca enviadas, implementar
e provar equivalência byte/semântica do digest local com fixtures douradas PostgreSQL:
defaults/null, ordem de keys, escala numérica, Unicode UTF-8, UUIDs e timestamp UTC
com microssegundos. Não supor que JSON.stringify equivale ao canonicalizador SQL.
Um digest já retornado pelo servidor pode ser retido, mas não resolve sozinho uma cadeia
offline montada antes da primeira chamada. Isso permanece pendente, não certificado aqui.

O adapter aguarda a resposta da transação PostgREST antes de classificar o receipt.
Unit test mantém a Promise RPC suspensa e prova ausência de ACK antecipado. T1 lê state
commitado após HTTP; T3 corta efetivamente a conexão HTTP após retorno Edge e confirmação
SQL do incremento, descarta o ACK e reenvia o mesmo envelope. Zero segundo Evento,
detail, receipt, state effect ou incremento. O proxy existe somente no teste local.

### 16.5 E2E local observado

| Cenário | Resultado |
|---|---|
| T1 | Sessão Auth real → Edge → RPC → PostgreSQL: 1 Evento/detail/receipt, lote B, version=1/head=event_id; payload preservado |
| T2 | Duas requisições HTTP simultâneas; barreira SQL observa dois backends RPC em Lock antes de liberar animal; dois fatos e um efeito, outro PROJECTION_CONFLICT |
| T3 | Proxy rompe HTTP após confirmar commit; replay retornou receipt original/replayed=true; contagens e state/token iguais |
| T4 | Request child encerra antes do parent; parent provoca resolução SQL autônoma, lote C/version=2/head=child; view lida autenticada expõe decisão; replay do child permanece PENDING original |
| T5 | JWT inválido=401, outsider=403, divergência de fazenda e destino cross-farm=REJECTED; zero fato nos casos |
| T6 | Nova sessão Auth e nova requisição HTTP após outro movimento retornam receipt original, sem reaplicar |
| Fail-closed HTTP | Envelope movement parcial com table/action/record genéricos é REJECTED; zero INSERT do record disfarçado |
| History/identity HTTP | HISTORY_ONLY retorna APPLIED sem efeito; alteração de conteúdo sob mesma identidade retorna CONFLICT/IDENTITY_DIVERGENCE |

O runner exige REBANHOSYNC_DISPOSABLE_LOCAL_DB=1, valida localhost nos endpoints DB/API,
prepara somente migrations locais existentes ausentes nesse ambiente designado e recarrega
o schema PostgREST. Nesta execução a completion foi preparada no banco local; não foi
editada migration nem aplicado nada remotamente. Fixtures factuais são preservadas.

Primeiro T1 recebeu 403 transitório imediatamente após preparação/reload do schema;
os testes posteriores já passavam com o mesmo usuário. O setup agora aguarda visibilidade
autenticada da membership antes de emitir qualquer movimento, sem retry de comando/ACK.
O motivo interno daquele 403 não foi confirmado; associação ao reload é inferência.
A execução corrigida passou 11/11, incluindo 3 E2E existentes de state-conflict.

ES256/gateway: não houve o erro CryptoKey nesta execução e nenhum workaround/configuração
nova foi aplicado. O runtime local existente foi reutilizado; o handler validou sessões
reais e RLS. Isso não certifica gateway/deploy remoto.

### 16.6 Pull / reconciliation contract para E2.1C

| Superfície | Tipo / ownership | Contrato para o próximo incremento |
|---|---|---|
| animais | tabela remota, projeção server-authoritative; local state_animais | Pull existente, tokens/head servidor; preservar intents pending e impedir overwrite cego de otimista |
| eventos | tabela factual; event_eventos local | Histórico append-only e proteção de fatos pending existentes |
| eventos_movimentacao | detalhe factual; event_eventos_movimentacao local | Já pertence ao pull padrão de detalhes; preservar vínculos/composite tenant |
| animal_lot_movement_receipts | tabela técnica imutável, leitura authenticated por membership | Persistir separadamente do fato/state; PK composta fazenda/command_type/event_id; ACK original nunca muda |
| animal_lot_movement_effect_decisions | tabela técnica append-only, leitura authenticated por membership | Drain dedicado por created_at servidor + identidade estável; decisão nova terminaliza obrigação local e exige pull da projeção |
| animal_lot_movement_effective_results | view security_invoker, não tabela writable | Lookup autenticado de resultado efetivo por fazenda/event_id; leitura semântica, não cursor original de receipt |
| animal_lot_movement_command_rejections | tabela técnica de rejeição normalizada, read-only | Consultar/persistir quando necessária à reconciliação de comando sem Evento; nunca converter em histórico |
| apply_animal_lot_movement_v1 / digest_v1 | RPC-only | Escrita especializada / canonicalização pura; não são stores/tabelas de pull |

Receipt.created_at não avança quando uma decisão posterior é inserida. Portanto cursor
pela data original da view não descobre promoções tardias: usar stream/cursor das decisões
ou lookup explícito de obrigações pendentes. Nunca inferir efeito efetivo de ACK APPLIED
do pai ou reavaliar selector contra state local. Proteger tenant/farm switch, retries,
reabertura e lost ACK; qualquer store/cursor/schema novo exige desenho na E2.1C.
Não foram adicionados receipts/decisions/view/rejeições ao tableMap/pull padrão ou Dexie.

### 16.7 Arquivos e validações

Arquivos deste patch, relativos à worktree acima:

- supabase/functions/sync-batch/movement-v1.ts (novo adapter).
- supabase/functions/sync-batch/movement-v1.test.ts (novo, 24 testes).
- supabase/functions/sync-batch/index.ts (dispatch/união/exclusão dos preflights genéricos).
- supabase/functions/sync-batch/handler-order.test.ts (ordem/continue/fail-closed).
- supabase/functions/sync-batch/rules.ts (apenas união de tipo: CONFLICT já era retornado).
- supabase/tests/animalLotMovementTransport.e2e.test.ts (novo, 8 E2E reais).
- scripts/codex/validate-movement-transport.mjs (novo runner exclusivamente local).
- docs/review/F24_4E2_MOVEMENT_EVENT_STATE_CONVERGENCE.md (contrato/evidências seção 16).
- docs/context/PROJECT_STATUS.md.
- docs/review/CURRENT_PHASE_HANDOFF.md.
- docs/review/ACTIVE_PHASE_PLAN.md.

Resultados observados:

- Unitários iniciais focados: 71/71; após timeout, suite completa sync-batch **146/146 em 15 arquivos**.
- Runner movement HTTP: **11/11** (8 movement + 3 state-conflict), sem mocks de Auth/Edge/RPC.
- Runner foundation/completion PostgreSQL: **57/57**, banco isolado removido após testes.
- Baseline funcional local: **5/5**, run `2dd022c3`, RLS/papéis/FKs e Edge existentes preservados.
- ESLint nos sete arquivos JS/TS alterados, Deno check do handler/adapter e node --check do runner: exit 0.
- Deno fmt do adapter e Prettier dos testes/runner: PASS.
- Deno fmt global de index.ts: falha **preexistente**, reproduzida com `git show HEAD:... | deno fmt --check --ext=ts -`. Não houve reformatação ampla do handler.
- gates:docs e git diff --check: PASS no fechamento documental.
- Build/regressão global frontend não executados: zero alteração em src ou bundle/runtime frontend.

Fixtures sintéticas preservadas, sem tokens/credenciais em artefatos:
HTTP aprovado: fazendas `4a16e568-f18a-4af3-9750-10caa542507f` e
`009121f8-0768-4e3d-81c3-e749f5b01a6a`; client_id `movement-http-e2e`.
Primeira execução parcial: fazendas `3a758b13-b3fe-42b7-a2a7-b277cccb28a8` e
`ed7d149d-d70a-4d0e-b964-83bc83a28896`.
Baseline: fazendas `9abe595e-260f-4f51-8c3e-e67cef1fcac2` e
`1e314fa7-ef9d-4ac7-a845-037e5462a3ed`; client_id `baseline-functional`.
Não foi executada limpeza destrutiva do ambiente local existente.

FATO CONFIRMADO: transporte local autenticado, isolamento, lost ACK/replay, conflitos e
pending/autoresolução passaram pelos componentes reais; não há alteração produtiva do cliente.
INFERÊNCIA: o protocolo aplica-se a reenvios equivalentes em outras intercalações; testes
locais não provam gateway remoto, multi-device físico ou readiness do futuro worker.

### 16.8 Riscos residuais e próximo passo

1. E2.1C ainda precisa opt-in do writer, identidade local durável, equivalência do digest
   offline, tratamento de pending/terminal e pull dedicado. G3 permanece aberto no produto.
2. A certificação usa Supabase local descartável e runtime existente. Gateway remoto,
   deploy, volume de backlog/drain e todas as intercalações de produção não foram certificados.
3. Formatação Deno do handler é dívida preexistente preservada. Migration completion foi
   preparada localmente pelo runner, sem registrar uma nova operação remota; fixtures
   locais permanecem para descarte futuro explicitamente autorizado.

`REMOTE_DATA_CHANGED = NO`. Próximo passo: F24.4E2.1C Client opt-in + local persistence +
pull/reconciliation, após review do transporte. Não iniciar automaticamente o cutover.
