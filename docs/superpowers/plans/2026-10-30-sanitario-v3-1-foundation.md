# Fundação Sanitária V3.1 — Implementation Plan

> **Status em 01/11/2026:** plano executado no recorte V3.1-A/B/C; V3.2 e o bootstrap offline foram implementados sob autorizações posteriores do PO. A preparação, commits, push da branch dedicada e abertura do PR foram autorizados; merge, implantação e alteração de gates reais continuam não autorizados. As restrições de autorização abaixo registram o snapshot original de planejamento. [Evidências e limites locais](../../review/evidence/SANITARIO_V31_V32_LOCAL_20261101.json).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> Precedência nesta tarefa: somente planejamento está autorizado. Implementação depende de autorização separada; commits, execução remota, deploy e mudanças de gate não estão autorizados. Executar sequencialmente pelo método que o usuário autorizar, sem criar agentes/worktrees por rotina.

**Goal:** instalar identidade de obrigação/animal, projeção protegida de atendimento e uma fronteira sanitária única, preservando fatos e pendências, sem habilitar execução progressiva.

**Architecture:** evoluir Agenda–Evento–Animal, ledger, Dexie e fila existentes. Uma projeção de atendimento referencia fatos, sem copiá-los. Transição interna temporária impede escrita na semântica substituída; não haverá roteador operacional permanente V2/V3.

**Tech Stack:** React/TypeScript, Dexie 4, Vitest, Supabase/PostgreSQL, Edge Functions e harness Node/pg local.

**Spec:** [design V3 e simplificação V3.1](../specs/2026-10-30-sanitario-agenda-v3-design.md), aprovados pelo PO em 30/10/2026. O preflight final está na conversa desta entrega, com parecer `V3.1 APTO PARA PLANEJAMENTO`; não existe arquivo de preflight identificado para citar como documento independente.

## Global Constraints

- Um único fluxo operacional V3; não existem clientes antigos a suportar.
- Evento permanece fonte histórica; Agenda permanece intenção; Protocolo permanece configuração.
- Não descartar fatos, recibos, snapshots, filas ou ownership por inferência. Banco/stores reais não foram inspecionados.
- Preservar isolamento por `fazenda_id`, RLS, idempotência, retry, recovery e reconciliação.
- Preservar índice `ux_eventos_sanitario_agenda_primary_execution` durante toda a V3.1.
- Execução progressiva permanece desabilitada nesta fase; nenhum aumento de rollout é consequência deste plano.
- Nenhuma reabertura de I01/I02/I04, F24.6 ou entregas encerradas por associação.
- BLQ-002/003 ABERTOS; GATE-03 BLOQUEADO. Este plano não aprova implementação.
- Não editar migrations aplicadas; não criar cópia de tabelas factuais ou renomear módulos V2 apenas por estética.
- Não executar regressão global/E2E/build por rotina. Testes abaixo são futuros e não foram executados nesta atividade.

## Baseline, evidências e limite da entrega

Baseline em 30/10/2026: `codex/optimize-agent-infrastructure@762226630fb54abbf9303d6e292be85fb28c9df2`; cinco worktrees, staged vazio. Nove tracked modificados e dois untracked preexistentes. Preservar integralmente esses arquivos, em especial `src/lib/reproduction/{calfJourney.ts,__tests__/calfJourney.test.ts}` e `src/lib/testFarm/service.ts`. Worktree concorrente `c06-cas` está em `b698430`; não importar seus resultados como baseline deste checkout.

Fontes inspecionadas: [writer](../../../src/lib/sanitario/execution/sanitaryAgendaExecutionV2.ts), linhas 630/1009; [RPC factual vigente](../../../supabase/migrations/20261004210000_sanitario_sync_v2_revision_conflict_pt409.sql), linhas 90/151/228; [ledger/índices/guards](../../../supabase/migrations/20260722102038_sanitario_sync_v2_expand_foundation.sql), linhas 175/228/296/346/491; [ACL posterior](../../../supabase/migrations/20260913232253_f24_acl_forward_only_reconciliation.sql), linhas 32/51/173; [planejamento posterior](../../../supabase/migrations/20261017195545_sanitario_planning_convergence_v2.sql). A revisão do plano não comprova que essas migrations estejam aplicadas em qualquer servidor.

**Conferência desta revisão no mesmo HEAD:** gates SQL têm defaults `minimum_contract_version = maximum_contract_version = 2` (foundation SQL, linhas 271–287); o authorize compara o inteiro recebido à faixa (linhas 463–471), sem proibição estrutural do valor 3. Assim, formato 3 é representável, mas é rejeitado pelo gate padrão 2..2 quando habilitado; gate OFF o rejeita antes por desabilitação. [Edge](../../../supabase/functions/sync-batch/sanitario-v2.ts), linhas 1107–1119, faz a mesma comparação. Declarar formato 3 no cliente não atualiza nenhum gate.

O ledger cobre os seis comandos após a migration de convergência (linhas 2–4). Não confundir categoria passada ao authorize com `operation_kind` de recibo:

| Comando | Categoria de autorização SQL atual | `operation_kind` / `entity_id` do recibo |
| --- | --- | --- |
| `create_agenda` | `agenda_create` | `agenda_create` / ID da Agenda |
| `replace_agenda_animals` | `agenda_targets_replace` | `agenda_targets_replace` / ID da Agenda |
| `apply_factual_core` | `factual_core` | `factual_core` / ID do Evento |
| `close_agenda` | `administrative_closure` | `administrative_closure` / ID da closure |
| `set_automation_plan` | `agenda_create` | `automation_plan` / ID da fazenda |
| `reschedule_agenda` | `agenda_targets_replace` | `agenda_schedule` / ID da Agenda |

Os quatro primeiros consultam/gravam recibo nos corpos foundation/revision-conflict; automação e reagendamento fazem isso na convergência, linhas 39–41/69–70 e 84–85/96–97. A allowlist do authorize continua com quatro categorias por uso desses aliases, não por ausência de recibos. Fingerprints atuais dos quatro comandos iniciais usam MD5 de JSONB; os dois posteriores usam SHA-256 de payloads específicos. Preservar essas fórmulas para reconhecer envelopes históricos. A existência do ledger não prova que existam recibos/dados num alvo nem cobre automaticamente companion genérico de estoque ou RPC legada de `agenda_itens`.

**Conversão não demonstrada como necessária:** o enqueue atual compara envelope/IDs e rejeita reutilização divergente (`sanitarioV2Cutover.ts`, linhas 400–407/525–529); o backfill reutiliza identidades existentes (linhas 711–721). Isso comprova recuperação/reenvio com identidade preservada, não necessidade de converter. Não foram lidas filas/stores reais. O incremento 3 primeiro inventaria e instala recibos; somente incompatibilidade efetivamente encontrada com o formato único autoriza implementar o ramo condicional de conversão previsto abaixo.

**Decisão de recorte:** V3.1 entrega fundação preparada e caminho único nos consumidores, com novas execuções factuais de Agenda e correções que mudariam atendimento bloqueadas antes da persistência otimista. O contrato integral atual não será mantido como fallback. Se o alvo usa execução sanitária habilitada, a troca implica pausa explícita desse gesto; não aplicar remotamente sem autorização específica para essa transição. Leitura histórica e consulta de recibos continuam disponíveis. Histórico externo e planejamento mantêm sua semântica própria pela admissão única. A ausência de suporte a apps antigos não dispensa tratar envelopes já persistidos.

## Review Focus

1. ACK perdido seguido de mudança de gate/produto: recibo autenticado deve ser consultável sem executar validação de nova escrita; testar no incremento 2.
2. Complemento genérico apontando indiretamente a Evento sanitário: não contorna a admissão nem vira nova aplicação; testar nos incrementos 1/2.
3. Pendência inexistente ou já aplicada: nenhuma conversão artificial; se houver ramo de conversão comprovadamente necessário, crash com companion não duplica fato/estoque; testar no incremento 3.
4. Operação herdada de ownership UNKNOWN/MISMATCH: não atribuir ao usuário atual nem enviar; testar no incremento 3.
5. Agenda neonatal e perfil com plano sanitário: adaptar somente fronteira sanitária, preservando gesto reprodutivo e outros campos do perfil; testar nos incrementos 2/3.

## Contratos definidos para a implementação

Estes nomes/interfaces são decisões técnicas propostas pelo plano, não objetos já existentes. Arquivos novos constam do touch set; os links apontam somente para fontes existentes.

### Identidade e atendimento

- Acrescentar `obrigacao_origem_agenda_id uuid` à Agenda sanitária existente, com FK composta por fazenda para a própria tabela. Para uma Agenda nova, raiz = seu próprio ID. Continuidade futura herda a raiz. Não derivar identidade de data, produto, usuário, revisão, época ou número de aplicação.
- Acrescentar a raiz aos vínculos Agenda–Animal. Chave da obrigação individual: `(fazenda_id, obrigacao_origem_agenda_id, animal_id)`. Raiz e associação ficam imutáveis após referenciação factual; novas regras/ocorrências não reutilizam essa chave.
- Criar `sanitario_atendimentos` como projeção atual, com PK nessa chave, FK para o alvo na Agenda raiz e FK `(fazenda_id, evento_id, animal_id)` para `eventos_animais`. Campos mínimos: `evento_id`, `revision bigint >= 0`, `em_disputa boolean`, `updated_at`. Não copiar produto/dose/custo nem gerar histórico de aplicações nessa tabela.
- Ausência de linha significa atendimento ainda não reconhecido, não animal não manejado. A admissão de um Evento reconhecido e sua projeção deve ser atômica. Segundo candidato sobre a mesma chave retorna colisão; nunca usa `ON CONFLICT DO NOTHING` para aparentar atendimento bem-sucedido.
- Correção administrativa futura pode trocar a referência com revisão e resolução auditável; não implementar essa decisão gerencial em V3.1. Aplicação realmente repetida não adquire segundo atendimento automaticamente.
- Não preencher raízes/projeções de fatos históricos em massa. Agenda existente ainda sem execução pode receber raiz própria após provar ausência de fato/recibo/pendência incompatível. Ambiguidade preserva os dados e bloqueia somente sua promoção, sem descartar material.

### Primitiva transacional privada

Criar `internal_sanitario_claim_atendimento(fazenda_id uuid, origem_agenda_id uuid, animal_id uuid, evento_id uuid) returns jsonb`, `SECURITY INVOKER`, `search_path` fixado, EXECUTE apenas `service_role`.

Resultado: `{ outcome: 'claimed' | 'same_event' | 'collision', evento_id, canonical_evento_id }`. Validar FKs e que a Agenda factual do Evento resolve para a raiz informada; histórico externo sem Agenda não pode adquirir claim. Serializar a chave da obrigação com lock transacional e índice único. Mesmo Evento é idempotente; Evento diferente retorna colisão sem afirmar qual declaração é verdadeira. A função não insere Evento, não baixa estoque, não fecha Agenda e não recebe grant público. Nos testes, fatos-fixture permitem provar o mecanismo; nenhum writer operacional chama essa primitiva para nova execução de Agenda em V3.1. Para testar colisão mantendo o índice atual, usar duas Agendas-fixture com raiz compartilhada e um Evento por Agenda, sem implementar fluxo de continuidade.

### Admissão única e bloqueio de fase

- Manter o namespace físico `domain: 'sanitario_v2'` para reutilizar discriminação/fila; adotar `contract_version: 3` como formato único do aplicativo migrado. Este plano aloca explicitamente esse número; não é inferência do título V3.
- Reutilizar os seis comandos existentes e o ledger. Não criar outro ledger de sucesso nem copiar recibos. APIs internas antigas tornam-se wrappers temporários ou são revogadas após migrar callers; não ficam aceitando duas semânticas de nova escrita.
- Acrescentar a `sanitario_sync_v2_gates` o estado técnico `foundation_state` com valores `inactive`, `frozen`, `ready`, default `inactive`, e metadados `foundation_transition_id uuid`, `foundation_revision bigint default 0`, `foundation_prepared_revision bigint`, `foundation_evidence jsonb` para retomada/CAS. É barreira de transição, não autorização de produto nem dispatcher V2/V3. `ready` significa fundação instalada; **nunca** significa progressivo habilitado. Os demais gates permanecem necessários. Esses metadados são controle de transição, não fonte factual.
- Em `frozen`, negar novas escritas sanitárias de intenção/fato/correção/closure; permitir leitura e consulta autenticada de recibos. Em `ready`, permitir planejamento, cancelamento sem fato e histórico externo pelo contrato único. Nova execução de Agenda e correção de seu atendimento retornam `BLOCKED_DEPENDENCY / SANITARIO_V3_EXECUTION_NOT_ENABLED`, sem Evento, consumo ou closure. Formatos não suportados não são fallback.
- A consulta `internal_sanitario_get_receipt(actor_user_id uuid, fazenda_id uuid, operation_kind text, entity_id uuid, client_op_id uuid, domain_op_id uuid, request_fingerprint text) returns jsonb` exige `service_role`, ator, membership vigente e papel do comando solicitado; não depende de gate de nova escrita. Reutilizar a comparação de `internal_sanitario_sync_v2_existing_result`, incluindo tipo, entidade, ambos os IDs e fingerprint. Retornar `{ outcome: 'found' | 'absent', canonical_result? }`; divergência gera conflito, e falha de consulta não é `absent`. Usar o mapa dos seis comandos acima, inclusive `automation_plan` e `agenda_schedule`, sem submetê-los como novas categorias à allowlist de quatro. Retornar resultado original somente ao escopo autorizado; não expor a RPC ao cliente autenticado diretamente. Edge deriva ator do JWT e separa consulta de recibo do fluxo de nova escrita.
- Reutilizar os fingerprints V2 nos recibos antigos, conforme fórmula de cada comando; não recomputar registro antigo com a canonicalização nova. Formato 3 tem canonicalização estável de conjuntos, fazenda, ator, comando, identidades e payload; preservar a ordem quando ela tiver significado. `client_tx_id` agrupa, não substitui identidade da operação. Não criar novo `operation_kind` nem modificar a constraint de seis valores para acomodar formato 3.
- RPC factual única evolui a assinatura existente: recebe formato 3, classifica a natureza e bloqueia execução de Agenda em V3.1. Histórico externo continua `standalone_fact`, com evidência estruturada, sem claim/consumo/carência operacional inferidos. A correção de Evento ligado a Agenda é detectada pela cadeia factual, mesmo sem Agenda no envelope. Demais correções não ganham poderes administrativos pelo nome do comando.

### Guard de banco e transição

- Guardar o vínculo real à Agenda/cadeia corrigida, domínio e formato, sem confiar em campo de versão não nulo. Bloquear inserts diretos sanitários fora da RPC autorizada; bloquear também tentativa de detalhe sanitário anexado a Evento sem core apropriado.
- O caminho interno requer `current_user = service_role` e contexto transacional definido pela RPC após autenticar ator/fazenda/role. Usuário autenticado não pode obter autorização apenas enviando campos ou invocando helper. O guard deve proteger também a RPC legada `SECURITY DEFINER` que opera `agenda_itens`.
- Não bloquear Eventos de pesagem, reprodução, movimento, financeiro ou `conformidade` por associação textual. Resolução de biossegurança permanece anotação/correção desse domínio; não pode atualizar atendimento pela rota genérica.
- A migration instala guards em uma transação com locks das tabelas afetadas em ordem fixa, sem ativar nenhuma fazenda. Cada writer/RPC sanitário adquire lock advisory compartilhado por fazenda antes de ler a fase e escrever; inserts diretos passam pelo mesmo lock no trigger. Não usar apenas uma flag de UI, nem supor que outra aba deixou de trabalhar.
- Criar no incremento 2 `internal_sanitario_transition_foundation(actor_user_id uuid, fazenda_id uuid, expected_state text, target_state text, transition_id uuid, expected_revision bigint, prepared_evidence jsonb default null) returns jsonb`, somente `service_role`, exigindo ator owner/manager da fazenda. Sob lock advisory exclusivo e lock da linha do gate, ela permite somente `inactive -> frozen -> ready`; retorna estado, ID e revisão persistidos. `inactive -> frozen` grava o ID, incrementa revisão e invalida evidência anterior. Repetição do mesmo ID/resultado retorna a linha existente; ID ou revisão incompatível conflita, sem mudar estado. Não alterar outras fazendas; ausência de linha não cria gate habilitado automaticamente.
- `frozen -> ready` deve revalidar dentro da transação a evidência de preparação definida abaixo e fixar **somente nessa linha** `minimum_contract_version = maximum_contract_version = 3`, atomicamente com estado/revisão. Preservar `enabled`, rollout, allowlists, validade e demais controles: gate OFF continua OFF. Defaults globais 2..2 e gates de outras fazendas não são modificados. Formato 2 deixa de ser nova escrita aceita; recibos anteriores seguem consultáveis pela RPC própria. Nenhuma faixa permanente 2..3 é necessária. Apenas elevar o máximo não satisfaz a transição.
- Recuperação fail-closed: queda antes do commit mantém estado anterior; commit de `frozen` sem conclusão mantém novas escritas bloqueadas, mesmo após restart/timeout/perda de ACK. Ler linha autoritativa por fazenda/ID; não inferir conclusão pelo journal local. Não voltar a `inactive`, liberar por tempo decorrido nem marcar `ready` automaticamente. Se o commit de `ready` ocorreu e o ACK se perdeu, consulta/repetição idêntica retorna a revisão já persistida sem novo efeito.
- Retomada de `frozen` é explícita e autorizada: sob o mesmo ID, refazer idempotentemente apenas passos incompletos. Enviar em `prepared_evidence` `frozen_revision`, `schema_revision`, `guards_digest`, `consumer_build`, `checks` e `inventory_disposition` (sem payloads pessoais); registrar a evidência validada em `foundation_evidence` na transação de conclusão. `foundation_prepared_revision` deve coincidir com a revisão congelada. Preparação de consumidores/inventário é atestação do executor autorizado; o banco verifica os objetos/versões persistentes que consegue observar, sem alegar conhecer todos os dispositivos offline. `ready` exige a atestação atual e revalidação SQL dos objetos, faixa e revisão; evidência ausente, obsoleta, conflitante, sessão inválida ou verificação falha mantém `frozen` e produz diagnóstico. Não fazer reparo/descarte automático. Nenhuma dessas transições é executada ao criar este plano.
- Não remover o índice de primário nem mudar seu predicado em V3.1. A substituição e habilitação do writer progressivo são V3.2, depois de todos os writers adotarem a mesma admissão e a primitiva de atendimento.

## Touch set confirmado e proposto

| Responsabilidade | Arquivos existentes confirmados / criação proposta |
| --- | --- |
| Schema, integridade e guard | Criar `supabase/migrations/20261030120000_sanitario_v3_foundation.sql` (incremento 1) e `20261030121000_sanitario_v3_admission.sql` (incremento 2); confirmar ordem/timestamps livres antes de criar. Não editar migration já aplicada, inclusive em ambiente local do executor |
| Admissão Edge/recibos/consumo | Modificar `supabase/functions/sync-batch/{sanitario-v2.ts,index.ts,inventory-dependency.ts}` e testes adjacentes |
| API de domínio única | Criar `src/lib/sanitario/execution/sanitaryAdmissionV3.ts` e `__tests__/sanitaryAdmissionV3.test.ts`; adaptar `sanitaryAgendaExecutionV2.ts`, `reconciliation/sanitaryCorrectionV2.ts`, `history/sanitaryEntryHistoryV2.ts`, `infrastructure/{service.ts,executionBoundary.ts}` |
| Planejamento interno | Adaptar `agenda/{sanitaryManualAgendaV2.ts,sanitaryPlanningSyncV2.ts,sanitaryLocalAgendaManagementV2.ts}`. Geração automática/janelas reutilizam esse caminho; mudar esses callers somente se a assinatura exigir |
| Callers e limites genéricos | Modificar ramos sanitários de `src/pages/{ProtocolosSanitarios/index.tsx,Agenda/index.tsx,Eventos.tsx,AnimalDetalhe.tsx,Registrar/effects/sanitaryRpc.ts,Registrar/effects/nonFinancialFinalize.ts}` e `src/lib/events/buildEventGesture.ts` |
| Fila, persistência e recuperação | Modificar `src/lib/offline/{types.ts,sanitarioV2Cutover.ts,ops.ts,syncWorker.ts,pull.ts}`; criar `src/lib/offline/sanitaryFoundationRecovery.ts` e teste adjacente em `__tests__`. `db.ts`/upgrade e conversor somente no ramo de pendências incompatíveis comprovadas; sem novos arquivos além deste touch set |
| Leitores | Adaptar `src/pages/Agenda/useAgendaPageData.ts` e `src/lib/sanitario/history/sanitaryExecutedHistoryV2.ts`; caracterizar relatórios/carência antes de ampliar touch set |
| SQL focado | Criar `tests/codex/sanitario-v3-foundation.local.mjs`; reutilizar `pg` existente. Invocação explícita por Node, fora da descoberta automática de Vitest; não invocar harness histórico com importação/seed amplo |

Não tocar os três arquivos protegidos. Integração neonatal passa pelo draft/`createGesture` e `src/lib/reproduction/neonatalAgendaExecution.ts`; a princípio somente caracterização. Se o adaptador sanitário não bastar, interromper esse recorte com evidência antes de ampliar reprodução. `sanitaryAgendaClosure.ts` é construtor puro sem caller de produto localizado; não implementar fechamento por sua existência.

## Incremento 1 — identidade e proteção canônica, sem ativação

**Objetivo/dependência:** base transacional e barreira instaláveis; depende apenas deste plano/spec e confirmação do alvo. Nenhuma chamada remota faz parte da autorização atual.

**Arquivos/patch mínimo:** migration nova, harness SQL local e testes da primitiva. Colunas opcionais para dados existentes; constraints/FKs protegem novas referências. Grants: leitura de projeção por membership; nenhuma escrita direta `authenticated`; funções privadas somente `service_role`. Preservar índices e ACL anteriores fora do sanitário. Não acrescentar dependência.

**Interfaces produzidas:** raiz da obrigação, `sanitario_atendimentos`, `internal_sanitario_claim_atendimento`, estado `foundation_state` e `internal_sanitario_get_receipt` definidos acima. A primitiva fica sem caller operacional de execução. `inactive` preserva o estado anterior até transição autorizada; instalação aditiva não habilita V3.

- [ ] Confirmar branch/HEAD/status e hashes; comparar com baseline. Inspecionar somente diff concorrente e últimas migrations; escolher timestamp posterior sem sobrescrever arquivo.
- [ ] Escrever no harness local testes `claim_same_event_is_idempotent`, `different_events_collide`, `cross_farm_fk_is_denied`, `authenticated_cannot_claim`, `six_commands_have_matching_ledger_receipts`, `legacy_receipt_is_not_rewritten` e `existing_unique_index_still_rejects_second_primary`. Parametrizar recibos pelos seis pares kind/entidade da tabela, incluindo automação/reagendamento; comparar conteúdo, IDs, versão e fingerprint originais. Assertar contagens de Eventos/consumos inalteradas pela primitiva e referência factual correta na projeção.
- [ ] Executar RED no banco local descartável explicitamente autorizado: falhar por ausência dos novos objetos, não por indisponibilidade do ambiente. Comando futuro: `node --test tests/codex/sanitario-v3-foundation.local.mjs`.
- [ ] Implementar migration aditiva e funções de identidade/recibo/claim. O harness deve exigir `V31_LOCAL_DB_URL`, `V31_ALLOW_LOCAL_FIXTURES=1`, host loopback e database explicitamente marcado descartável; não descobrir alvo remoto, imprimir URL/credenciais, resetar ou limpar tabelas compartilhadas. Duas conexões `pg` reais para corrida; transações/fixtures próprias, sem seed de catálogo amplo.
- [ ] Provar GREEN incluindo duas conexões concorrentes, mesmo `client_op_id` com `domain_op_id` diferente e vice-versa, upgrade com fatos/recibos anteriores e histórico sem raiz. Recibo divergente conflita; uma transação abortada não deixa claim órfão. Não substituir essa prova por PGlite com auth/RLS stub.

**Aceite:** nenhuma alteração semântica do histórico; claim único e tenant-safe; replay estável; índice original presente; nenhum caminho operacional progressivo habilitado.

**Risco:** lock/FK em dados existentes e claim inválido por associação histórica inferida. **Interromper:** alvo não autorizado, dados incompatíveis ou hipótese de raiz não demonstrável; produzir relatório sanitizado, sem corrigir/descartar dados automaticamente. Essa interrupção não demanda redesenho: a política é preservar e bloquear a promoção afetada.

## Incremento 2 — fronteira única e consumidores internos

**Objetivo/dependência:** eliminar bypass e fallback sanitário; depende dos contratos do incremento 1. A ativação no alvo não ocorre só porque o patch passou nos testes.

**Arquivos/patch mínimo:** Edge/RPC/guards em uma segunda migration forward-only (`20261030121000_sanitario_v3_admission.sql`), módulo de admissão e adapters do touch set. Não reabrir a migration do incremento 1 após aplicá-la no harness. Reutilizar tabelas, seis comandos e ledger; não manter dispatcher permanente para novas operações de formato 2. `inventory-dependency.ts` só considera recibo de fato efetivamente aplicado; consulta de recibo, bloqueio de fase ou declaração não são `APPLIED` factual.

**Interfaces:** `prepareSanitaryAdmissionV3(input: { intent: 'agenda_execution' | 'external_history' | 'factual_correction'; fazendaId: string; agendaId?: string; sourceEventId?: string; clientOpId: string; clientTxId: string; domainOpId: string; payload: Record<string, unknown> }): { disposition: 'prepared' | 'blocked'; reason?: 'SANITARIO_V3_EXECUTION_NOT_ENABLED'; envelope?: SanitarioV3Envelope }`. `SanitarioV3Envelope` reutiliza a shape de envelope sanitário atual, com `contract_version: 3`; define união discriminada por comando, sem `any` para payload persistido. A função prepara/valida, não persiste nem gera novas identidades no retry.

- [ ] Escrever testes RED em `sanitaryAdmissionV3.test.ts` e `supabase/functions/sync-batch/sanitario-v2.test.ts`: `blocked_execution_writes_nothing`, `correction_resolves_agenda_through_source`, `receipt_lookup_precedes_new_product_validation`, `old_format_never_falls_back`, `cowboy_cannot_close`, `external_history_is_not_attendance`. Parametrizar os seis comandos: mesma identidade/payload retorna recibo original; divergência de kind/entidade/ID/fingerprint conflita; outsider/outra fazenda é negado; gate OFF não impede consulta autorizada nem permite nova escrita. Assertar ausência de Evento/consumo/fila para gesto bloqueado.

```ts
// Contrato do teste blocked_execution_writes_nothing; fixtures completas no teste.
expect(prepareSanitaryAdmissionV3(agendaExecutionFixture)).toEqual({
  disposition: 'blocked', reason: 'SANITARIO_V3_EXECUTION_NOT_ENABLED',
});
expect(await localDb.event_eventos.count()).toBe(before.events);
expect(await localDb.queue_ops.count()).toBe(before.operations);
expect(await localDb.state_insumo_movimentacoes.count()).toBe(before.movements);
```

- [ ] Executar `pnpm exec vitest run src/lib/sanitario/execution/__tests__/sanitaryAdmissionV3.test.ts supabase/functions/sync-batch/sanitario-v2.test.ts`; confirmar causa funcional de RED antes do patch.
- [ ] Implementar preparação única, consulta de recibo e autorização. Para `ready`, só admitir semânticas permitidas acima; para fase bloqueada, retornar motivo explícito antes do writer otimista. `primary_execution` não chega à RPC que atualmente fecha Agenda. Não marcar `APPLIED` em bloqueio.
- [ ] Adaptar Protocolos, Agenda, Registrar e Eventos. Remover fallback de nova escrita para RPC legada/inserts genéricos sanitários; complemento apontando a Evento sanitário vira intenção de correção bloqueada nessa fase, sem gerar aplicação. Mensagem mínima: “Execução sanitária indisponível nesta etapa.” Não redesenhar UX.
- [ ] Adaptar planejamento/histórico ao mesmo formato e IDs persistidos. Novo planejamento recebe raiz antes de enfileirar. Histórico externo permanece declaração documentada/declarada, sem Agenda, consumo ou atendimento automático. Não transformar resolução de ocorrência `conformidade` em execução sanitária.
- [ ] Completar guards e `internal_sanitario_transition_foundation`; testar `omitted_version_cannot_bypass`, `legacy_definer_rpc_cannot_bypass`, `generic_detail_cannot_attach_to_v3_event`, `transition_waits_for_inflight_writer`, `ready_cannot_downgrade` e `non_sanitary_insert_remains_allowed`. Acrescentar SQL e Edge: `format3_rejected_by_enabled_gate_2_2`, `ready_atomically_sets_only_target_range_3_3`, `off_gate_remains_off`, `format2_not_admitted_after_ready`, `other_farms_unchanged`. Não considerar formato 3 aceito por schema como autorização de escrita.
- [ ] Simular interrupção com duas conexões e reinício do consumidor: `frozen_commit_ack_lost_stays_frozen`, `frozen_timeout_does_not_unlock`, `stale_or_missing_evidence_cannot_finish`, `authorized_same_id_resume_is_idempotent`, `ready_ack_lost_returns_existing_revision`. Verificar zero escritas durante `frozen`, nenhuma volta a `inactive` e preservação dos gates/índice/fatos. Falha antes de commit da transição não altera a fase. Migration não muda a fase das fazendas; transição explícita serializa com todos os writers.
- [ ] Rodar GREEN dos testes anteriores, dos SQL negativos do incremento 1 e das caracterizações existentes `src/lib/events/__tests__/buildEventGesture.test.ts`, `src/pages/Registrar/__tests__/{sanitaryRpc.effect.test.ts,nonFinancialFinalize.effect.test.ts}`, `src/pages/Agenda/__tests__/createAgendaActionController.helper.test.ts` e `src/lib/sanitario/{history/__tests__/sanitaryEntryHistoryV2.test.ts,agenda/__tests__/sanitaryPlanningSyncV2.test.ts}`. Usar `pnpm exec vitest run` com esses caminhos explícitos.

**Aceite:** callers sanitários usam única preparação; nova escrita legada não é admitida; os seis comandos recuperam recibos por kind/entidade corretos; formato 3 só ultrapassa o gate de versão após faixa 3..3 no alvo, sem ativar gate OFF; `primary_execution` continua bloqueada. Interrupção em `frozen` permanece fail-closed e só retoma sob evidência/revisão válidas; papéis/fazenda e outros domínios preservados.

**Risco:** bloquear operação atual se houver gate habilitado; alterar comportamento compartilhado em Registrar/Eventos. **Interromper:** necessidade de alterar domínio não sanitário, identificação ambígua de correção ou alvo sem pausa autorizada. Não ampliar autorização por UI ou reabrir decisões do PO.

## Incremento 3 — recuperação local, leitores e fechamento técnico da fundação

**Objetivo/dependência:** convergir persistência local sem perda ou dupla entrega; depende dos recibos e barreira do incremento 2. Não inclui writer progressivo.

**Arquivos/patch mínimo:** fila/pull e módulo de recovery, leitores do touch set e testes focados. Inventário, instalação de recibos e preservação reutilizam fila, rejeições e obrigações existentes; não acrescentar store/upgrade/transformador só por haver formato 3. **Ramo condicional:** somente se o inventário autorizado comprovar envelopes pendentes que não podem ser instalados por recibo nem reenviados sem mudar contrato, e houver correspondência exata segura, implementar conversão. Nesse caso, usar próxima versão Dexie livre (última observada: 34; reconfirmar) e store `sync_sanitario_foundation_recovery`, PK `[fazenda_id+client_op_id]`, campos `owner_user_id`, `original_envelope`, `original_fingerprint`, `phase`, `successor_client_op_id?`, `receipt?`, `reason?`, `updated_at`; `phase` = `inventoried | receipt_installed | preserved | conversion_ready | converted`. Journal operacional, nunca histórico factual; nenhum novo arquivo além do touch set previsto. Sem pendência comprovada ou sem conversão segura, não criar esse ramo nem essa store; preservar eventual material ambíguo nas estruturas existentes.

**Interfaces:** `classifySanitaryRecovery(input: { ownerMatches: boolean; originalEnvelope: Operation; receiptLookup: { status: 'found' | 'absent' | 'unavailable' | 'not_covered'; canonicalResult?: Record<string, unknown> }; correspondence: 'exact' | 'ambiguous' | 'missing'; incompatiblePendingProven: boolean }): 'install_receipt' | 'preserve' | 'convert_candidate'`. Somente `found` com correspondência exata permite instalar; somente `absent` autoritativo, correspondência exata e incompatibilidade comprovada permitem candidato. UNKNOWN/MISMATCH, falha de consulta ou caminho sem ledger (`not_covered`) preservam; não inferir ausência de aplicação de uma consulta sem cobertura. `recoverSanitaryFoundation(fazendaId: string): Promise<{ reconciled: number; preserved: number; conversionCandidates: number }>` inventaria/consulta por escopo, nunca converte automaticamente. **Interface somente no ramo condicional:** `convertSanitaryRecovery(input: { fazendaId: string; originalClientOpId: string; expectedFingerprint: string; ownerUserId: string }): Promise<{ successorClientOpId: string }>` exige decisão explícita, prova registrada e barreira confirmada.

- [ ] Criar testes RED `empty_queue_requires_no_conversion_or_new_store`, `matching_receipt_requires_no_conversion`, `lookup_failure_is_not_absence`, `uncovered_legacy_rpc_is_preserved`, `lost_ack_installs_original_receipt`, `unknown_owner_preserves_without_send`, `local_fact_without_queue_is_not_synced_by_assumption`, `rejected_fact_survives_pull`. Local-only histórico é fixture realista porque `sanitaryEntryHistoryV2.ts` persiste sem fila quando sync está ausente. Fixtures de conversão não comprovam existência de pendências reais.
- [ ] Rodar `pnpm exec vitest run src/lib/offline/__tests__/sanitaryFoundationRecovery.test.ts`; confirmar RED pela regra ausente.
- [ ] Implementar classificação e inventário com contagem por comando/estado/owner, instalação de recibos e preservação do original nas estruturas existentes. Registrar decisão por caso: sem pendências = nenhum conversor/store; recibo exato = instalar; falha/ambiguidade/sem cobertura = preservar; pendência incompatível e correspondência exata comprovadas = ramo condicional. Não mudar envelope/IDs para que a recuperação atual pareça já suportar outro formato. Recibo só é instalado com identidade/tenant correspondentes.
- [ ] **Somente se o ramo for necessário:** escrever RED `proven_incompatible_pending_has_one_successor`, `crash_after_journal_before_queue_resumes`, `companion_stock_is_not_reapplied` e `superseded_original_cannot_retry`, depois implementar journal/upgrade e conversão explícita. Nova identidade sucessora é persistida uma vez, com linhagem; não trocar IDs/payload do original para fingir replay. Na mesma transação Dexie, original permanece `REJECTED / SANITARIO_V3_SUPERSEDED_FOR_RECOVERY`, journal passa a `converted` e sucessor nasce `BLOCKED_DEPENDENCY` enquanto seu gesto não puder ser admitido. Retry do original consulta journal e nega reenvio. Sem autoria, ausência de aplicação comprovada ou barreira confirmada, não converter. `agenda_execution` convertido permanece bloqueado até V3.2. Executar GREEN desse subconjunto apenas se o conversor pertencer ao patch necessário; caso contrário registrar ramo não aplicável, não implementação pendente.
- [ ] Preservar casos ambíguos para reconciliação; não inferir atendimento de `status`, estado atual, existência de produto ou `sanitary_completion_key`. Fato com ID local não UUID só pode ser candidato mediante correspondência/mapeamento explícitos auditáveis; na ausência deles, preservar, sem inventar novo fato remoto. Consultar os seis kinds do ledger conforme o comando; caminho legado sem ledger exige evidência própria, não conversão por resultado vazio. Se não houver pendências a converter, não criar journal/migração artificial.
- [ ] Adaptar worker/retry/pull: reconhecimento de formato único, retenção de evidência rejeitada e companion, consulta de recibos antes de reenvio/conversão e proteção dessas linhas contra substituição no pull. Não reusar rollback genérico de INSERT para apagar evidência sanitária. Preservar sessão expirada/farm-switch/ownership e obrigações existentes de reconciliação por fazenda; manter nomes de scopes existentes se mudar não trouxer benefício.
- [ ] Atualizar projeções: Agenda não transforma ponteiro singular em histórico completo; exibe vínculo histórico existente fielmente. Histórico sanitário continua baseado em Evento/detail/relações e não classifica material de recovery como aplicação. Não adicionar UI multievento, resultado parcial ou fechamento.
- [ ] Rodar GREEN em `sanitaryFoundationRecovery.test.ts` e testes existentes `src/lib/offline/__tests__/{sanitarioV2Worker.test.ts,sanitarioV2PullCutover.test.ts,sanitarioV2Cutover.test.ts}`, `src/lib/sanitario/{execution/__tests__/sanitaryAgendaExecutionV2.test.ts,history/__tests__/sanitaryExecutedHistoryV2.test.ts}`, `src/lib/reproduction/__tests__/neonatalExecutionV2.test.ts` e `src/pages/__tests__/{Eventos.test.tsx,AnimalDetalhe.test.tsx}`. Comando: `pnpm exec vitest run` seguido dos arquivos explícitos; não usar globs de shell ou `pnpm test` global.
- [ ] Atualizar expectativas desses testes somente onde o novo contrato muda intencionalmente o comportamento: execução/complemento passam a bloqueio explícito, não ao antigo fechamento factual. Preservar asserts de identidade, isolamento, efeitos e recuperação. Falha nova em ramo não sanitário exige diagnóstico; não apagar casos nem renovar evidência de certificação histórica com mocks.
- [ ] Revisar diff e executar lint apenas nos arquivos TS/TSX tocados com `pnpm exec eslint <arquivos>`, sem placeholder literal no comando executado; montar a lista a partir do diff do executor, excluindo alterações alheias. Executar `git diff --check`. Repetir SQL focado somente se o incremento mudou seu contrato; registrar checks já válidos.

**Aceite:** ausência de pendências comprovadas resulta em nenhum conversor/store de conversão; recibo exato é instalado sem sucessor; falha de consulta não vira ausência. Se o ramo for necessário, restart preserva original e no máximo um sucessor; nenhum consumo/fato é reaplicado localmente. Owner diferente não envia e histórico permanece fiel. Fundação pronta para revisão sem alegar execução progressiva pronta.

**Risco:** transação Dexie incompleta, pull apagando evidência e pareamento incorreto de companion. **Interromper:** shape desconhecida, operação já aplicada divergente, falta de autoria ou necessidade de descarte/reparo real; preservar e relatar o item, sem limpeza automática.

## Dados reais, autorização e validação proporcional

O plano é executável sem decidir se o banco está vazio: tratar somente o que for encontrado, por classificação determinística. Antes de aplicar ao alvo, inventário read-only separado deve contar/referenciar fatos, recibos, closures, raízes e pendências nos dispositivos em uso autorizado. Não há acesso remoto ou coleta de dados reais autorizado nesta entrega. Não exportar payloads pessoais ou segredos para evidência; registrar contagens, IDs sanitizados e hashes quando suficientes.

Para testes SQL futuros, ambiente local real precisa estar explicitamente autorizado e disponível; falta dele impede concluir integridade/RLS/concorrência. Mocks/PGlite não suprem essa prova. A execução não deve instalar dependências nem provisionar/resetar banco automaticamente. A ausência do ambiente não autoriza substituí-lo por remoto.

No fechamento da implementação autorizada, aplicar o verification gate do repositório ao diff real. Se o escopo executado exigir baseline funcional Supabase, usar o mecanismo do repositório apenas no alvo descartável autorizado; não rodar automaticamente validadores históricos de importação, regressão global, build ou E2E. Commit/push/merge/deploy continuam ações separadas.

## Separação explícita da V3.2 e incrementos posteriores

V3.2: writer por subconjunto, transação de Evento/detail/relações/claim/recibo, preservação remota de colisão sem ACK falso, efeitos por Evento, testes de grupos disjuntos/sobrepostos, substituição do índice de primário e habilitação separadamente autorizada. A implementação V3.2 deve usar a primitiva de atendimento e barreira preparadas aqui; não relaxar só igualdade de animais/CAS.

Posteriores: participação/conclusão individual, presença informativa, barreira/snapshot de fechamento gerencial, resolução administrativa de disputas, tardios e continuidade. V3.1 preserva suas invariantes e reserva a identidade; não implementa esses fluxos. Procedimento excepcional de participação irrecuperável permanece futuro e não é bypass.

## Critério de conclusão e revisão deste plano

- Três incrementos dependentes, com contratos, patch mínimo, testes e paradas definidos; nenhum plano paralelo V2/V3.
- Proteção substituta está preparada, mas índice atual permanece e execução progressiva não é habilitada em V3.1.
- Faixa 3..3 e estado `ready` são instalados atomicamente apenas no alvo autorizado; gates OFF continuam OFF. Os seis comandos têm lookup/replay verificados por seus kinds reais. Interrupção em `frozen` permanece bloqueada até retomada explícita válida. Conversor/journal só integram a entrega se pendências reais e necessidade de transformação forem comprovadas; ausência delas não impede concluir o incremento 3 sem conversão.
- Evidência de conclusão futura distingue unitário/mocks, SQL local real, dados encontrados e limitações do alvo. Não classificar ausência de acesso como sucesso.
- Autorrevisão do plano: requisitos da fundação cobertos; demais requisitos da spec classificados como V3.2/posteriores; interfaces de raiz/claim/recibo/admissão/recovery consistentes; cinco riscos de Review Focus vinculados aos testes das tarefas. Nenhum teste foi executado para produzir este documento.
- Apresentar este arquivo para revisão e aguardar autorização separada de implementação. Não executar os checkboxes nesta tarefa. BLQ-002/003 permanecem ABERTOS; GATE-03 permanece BLOQUEADO.
