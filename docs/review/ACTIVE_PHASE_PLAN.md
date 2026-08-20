# Plano ativo — Fase 17 / Decisão Assistida

Atualizado em: 2026-08-20
Status: **Fase 17 ativa, preparada para abertura, não iniciada**
Fase 16 integrada em `main@f20146505a04c0eab03c0685f2bdef7763bae221`.
Próxima fase: **Fase 18 — Beta/Hardening, após fechamento formal da Fase 17**

Este documento contém o plano corrente. Estado técnico detalhado, validações, matriz de fontes e riscos ficam em [CURRENT_PHASE_HANDOFF.md](./CURRENT_PHASE_HANDOFF.md). A decisão arquitetural permanente está em [ADR-0007](../technical/adrs/ADR-0007-sync-remoto-sanitario-v2-integrado.md).

## Encerramento integrado da Fase 15

Baseline integrado: `main@0d425d1e8786d7cd50ea3d96594f836da99a2ecb`.
Merge commit: `0d425d1e8786d7cd50ea3d96594f836da99a2ecb`.

A Fase 15 implementou `MetricResult<T>` com estados `complete`, `partial` e `unavailable`; cobertura histórica conservadora; `MetricPeriod` com período, fronteiras inclusivas, campo factual e timezone da fazenda; escopo explícito por `fazendaId`; KPIs reprodutivos canônicos; KPIs comerciais factuais v2; entradas, saídas e categorias históricas do rebanho; Agenda Sanitária v2 como fonte preferencial de demanda futura; e exportação de cobertura, escopo, período e timezone. Operações comerciais só são selecionadas quando possuem `payload.kind = "commercial_operation_v2"`; simulações explícitas permanecem fora dos KPIs.

O gate semântico e o Validate repository remoto passaram. Histórico sem evidência verificada permanece `partial`/`unavailable`, zero local sem cobertura não vira zero factual, pendências locais tornam o resultado parcial e ausência de timezone da fazenda usa fallback de runtime com limitação declarada. Não houve migration, RLS, schema, RPC, Edge Function, grant ou sync remoto na Fase 15.

## Encerramento integrado da Fase 16

Baseline integrado: `main@f20146505a04c0eab03c0685f2bdef7763bae221`.
Merge commit: `f20146505a04c0eab03c0685f2bdef7763bae221`.
Feature head: `078cfcad654b7e92b7ec94b8a2145bb9123dbc55` (PR #94).

A Fase 16 implementou o Financeiro Gerencial respeitando estritamente a separação entre fato histórico (Evento financeiro) e ledger administrativo (`finance_transactions`). Incluiu hardening offline das transações e categorias; hardening semântico de valores/status para evitar conversões silenciosas a zero; e classificação canônica (Evento × ledger × comercial) prevenindo dupla contagem.

Os KPIs financeiros ganharam cobertura conservadora, preservando `MetricResult<T>` e `limitations`. As categorias default adotaram UUID determinístico customizado (SHA-256) com `collision_noop` estrito (exigindo mesma fazenda, slug, ID e `is_default=true`). O estorno foi implementado de forma auditável e append-only (com `reverses_transaction_id`). A migration associada (`20260601000000_financeiro_estorno_categorias.sql`) está versionada em `main`, porém **não foi aplicada em staging ou produção** durante esta fase. O RLS e o isolamento por fazenda permaneceram preservados.

## Preparação para a Fase 17 — Decisão Assistida

A Fase 17 **não foi iniciada**. Este documento serve como base de preparação.

Contratos restritivos obrigatórios para a Fase 17:
- Recomendações não são fatos.
- Insights, sinais e tags são auxiliares.
- Não autorizar automaticamente venda ou abate.
- Não liberar carência automaticamente.
- Não fabricar peso atual nem aptidão operacional.
- Toda recomendação deve expor sua fonte, período, qualidade e limitações.
- Evento permanece a fonte histórica factual.
- `state_*` permanece read model.
- Agenda permanece intenção futura.
- O Financeiro Gerencial não equivale a contabilidade fiscal.

## Histórico — Fechamento funcional da Fase 13

Baseline de entrada: `main@e7b69fc`, branch local 11 commits à frente de `origin/main` e worktree limpa.

- a jornada cobertura/IA → diagnóstico → PRENHA/VAZIA + DPP → parto ou aborto permanece acessível pelas telas existentes;
- parto cria e vincula a cria, materializa seis Agendas neonatais na Agenda Sanitária v2 e encaminha para pós-parto/cria inicial;
- aborto encerra o episódio vigente sem criar cria ou Agenda e remove a DPP atual da projeção;
- a leitura reprodutiva usada pela taxonomia das telas passou a obter DPP e último parto da projeção histórica canônica e não reutiliza `taxonomy_facts` antigo quando o contexto factual foi carregado;
- Evento continua fato, Agenda continua intenção, correção permanece append-only e `taxonomy_facts` continua cache derivado;
- nenhuma migration, RLS, RPC, Edge Function, fila, worker ou contrato de sync foi alterado.

Smoke local: dois caminhos integrados, 14 testes em 2 arquivos, ESLint dos 3 arquivos TypeScript do patch, `git diff --check` e um build único. A inspeção visual automatizada não foi executada porque `agent-browser` não está disponível no ambiente; rotas, controles e navegações foram confirmados diretamente nos componentes existentes.

## Correção da Agenda neonatal

Baseline de entrada: `main@d64805e`, worktree limpa.

- o parto deixou de criar os seis cuidados de umbigo sanitários em `agenda_itens` legado;
- D0, D1 e D2, manhã e tarde, são materializados localmente em `ops_sanitario_agenda_v2` e vinculados individualmente à cria em `ops_sanitario_agenda_animais_v2`;
- cada intenção preserva data, turno, `dedup_key`, vínculo com o Evento de parto em metadata e classificação sanitária;
- quando o push sanitário local está habilitado, o gesto reutiliza `sanitario_v2/create_agenda`, depois do Evento e da cria pelo `op_order` existente;
- Agenda v2, vínculo animal, Evento, detalhe, cria, cache e fila são gravados na mesma transação Dexie; replay do parto não duplica as intenções;
- o worker passou a consumir corretamente resultados mistos de fatos reprodutivos e comandos sanitários canônicos no mesmo batch;
- nenhuma migration, RPC, RLS, Edge Function, gate ou rollout foi alterado; não houve deploy.

Validação local: 40 testes focados em 3 arquivos, ESLint dos 7 arquivos TypeScript alterados, `git diff --check` e um build único. Próximo passo: após autorização, executar somente parto → cria → seis Agendas v2 → replay → pull → cleanup.

## Expansão do sync reprodutivo

Baseline de entrada: `main@3e4ee5e`, worktree limpa.

- parto, aborto e correções reutilizam Evento, `eventos_reproducao`, fila compartilhada, worker, `sync-batch`, RLS e identidades existentes;
- parto ordena Evento → detalhe → cria(s) → Agenda neonatal; dependente sem fato aplicado retorna `BLOCKED_DEPENDENCY` antes da escrita;
- cria preserva fazenda, mãe, pai somente quando informado e `birth_event_id`; replay idêntico não duplica cria ou Agenda;
- aborto sincroniza somente Evento e detalhe, sem criar animal ou Agenda, e a reprojeção encerra apenas o episódio relacionado;
- correção permanece novo Evento append-only com detalhe próprio e `corrige_evento_id`; cadeia linear é aceita, ramificação é conflito e correção de parto não recria crias;
- pull incremental recupera o histórico reprodutivo completo dos animais afetados, depois crias e Agendas de parto, e grava/reprojeta em uma transação Dexie;
- fatos e dependentes locais pendentes são preservados, colisões divergentes são rejeitadas e `taxonomy_facts` continua cache derivado;
- nenhuma migration, RPC, RLS ou tabela foi alterada; Sanitário v2 e seus gates permaneceram intocados e desligados.

Validação local: 20 testes focados em 3 arquivos, ESLint dos 8 arquivos TypeScript alterados, `deno check` do `sync-batch`, `git diff --check` e um build de fechamento. Não houve deploy nem E2E remoto. Próximo passo: uma única fixture remota de parto, aborto, correção, replay, dependência bloqueada, pull e cleanup, somente após autorização.

## Incremento 13.5

Baseline de entrada: `main@eb5c4fa`, worktree limpa.

- diagnóstico gestacional reutiliza Evento, `eventos_reproducao`, fila compartilhada e `sync-batch` existentes, sem contrato paralelo;
- o detalhe só é escrito após o Evento base resultar `APPLIED`; dependência ausente ou rejeitada retorna `BLOCKED_DEPENDENCY` antes da FK;
- replay compara o conteúdo factual e retorna `APPLIED` para identidade idêntica ou conflito explícito para divergência;
- pull incremental aplica Evento antes do detalhe, protege fatos locais pendentes, rejeita colisão/tenant divergentes e só então reconstrói PRENHA/VAZIA e `taxonomy_facts` derivado;
- DPP continua exclusivamente explícita ou serviço + 283 dias; status de sync não é evidência reprodutiva;
- parto, aborto, crias e correções permanecem fora do round-trip; não houve migration, alteração de RLS/RPC, deploy ou E2E remoto.

Validação: 18 testes focados, ESLint dos arquivos TypeScript alterados, `deno check`, baseline funcional Supabase local 5/5, `git diff --check` e um build de fechamento. Próximo incremento: round-trip remoto dos demais fatos reprodutivos.

## Incremento 13.4

Baseline de entrada: `main@4360777`, worktree limpa.

- correção de diagnóstico, parto ou aborto cria novo Evento e detalhe vinculados por `corrige_evento_id`; o original permanece imutável;
- cadeia linear usa o último significado factual válido e ramificação, ciclo ou elo inválido permanecem inconsistência explícita, sem last-write-wins;
- diagnóstico permite corrigir data, resultado, episódio, DPP explícita e observação; aborto permite data, episódio e observação;
- parto permite somente corrigir observação: data, episódio, quantidade e identidade das crias permanecem protegidos por ausência de compensação segura;
- `taxonomy_facts` continua cache derivado exclusivamente da reconstrução histórica;
- Evento, detalhe, cache e fila compartilhada permanecem no mesmo gesto Dexie, com replay idempotente e rollback integral;
- não houve migration, alteração remota, criação de fila paralela ou mudança no Sanitário v2.

Validação: 8 testes novos focados, ESLint dos arquivos TypeScript alterados, `git diff --check` e build de fechamento. Próximo incremento: round-trip remoto reprodutivo.

## Incremento 13.3

- aborto/perda usa o tipo `aborto` existente e permanece Evento factual com detalhe reprodutivo;
- episódio informado ou vigente é validado por fazenda, matriz, tipo e cronologia;
- perda do episódio vigente encerra PRENHA/SERVIDA e remove episódio e DPP atuais;
- perda sem antecedentes permanece registrável com `ABORTO_WITHOUT_EPISODE`, sem fabricar serviço, diagnóstico, DPP ou causa;
- perda ligada a episódio antigo não encerra gestação posterior e `lastLossDate` deriva do histórico;
- `taxonomy_facts` continua cache derivado da projeção, sem participar da criação do fato;
- Evento, detalhe, cache e fila compartilhada permanecem na mesma transação Dexie, com replay e conflito existentes;
- não são criadas crias, Agenda neonatal, migration ou alteração remota.

Validação: testes focados de registro/projeção, ESLint dos arquivos TypeScript alterados, `git diff --check` e build único. Próximo incremento: correção append-only reprodutiva.

## Incremento 13.2

- parto permanece Evento factual com detalhe reprodutivo no gesto já existente;
- gestação vigente é encerrada pela reconstrução histórica, preservando serviço e diagnósticos anteriores;
- parto sem histórico compatível continua registrável e produz `PARTO_WITHOUT_EPISODE`, sem fabricar serviço, diagnóstico ou DPP;
- crias preservam identidade própria, fazenda, mãe, pai factual quando conhecido, origem nascimento e `birth_event_id`;
- Evento, detalhe, crias, cache, Agenda neonatal e fila compartilhada permanecem na mesma transação Dexie;
- retry retorna Evento/crias já persistidos sem duplicar Agenda ou fila; conteúdo divergente gera conflito;
- não houve migration, alteração remota, aborto/perda ou mudança no Sanitário v2.

Validação: testes focados de registro/projeção, ESLint dos arquivos TypeScript alterados, `git diff --check` e build único. Próximo incremento: aborto/perda gestacional factual.

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
