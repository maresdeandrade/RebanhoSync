# Plano ativo — Fase 13 / Reprodução Operacional v1

Atualizado em: 2026-08-05
Status: **incremento 13.1 — diagnóstico de gestação factual e projeção reconstruível implementado**
Próxima pendência: **parto e encerramento da gestação, em incremento separado**

Este documento contém o plano corrente. Estado técnico detalhado, validações e risco de plataforma ficam em [CURRENT_PHASE_HANDOFF.md](./CURRENT_PHASE_HANDOFF.md). A decisão arquitetural permanente está em [ADR-0007](../technical/adrs/ADR-0007-sync-remoto-sanitario-v2-integrado.md).

## Incremento 13.1

Baseline de entrada: `main@ab47e47`, worktree limpa e Fase 12 tecnicamente encerrada.

- diagnóstico é Evento factual com detalhe reprodutivo e vínculo obrigatório a cobertura ou IA da mesma matriz e fazenda;
- PRENHA e VAZIA são projetados exclusivamente do histórico ordenado;
- DPP positiva preserva valor explícito válido ou usa a data do serviço + 283 dias, sem fallback pela data do diagnóstico;
- `taxonomy_facts` é somente cache derivado, atualizado pela projeção e removível/reconstruível;
- Evento, detalhe, cache e fila compartilhada são persistidos na mesma transação Dexie;
- retry pela mesma identidade não duplica; conteúdo divergente gera conflito;
- não houve migration, alteração remota ou habilitação de gate/rollout sanitário.

Validação: testes focados de registro/projeção, lint dos arquivos alterados, `git diff --check` e build de fechamento. Risco restante: parto, perda gestacional e round-trip remoto reprodutivo continuam fora deste incremento.

## Resultado já consolidado

1. Validação real da Conformidade Sanitária v2 — **concluída**.
2. Documentação curta do Sanitário v2 local — **concluída**.
3. Sync Remoto Sanitário v2 — **desenvolvimento técnico concluído**.

A Conformidade Sanitária v2 permanece um read model local derivado, somente leitura e recalculado a partir de fontes factuais. Ela não libera venda, abate, leite ou aptidão operacional.

## Estado do Sync Remoto Sanitário v2

| Subitem | Estado canônico |
|---|---|
| 3.1 Diagnóstico schema local/remoto | Concluído |
| 3.2 Migrations necessárias | Fundação concluída |
| 3.3 RLS e isolamento multi-tenant/fazenda | Concluído tecnicamente |
| 3.4 Push/pull de agenda sanitária | Concluído |
| 3.5 Push/pull de `agenda_animais` | Concluído |
| 3.6 Push/pull de evento sanitário | Concluído |
| 3.7 Push/pull de detalhe sanitário | Concluído |
| 3.8 Push/pull de histórico externo/documental | Concluído |
| 3.9 Push/pull de movimento de estoque sanitário | Concluído e recertificado no staging |
| 3.10 Retry/replay/idempotência | Concluído |
| 3.11 Sucesso parcial | Concluído |
| 3.12 Conflito multi-dispositivo | Desenvolvimento concluído; rollout bloqueado pela plataforma |
| 3.13 Recalcular Conformidade após pull | Concluído |
| 4 Produto técnico e fonte por campo | Concluído |
| 5 Correção sanitária append-only | Concluído |
| 6 Carência sanitária operacional | Concluído |
| Hardening integrado local de 3.9, 3.13, 4, 5 e 6 | Concluído |

A Fase 12 está tecnicamente encerrada. O rollout permanece bloqueado e não faz parte da transição de desenvolvimento para a Fase 13.

## Resultado do incremento 3.8

O histórico sanitário de entrada faz round-trip por `apply_factual_core` e pela fila compartilhada como `standalone_fact`, sem ser convertido em execução realizada pela fazenda.

Resultado comprovado:

- `external_declared` permanece não comprobatório;
- nova entrada `external_documented` exige referência e cobertura explícita; legado incompleto permanece legível como pendência;
- origem, evidência, snapshots e relação canônica Evento–Animal sobrevivem ao push/pull;
- replay é idempotente e identidade com conteúdo divergente produz conflito;
- pull incremental preserva operação local pendente e trata tombstone remotamente de modo conservador;
- ativação futura faz backfill idempotente dos históricos locais elegíveis criados com o gate desligado;
- a Conformidade usa somente o campo documentalmente coberto, sem recálculo global do item 3.13;
- tenant e `fazenda_id` permanecem isolados;
- nenhuma migration ou alteração de RPC foi necessária.

## Resultado do incremento 3.9

Quando o gate estiver habilitado, o consumo sanitário acompanha a execução factual `primary_execution` no mesmo gesto offline, após evento, detalhe e relações, reutilizando `insumo_movimentacoes`, fila compartilhada, worker e pull incremental existentes. Com gates desligados, o comportamento local vigente permanece sem fila remota.

Resultado comprovado localmente:

- somente execução factual da fazenda com produto, insumo, lote, quantidade e unidade explícitos é elegível;
- Agenda, closure, `standalone_fact`, `external_declared` e `external_documented` não geram movimento;
- `source_evento_id`, `client_op_id`, `client_tx_id` e `domain_op_id` preservam vínculo e identidade;
- replay idêntico não reaplica saldo e conteúdo divergente produz conflito;
- persistência local de fato, movimento, saldo e fila permanece atômica;
- pull incremental protege movimento local pendente e não reaplica baixa;
- trigger existente preserva saldo não negativo e sucesso parcial continua por operação;
- nenhuma migration, alteração de RPC, carência nova ou autorização operacional foi introduzida.

O movimento foi certificado remotamente e o defeito de `BLOCKED_DEPENDENCY` foi recertificado no `sync-batch` v20. Gates e rollout permanecem desligados.

## Resultado do incremento 3.13

O pull sanitário de cutover busca todas as fontes necessárias antes de gravar, aplica o merge em uma única transação Dexie e, somente após o commit factual completo, reconstrói localmente a Conformidade a partir das fontes da fazenda.

Resultado comprovado localmente:

- a Conformidade permanece um read model efêmero, sem tabela ou operação primária de sync;
- Evento, detalhe, relações canônicas com animais, Agenda e closures preservam seus papéis de fato, detalhe e intenção administrativa;
- pull incremental e replay idêntico recalculam sem duplicar fatos ou efeitos;
- operação local pendente continua protegida contra sobrescrita e tombstone remoto parcial;
- falha em qualquer fonte anterior ao merge não grava estado parcial nem dispara recálculo;
- o recálculo não cria Evento, Agenda, movimento de estoque, carência ou autorização operacional;
- nenhuma migration, RPC, tabela Dexie, `tableMap` ou worker foi alterado.

Fora do escopo:

- criar Agenda Sanitária v2;
- criar Evento sanitário executado;
- movimentar estoque;
- calcular carência;
- liberar venda, abate, leite ou aptidão operacional;
- habilitar rollout, gate remoto ou feature flag local;
- alterar a semântica do bloqueio de plataforma.

## Resultado do item 4

A execução factual preserva em `eventos_sanitario.produto_snapshot` o produto realmente executado e um snapshot técnico por campo, formado somente a partir do catálogo v2 disponível no cache local.

Resultado comprovado localmente:

- dose, via e produto executados permanecem fatos históricos; divergência com o catálogo não os substitui e deixa o campo explicitamente não coberto;
- fonte, versão, cobertura, vínculo produto–fonte, regra técnica e qualificadores por espécie/animal são preservados somente para o campo comprovado;
- ausência, arquivamento, ambiguidade ou incompatibilidade de catálogo não impede o Evento, não fabrica evidência e não deixa qualificação parcial;
- o mesmo `produto_snapshot` participa do detalhe factual, fingerprint remoto e pull incremental, com proteção da operação local pendente;
- o `sync-batch` valida tenant, produto, fonte, cobertura, regra e aplicabilidade antes da RPC; replay já confirmado continua resolvido pelo ledger e fingerprint canônicos;
- o núcleo isolado do item 4 não contém `withdrawalSnapshot`; a materialização de carência foi adicionada posteriormente pelo item 6, sem criar autorização operacional;
- nenhuma migration, alteração de RPC, schema Dexie, estoque, gate, deploy ou push foi necessária.

## Resultado do item 5

A correção sanitária é um novo Evento factual vinculado por `corrige_evento_id`; o original e seu snapshot permanecem imutáveis.

Resultado comprovado localmente:

- cadeia linear é projetada deterministicamente e correções sucessivas preservam campos não alterados;
- ramificação factual é conflito explícito, sem last-write-wins;
- correção técnica congela snapshot próprio e correção apenas de custo preserva o significado sanitário e a carência;
- replay idêntico é no-op, identidade divergente é conflito e falha transacional não deixa fato ou detalhe parcial;
- retry mantém identidades estáveis e não transforma correção local pendente em confirmação remota;
- compensações de estoque permanecem nos gestures especializados, sem estorno implícito.

## Resultado do item 6

A carência operacional nasce exclusivamente do Evento factual executado, do produto realmente aplicado, do `produto_snapshot`, do `withdrawalSnapshot` congelado e de evidência técnica forte com cobertura explícita para `withdrawal`.

Resultado comprovado localmente:

- estados `calculated`, `explicit_absence`, `unknown`, `ambiguous` e `not_permitted` permanecem distintos;
- carne e leite são finalidades independentes por animal, sem ampliar cobertura ou inferir aptidão ausente;
- regras semanticamente equivalentes têm seleção determinística; regras divergentes permanecem ambíguas e não calculam;
- horas são somadas exatamente ao instante factual, sem arredondamento; dias usam data nominal em `America/Sao_Paulo` com término inclusivo no fim do dia;
- ausência de catálogo offline permite registrar o Evento, mas mantém carência desconhecida sem fabricar snapshot;
- retry reutiliza o snapshot persistido, o round-trip preserva fonte/versão/cobertura/cálculo e a projeção vigente usa a cadeia factual do item 5;
- término de carência não autoriza venda, abate, leite, movimentação ou outra operação comercial.

## Hardening integrado local

Os itens 3.9, 3.13, 4, 5 e 6 foram validados conjuntamente nas fronteiras de Agenda/closure, execução factual, snapshots, correção, projeção, fila, worker/reconcile, pull, estoque e `sync-batch`.

Resultado:

- a matriz integrada já possuía cobertura direta; nenhum defeito funcional ou teste adicional foi necessário;
- lint, suíte completa, build, baseline funcional Supabase, validador agregado e Deno fmt/check passaram;
- nenhuma migration, RPC, RLS, schema Dexie, UI, feature flag ou fonte de verdade foi alterada;
- a certificação remota funcional foi concluída; gates permanecem desligados e rollout não está autorizado.

## Recertificação mínima de `BLOCKED_DEPENDENCY`

O `sync-batch` v20 foi publicado somente no staging `zqloazqzhwauamcejmuz`. Um único batch sintético confirmou fato `REJECTED` seguido de movimento `BLOCKED_DEPENDENCY / SANITARIO_INVENTORY_FACTUAL_OPERATION_REQUIRED`, sem Evento, ledger ou movimento persistido e com saldo inalterado. O cleanup terminou sem resíduos e com zero gates habilitados. O defeito funcional está encerrado; o conflito remoto `SQLSTATE 40001` permanece como bloqueio externo separado, sem autorizar rollout.

## Regras de domínio do incremento

- Agenda = intenção ou tarefa futura.
- Evento = fato histórico executado.
- Closure administrativa = encerramento da intenção, não execução.
- `state_*` = estado atual/read model.
- Protocolo = regra/configuração.
- Conformidade = leitura derivada, não fonte primária.
- Agenda concluída sem Evento não comprova execução.
- Cancelamento e dispensa não criam fato sanitário.
- Execução parcial vale somente para os animais vinculados ao Evento.
- `external_declared` não comprova regra crítica.
- `external_documented` exige referência de evidência para comprovação crítica.
- Baixa de estoque depende de Evento factual.
- Carência depende de produto executado e fonte técnica explícita.
- Tags, sinais, insights e status de sync não são fontes críticas.
- Resposta de sync não libera operação.

## Gate e ambientes

- Supabase staging: `zqloazqzhwauamcejmuz`.
- Produção: não alterada.
- Gate sanitário remoto: desligado, fail-closed.
- Feature flag local: `false`.
- Rollout para usuários: não autorizado.
- Fixtures sintéticas residuais: zero.

O bloqueio `SANITARIO_V2_E2E_PLATFORM_BLOCKED` continua impedindo rollout, sem invalidar o desenvolvimento técnico concluído da Fase 12. Não criar workaround, aumentar timeout nem reescrever preventivamente a RPC.

## Sequência após o fechamento formal

```txt
Fase 12 tecnicamente encerrada
→ Fase 13 — Reprodução Operacional v1
→ decisão futura e separada sobre rollout sanitário
```

A Fase 13 pode iniciar sob os contratos existentes. Essa transição não habilita gate, feature flag nem rollout do Sync Sanitário v2.

## Critérios preservados após 3.8

- origem e evidência preservadas no push e no pull;
- `external_documented` sem referência não comprova regra crítica;
- replay não duplica histórico;
- conflito e sucesso parcial ficam rastreáveis;
- pull é merge não destrutivo por `fazenda_id`;
- Conformidade é reconstruída localmente após o merge completo dos fatos puxados;
- nenhum Evento de execução, Agenda, estoque, carência ou liberação operacional é criado por inferência;
- gate remoto e feature flag local permanecem desligados;
- validações proporcionais de domínio, sync/offline e Supabase passam.
