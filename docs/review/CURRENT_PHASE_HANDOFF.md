# Handoff atual — Fase 17 / Decisão Assistida

Atualizado em: 2026-08-20
Baseline integrado da Fase 15: `main@0d425d1e8786d7cd50ea3d96594f836da99a2ecb`
Baseline autoritativo de saída documental da Fase 15: `main@0d425d1e8786d7cd50ea3d96594f836da99a2ecb`
Baseline efetivo de abertura da Fase 16.0: `2f3aaa449d39c39e5841461e0450e50b0b2e981a`
Baseline de execução da Fase 16.1A: `feat/phase-16-finance-managerial@1734a5b`
Merge commit da Fase 15: `0d425d1e8786d7cd50ea3d96594f836da99a2ecb`
Status: **Fase 16 encerrada; Fase 17 preparada para abertura, não iniciada**
Próxima fase: **Fase 18 — Beta/Hardening, após fechamento formal da Fase 17**

## Saída integrada da Fase 15

A Fase 15 implementou o contrato `MetricResult<T>` com `complete`, `partial` e `unavailable`, fontes, limitações, período e cobertura. `MetricCoverage` distingue histórico, snapshot atual e planejamento; histórico sem evidência verificada permanece conservador; zero local sem cobertura vira indisponível; e pendências locais tornam o resultado parcial.

`MetricPeriod` registra fronteiras inclusivas, campo factual e timezone. `fazendas.timezone` é usado quando válido; ausência ou valor inválido usa timezone de runtime com limitação declarada. O agregador filtra explicitamente todas as coleções por `fazendaId`.

A reprodução usa `rebuildReproductiveProjection`; a demanda futura prefere Agenda Sanitária v2; o histórico do rebanho usa Eventos factuais; e KPIs comerciais selecionam positivamente Eventos com `payload.kind = "commercial_operation_v2"`, exigem detalhe vinculado para valores e excluem simulações explícitas.

O Validate repository remoto passou integralmente antes da integração. O merge não alterou migration, RLS, schema, RPC, Edge Function, grant ou sincronização remota.

## Saída integrada da Fase 16

A Fase 16 — Financeiro Gerencial — foi integralmente validada e integrada à branch principal.

Baseline de entrada: `2f3aaa449d39c39e5841461e0450e50b0b2e981a`
Feature head: `078cfcad654b7e92b7ec94b8a2145bb9123dbc55`
PR: `#94`
Merge commit: `f20146505a04c0eab03c0685f2bdef7763bae221`

A implementação entregou:
- **Hardening offline:** Proteção de operações pendentes em `finance_transactions` e `finance_categories` durante pull `replace`/`merge`.
- **Hardening semântico:** Prevenção de conversão silenciosa de valores inválidos/ausentes para zero; `valor_total` estritamente positivo; sumários distinguindo realizado de previsto; cancelado ignorado na agregação.
- **Classificação Canônica:** `classifyCommercialOperation` e `classifyLedgerTransaction` separam fatos do ledger, isolam simulações comerciais e deduplicam vínculos, prevenindo dupla contagem (Evento × ledger × comercial).
- **Modos Temporais:** Agregação separada por caixa (realizado com `paid_at`), competência (`competence_date`), previsão (status previsto com `due_date`) e vencido.
- **Estorno Append-Only:** `reverses_transaction_id` com constraints contra *self-reference* e múltiplos estornos, preservando o lançamento original de forma imutável.
- **Categorias Determinísticas:** UUID determinístico customizado (SHA-256) com convergência cliente/Postgres. O `sync-batch` exige compatibilidade total (fazenda, slug, ID canônico, `is_default=true`) para aceitar `collision_noop`; divergências retornam `CONFLICT`.
- **KPIs Conservadores:** O *Operational Summary* passou a exigir cobertura histórica para tratar ausência de dados como zero factual; sem evidência, a métrica retorna `unavailable` com limitações explícitas declaradas.

A migration associada (`20260601000000_financeiro_estorno_categorias.sql`) foi versionada em `main`, porém **NÃO foi aplicada em staging ou produção** durante esta fase. O RLS e o isolamento por `fazenda_id` permaneceram preservados.

## Contratos restritivos para a Fase 17

A Fase 17 **não foi iniciada**. A próxima etapa formal exige a obediência aos seguintes limites:
- Recomendações não são fatos.
- Insights, sinais e tags são auxiliares.
- Não autorizar automaticamente venda ou abate.
- Não liberar carência automaticamente.
- Não fabricar peso atual nem aptidão operacional.
- Toda recomendação deve expor fonte, período, qualidade e limitações.
- Evento permanece a fonte histórica factual.
- `state_*` permanece read model.
- Agenda permanece intenção futura.
- O Financeiro Gerencial não equivale a contabilidade fiscal.

## Histórico — Fechamento funcional da Fase 13

- cobertura e IA podem ser iniciadas na ficha ou no painel reprodutivo; o serviço permanece Evento factual e alimenta histórico e próximo estado;
- diagnóstico positivo e negativo são registráveis pela UI; PRENHA, VAZIA e DPP vêm da reconstrução histórica;
- parto e aborto encerram a gestação exibida; parto cria vínculo mãe–cria e seis Agendas sanitárias v2, enquanto aborto não cria dependentes;
- pós-parto e cria inicial permanecem navegáveis após o parto;
- correções permanecem Eventos append-only e a leitura usa o significado factual vigente;
- o único gap encontrado estava no adaptador de taxonomia das telas: cache reprodutivo antigo podia sobreviver a um contexto canônico VAZIA ou vazio;
- o patch passou a usar `rebuildReproductiveProjection` para DPP e último parto e torna o contexto factual explicitamente carregado autoritativo sobre `taxonomy_facts`;
- não houve alteração de persistência, Dexie schema, sync, Supabase, Sanitário v2, migration, RLS ou RPC.

Validações executadas: dois smokes integrados (parto e aborto), 14 testes em 2 arquivos, ESLint dos 3 arquivos TypeScript alterados, `git diff --check` e build único. O build manteve warnings preexistentes de Browserslist, chunks e import misto do Dexie. A automação visual via `agent-browser` não foi executada porque o binário não está disponível no ambiente; acessibilidade e navegação foram inspecionadas nos componentes e rotas existentes.

## Entrega da Agenda neonatal v2

- cura de umbigo permanece classificada como Sanitário, mas não cria mais `agenda_itens` no gesto de parto;
- cada cria recebe seis intenções canônicas independentes: D0, D1 e D2, manhã e tarde;
- a intenção fica em `ops_sanitario_agenda_v2` e seu único alvo em `ops_sanitario_agenda_animais_v2`, com vínculo ao Evento de parto preservado em metadata;
- D0 usa a data programada e a janela canônica da Agenda v2; não existe `interval_days_applied = 0`;
- IDs de Agenda e `dedup_key` são determinísticos; retry do mesmo parto retorna o gesto existente sem duplicar Evento, cria, Agenda, vínculo ou fila;
- o mesmo limite transacional Dexie persiste fato, detalhe, cria, cache, Agendas v2, vínculos e fila; falha de Agenda reverte o gesto completo;
- com o push sanitário local habilitado, os envelopes existentes `sanitario_v2/create_agenda` são ordenados depois da cria; com ele desligado, o planejamento local continua existindo;
- o worker preserva resultados aplicados de parto/cria quando processa comandos sanitários canônicos no mesmo batch;
- `sync-batch`, migrations, RPC, RLS, gates e rollout permaneceram inalterados; não houve deploy.

Validações executadas: 40 testes focados em 3 arquivos, ESLint dos 7 arquivos TypeScript alterados, `git diff --check` e um build único. O build manteve apenas warnings preexistentes de Browserslist, chunks e import misto do Dexie. Próximo passo: uma única recertificação de parto, cria, seis Agendas v2, replay, pull e cleanup.

## Entrega da expansão reprodutiva

- o `sync-batch` exige Evento e detalhe de parto aplicados antes de aceitar cria e exige cria aplicada antes da Agenda neonatal;
- dependência ausente retorna `BLOCKED_DEPENDENCY`, lookup transitório retorna `RETRYABLE` e conteúdo divergente com a mesma identidade retorna `CONFLICT`;
- parto simples ou gemelar preserva `mae_id`, `pai_id`, `birth_event_id`, `fazenda_id` e identidades; replay não duplica Evento, detalhe, cria ou Agenda;
- aborto faz round-trip somente como Evento + detalhe e a projeção histórica remove gestação/DPP do episódio afetado, sem criar dependentes de parto;
- correções de diagnóstico, parto e aborto permanecem Eventos append-only com `corrige_evento_id`; original permanece imutável, cadeia linear usa o significado vigente e ramificação é conflito explícito;
- correção de parto não recria nem altera crias ou Agendas; essa limitação continua fail-closed por ausência de compensação segura;
- o pull incremental busca Eventos, detalhes, crias e Agendas por fazenda, valida o lote completo e grava/reprojeta em uma única transação Dexie;
- o pull inicial e o especializado preservam Eventos, crias e Agendas locais pendentes; colisão divergente aborta o lote sem escrita parcial;
- `taxonomy_facts` continua cache reconstruído exclusivamente do histórico; status de sync não é evidência de domínio;
- nenhuma migration, tabela, RPC ou RLS foi criada ou alterada; não houve deploy, E2E remoto ou mudança em Sanitário v2.

Validações executadas: 20 testes focados em 3 arquivos, ESLint dos 8 arquivos TypeScript alterados, `deno check supabase/functions/sync-batch/index.ts`, `git diff --check` e um build único. O build manteve apenas warnings preexistentes de Browserslist, chunks e import misto do Dexie. Próximo passo: deploy e uma fixture remota agregada somente após autorização explícita.

## Entrega da Fase 13.5

- Evento de diagnóstico e detalhe reprodutivo reutilizam a fila compartilhada e o `sync-batch`; Evento aplicado é dependência explícita do detalhe;
- base não aplicada bloqueia o detalhe antes da escrita remota, evitando detalhe órfão e erro de FK como decisão de domínio;
- replay idêntico é idempotente e conteúdo divergente com a mesma identidade retorna conflito explícito;
- o pull incremental por fazenda aplica Evento antes do detalhe, preserva fato local pendente e rejeita colisão divergente ou vínculo cross-tenant;
- reconstrução local usa somente o histórico factual para projetar PRENHA/VAZIA e atualizar `taxonomy_facts` como cache derivado;
- DPP permanece explícita ou serviço + 283 dias; nenhum status de sync participa da projeção;
- Evento, detalhe, episódio, observação e identidades atravessam o round-trip sem incluir parto, aborto, crias ou correções;
- schema, migrations, RLS e RPCs permaneceram inalterados; não houve deploy nem E2E remoto.

Validações executadas: 18 testes focados em 5 arquivos, ESLint dos 9 arquivos TypeScript alterados, `deno check` do `sync-batch`, baseline funcional Supabase local 5/5, `git diff --check` e um build de fechamento. Próximo incremento: round-trip remoto dos demais fatos reprodutivos.

## Entrega da Fase 13.4

- correções de diagnóstico, parto e aborto são novos Eventos factuais com novo detalhe e `corrige_evento_id`; nenhum fato original é atualizado ou apagado;
- a projeção pura colapsa cadeia linear para o último fato vigente e sinaliza ramificação, ciclo e elo inválido explicitamente;
- diagnóstico corrige data efetiva, resultado, episódio, DPP explícita e observação; aborto corrige data, episódio e observação;
- parto corrige somente observação, pois o contrato atual não possui compensação segura para data, episódio, quantidade ou identidade das crias;
- correção de parto não cria cria ou Agenda neonatal e preserva `mae_id`, `birth_event_id` e identidades existentes;
- `taxonomy_facts` permanece cache reconstruído do histórico, sem participar da criação ou resolução da correção;
- retry da mesma identidade retorna a transação persistida; conteúdo divergente e ramificação retornam conflito;
- Evento, detalhe, cache e fila compartilhada permanecem atômicos no gesto Dexie, com rollback integral;
- nenhuma migration, RPC, RLS, Edge Function, sincronização remota ou alteração sanitária foi realizada.

Validações executadas: 8 testes novos em `correction.test.ts`, ESLint dos três arquivos TypeScript alterados, `git diff --check` e build de fechamento. Próximo incremento: round-trip remoto reprodutivo.

## Entrega da Fase 13.3

- o tipo `aborto` existente persiste Evento base e detalhe reprodutivo, preservando data, matriz, fazenda, identidade e observação explícita;
- vínculo informado ou derivado do episódio vigente aceita somente cobertura/IA compatível da mesma matriz e fazenda;
- a projeção encerra somente o episódio afetado, remove DPP atual e deriva `lastLossDate` do Evento;
- ausência de antecedentes não bloqueia o fato e é sinalizada por `ABORTO_WITHOUT_EPISODE`;
- aborto de episódio antigo permanece histórico sem encerrar gestação posterior;
- `taxonomy_facts` é atualizado exclusivamente pelo resultado da reconstrução histórica;
- retry não duplica Evento, detalhe ou fila; conteúdo divergente é conflito explícito;
- falha intermediária reverte Evento, detalhe, cache e fila integralmente;
- nenhuma cria, Agenda neonatal, migration, RPC, RLS, Edge Function ou sincronização remota foi criada.

Validações executadas: testes focados de Reprodução, ESLint dos arquivos TypeScript alterados, `git diff --check` e um build no fechamento. Permanecem fora do escopo: correção append-only e round-trip remoto reprodutivo.

## Entrega da Fase 13.2

- o gesto existente persiste Evento de parto, detalhe, crias, cache derivado e Agenda neonatal de forma atômica;
- a projeção encerra PRENHA/SERVIDA, remove DPP atual e deriva a data do último parto do Evento;
- ausência de serviço/diagnóstico anterior não bloqueia o fato real e fica sinalizada como histórico incompleto;
- cada cria possui identidade estável, `mae_id`, `birth_event_id` e `pai_id` somente quando explicitado ou ligado a serviço factual compatível;
- mãe e episódio são validados por `fazenda_id`, animal, tipo e cronologia;
- replay da mesma identidade não duplica Evento, cria, Agenda ou fila; divergência nas crias é conflito explícito;
- falha intermediária reverte integralmente o gesto Dexie;
- nenhuma migration, RPC, RLS, Edge Function ou sincronização reprodutiva foi alterada.

Validações executadas: testes focados de Reprodução, ESLint dos arquivos TypeScript alterados, `git diff --check` e um build no fechamento. Permanecem fora do escopo: aborto/perda, correção append-only e round-trip remoto reprodutivo.

## Entrega da Fase 13.1

- fato: Evento base + detalhe `diagnostico`, com resultado canônico positivo/negativo;
- vínculo: cobertura ou IA existente, mesma matriz, mesma fazenda e data não posterior ao diagnóstico;
- projeção: função pura sobre histórico ordenado, sem leitura de UI, Dexie, Supabase ou `taxonomy_facts`;
- DPP: explícita válida ou serviço + 283 dias; o fallback diagnóstico + 150 dias foi removido;
- cache: `taxonomy_facts` reflete somente a projeção; VAZIA elimina prenhez e DPP atuais sem apagar fatos;
- persistência: Evento, detalhe, cache e fila compartilhada permanecem atômicos em Dexie;
- idempotência: mesma identidade e conteúdo retorna a transação original; divergência é conflito explícito;
- banco remoto: nenhuma migration, RPC, RLS, Edge Function ou sincronização reprodutiva foi alterada.

Validações executadas: testes focados de Reprodução, lint somente dos arquivos TypeScript alterados, `git diff --check` e um build no fechamento. Permanecem fora do escopo: parto, aborto/perda, correção append-only e round-trip remoto reprodutivo.

## Resumo executivo

A Conformidade Sanitária v2 permanece um read model derivado/somente leitura. Os incrementos 3.9, 3.13, 4, 5 e 6 estão validados localmente e passaram pelo hardening integrado da cadeia de execução factual, snapshots, correção append-only, projeção de carência, fila, pull/reconcile e estoque.

As validações locais e a certificação remota funcional estão consolidadas, incluindo histórico externo/documental, núcleo factual, estoque, correções, carência, pull/Conformidade, sucesso parcial e a recertificação de `BLOCKED_DEPENDENCY` no `sync-batch` v20.

Decisão atual: manter a Fase 12 encerrada e o rollout sanitário desligado; avançar a Fase 13 em incrementos reprodutivos locais e verticais.

## Fontes autoritativas

- plano corrente: [ACTIVE_PHASE_PLAN.md](./ACTIVE_PHASE_PLAN.md);
- decisão permanente: [ADR-0007](../technical/adrs/ADR-0007-sync-remoto-sanitario-v2-integrado.md);
- estado macro: [ROADMAP.md](../product/ROADMAP.md);
- contratos de domínio: [SANITARIO.md](../domain/SANITARIO.md) e [SOURCE_OF_TRUTH.md](../context/SOURCE_OF_TRUTH.md);
- contratos técnicos: [OFFLINE_SYNC.md](../technical/OFFLINE_SYNC.md) e [SUPABASE_RLS.md](../technical/SUPABASE_RLS.md).

Planos encerrados e evidências em `docs/review/evidence/` permanecem históricos e não substituem este handoff.

## Estado consolidado da Fase 12

1. Validação real da Conformidade Sanitária v2 — **concluída**.
2. Documentação curta do Sanitário v2 local — **concluída**.
3. Sync Remoto Sanitário v2 — **desenvolvimento técnico concluído**.

| Subitem | Estado |
|---|---|
| 3.1 Diagnóstico schema local/remoto | Concluído |
| 3.2 Migrations necessárias | Fundação concluída |
| 3.3 RLS/multi-tenant/fazenda | Concluído tecnicamente |
| 3.4 Agenda sanitária | Concluída |
| 3.5 Agenda animais | Concluída |
| 3.6 Evento sanitário | Concluído |
| 3.7 Detalhe sanitário | Concluído |
| 3.8 Histórico externo/documental | Concluído |
| 3.9 Movimento de estoque sanitário | Concluído e recertificado no staging |
| 3.10 Retry/replay/idempotência | Concluído |
| 3.11 Sucesso parcial | Concluído |
| 3.12 Conflito multi-dispositivo | Desenvolvimento concluído; rollout bloqueado pela plataforma |
| 3.13 Recalcular Conformidade após pull | Concluído |
| 4 Produto técnico e fonte por campo | Concluído |
| 5 Correção sanitária append-only | Concluído |
| 6 Carência sanitária operacional | Concluído |
| Hardening integrado local | Concluído |

A Fase 12 está tecnicamente encerrada. A pendência externa do conflito não bloqueia o desenvolvimento das próximas fases.

## Componentes implementados

### Fundação remota

- migration expand do Sync Sanitário v2;
- `revision` e `expected_revision`;
- `client_op_id`, `client_tx_id` e `domain_op_id`;
- vínculo Evento → Agenda Sanitária v2;
- relação append-only Evento–Animal;
- ledger de idempotência;
- gate autoritativo fail-closed;
- comandos `create_agenda`, `replace_agenda_animals`, `apply_factual_core` e `close_agenda`.

### Transporte e processamento

- `sync-batch` v20;
- typecheck Deno limpo;
- worker com resultados canônicos `APPLIED`, `RETRYABLE`, `REJECTED`, `CONFLICT` e `BLOCKED_DEPENDENCY`;
- retry/replay sem assumir `23505` genérico como sucesso;
- sucesso parcial por operação;
- fila compartilhada existente, sem `queue_ops` paralelo;
- pull/reconcile não destrutivo.

### Cutover local

- Dexie v28;
- store factual `event_eventos_animais`;
- manifesto idempotente com estados `PREPARED`, `APPLYING`, `APPLIED` e `FAILED`;
- preservação das filas de outros domínios;
- feature flag local fail-closed e mantida em `false`.

## Contratos de domínio preservados

- Agenda é intenção/tarefa futura.
- Evento é fato histórico executado.
- Closure administrativa encerra a intenção; não prova execução.
- `state_*` é estado atual/read model.
- Protocolo é regra/configuração.
- Conformidade é leitura derivada e não fonte primária.
- Agenda concluída sem Evento não comprova execução.
- Cancelamento e dispensa não criam fato sanitário.
- Execução parcial vale apenas para animais vinculados ao Evento.
- `external_declared` não comprova regra crítica.
- `external_documented` exige referência de evidência para comprovação crítica.
- Estoque depende de Evento factual.
- Carência depende de produto executado e fonte técnica explícita.
- Tags, sinais, insights e status de sync não são fontes críticas.
- Nenhuma resposta de sync libera venda, abate, leite ou aptidão operacional.

## Ambiente e rollout

| Item | Estado confirmado |
|---|---|
| Supabase staging | `zqloazqzhwauamcejmuz` |
| Produção | Não alterada |
| Gate sanitário remoto | Desligado |
| Feature flag local | `false` |
| Rollout para usuários | Não autorizado |
| Fixtures sintéticas residuais | Zero |

O staging não é produção. Este documento não registra credenciais, secrets, tokens ou dados pessoais de fixtures.

## Risco externo atual

Código: `SANITARIO_V2_E2E_PLATFORM_BLOCKED`

Fatos confirmados:

- criação de Agenda remota aprovada;
- replay aprovado;
- substituição de animais aprovada;
- revisão chegou corretamente a `1`;
- PostgreSQL produz imediatamente `SQLSTATE 40001 / SANITARIO_AGENDA_REVISION_CONFLICT`;
- no caminho Edge Function/PostgREST/gateway, a resposta não retorna antes do timeout;
- o worker recebe `RETRYABLE / SANITARIO_RPC_TIMEOUT`.

Inferência vedada: não há evidência atual para atribuir defeito ao SQL ou à regra de domínio.

Conduta:

- não aumentar timeout;
- não alterar RPC sem nova evidência;
- manter rollout bloqueado;
- continuar desenvolvimento sob gate remoto desligado e feature flag local `false`.

IDs e rastros detalhados da execução remota devem permanecer em relatório técnico/evidência específica, sem reprodução nas fontes resumidas.

## Validações registradas nos incrementos recentes

- migration expand e sentinelas SQL;
- rebaseline completo do staging;
- baseline funcional Supabase;
- testes focados do `sync-batch`;
- `deno check` e `deno fmt --check`;
- testes focados do worker/reconcile;
- testes do cutover e pull;
- suíte local completa, lint e build nos respectivos incrementos;
- limpeza remota com zero fixtures sintéticas residuais.

## Recertificação mínima de `BLOCKED_DEPENDENCY`

O staging `zqloazqzhwauamcejmuz` recebeu o `sync-batch` v20 com `verify_jwt=true`. No único batch sintético, o fato deliberadamente inválido retornou `REJECTED` e o movimento dependente retornou `BLOCKED_DEPENDENCY / SANITARIO_INVENTORY_FACTUAL_OPERATION_REQUIRED`. Não houve Evento, detalhe, relação, ledger ou movimento persistido; o saldo permaneceu `10.000`. O cleanup removeu usuário Auth, fazenda, membership, animal, insumo, lote e gate, com zero gates habilitados ao final. O defeito de dependência está encerrado; o conflito `SQLSTATE 40001` continua como bloqueio externo independente.

No incremento 3.8 foram reexecutados: preflight e validação agregada, testes focados do domínio/sync, suíte completa com 2.241 testes em 310 arquivos, lint, build, `deno fmt --check`, `deno check --no-lock` e baseline funcional Supabase com 5/5 verificações. Não houve migration, alteração de RPC, deploy ou push.

Este handoff registra resultados já executados; não afirma que essas validações foram reexecutadas por uma alteração puramente documental.

## Resultado do incremento 3.8

Fatos confirmados:

- UUID e identidades de operação são gerados na origem e enfileirados na fila compartilhada;
- existe registro na tabela factual `event_eventos`/`eventos`, classificado como `standalone_fact`; ele não é Evento de execução `primary_execution`;
- referência presente, classe e cobertura são validações estruturais e não autenticam o conteúdo do documento;
- `external_declared` não comprova; documento sem referência permanece fail-closed; `external_documented` apoia somente a cobertura declarada;
- o cutover com contexto de ativação faz backfill idempotente dos históricos locais elegíveis criados com o gate desligado, inclusive quando o manifesto já está `APPLIED`;
- a relação Evento–Animal canônica é exclusiva quando existe; fallback legado ocorre somente na ausência dela, sem união ou duplicidade;
- o fingerprint cobre evento, detalhe e relações completos; alteração de referência, cobertura ou snapshot crítico com a mesma identidade produz conflito, não replay;
- pull incremental/idempotente protege conjuntamente evento, detalhe e relação de operação local pendente, inclusive contra tombstone remoto parcial;
- replay, conflito de conteúdo, sucesso parcial e divergência de tenant estão cobertos;
- não são criados Agenda, `primary_execution`, movimento de estoque, carência ou autorização operacional;
- nenhuma migration ou ampliação da RPC foi necessária.

O incremento 3.8 não introduziu recálculo global após todos os pulls; essa integração foi realizada posteriormente no item 3.13.

## Resultado do incremento 3.9

Fatos confirmados:

- execução sanitária `primary_execution` persiste evento, detalhe, relações, movimento, saldo local e fila no mesmo limite transacional Dexie;
- o movimento reutiliza `insumo_movimentacoes` e permanece ligado ao Evento por `source_evento_id`;
- o gesto inicial ordena fato antes do movimento; em retry isolado, o servidor exige ledger factual confirmado e valida fazenda, natureza, produto, insumo, lote, quantidade e unidade antes do INSERT;
- Agenda, closure administrativa, `standalone_fact`, `external_declared` e `external_documented` não são elegíveis;
- replay por identidade ou chave lógica compara fingerprint canônico; conteúdo idêntico é no-op e conteúdo divergente é conflito;
- pull de `insumo_movimentacoes` é incremental, idempotente e protege operação local pendente, inclusive contra tombstone parcial;
- sucesso parcial e retry continuam preservando resultado individual; saldo confirmado não é reaplicado;
- schema, migrations, RPCs, `db.ts`, `tableMap.ts` e `syncWorker.ts` permaneceram inalterados;
- nenhuma carência nova, Conformidade recalculada ou autorização de venda, abate ou leite foi criada.

Validação local concluída com testes focados, suíte completa, lint, build, Deno fmt/check e baseline funcional Supabase 5/5. O movimento e seu `BLOCKED_DEPENDENCY` foram posteriormente certificados no staging; `SANITARIO_V2_E2E_PLATFORM_BLOCKED` permanece como pendência externa sem autorizar rollout.

## Resultado do incremento 3.13

Fatos confirmados:

- o pull de cutover busca as fontes sanitárias ordenadas e somente grava depois que todas respondem sem erro;
- agenda, alvos, Evento, detalhe, relações com animais, movimentos e closures são mesclados em uma única transação Dexie;
- a Conformidade é reconstruída após esse commit, diretamente das fontes locais filtradas por `fazenda_id`, sem persistir uma fonte primária paralela;
- cursor incremental, idempotência e proteção de operação local pendente foram preservados;
- falha de fonte não produz estado factual parcial nem recálculo;
- o recálculo declara e testa ausência de criação de Agenda, Evento, estoque, carência e autorização operacional;
- não houve migration, RPC, alteração de schema Dexie, `tableMap`, `syncWorker`, gate, deploy ou push.

Validação local concluída com 45 testes focados, suíte completa, lint, build e baseline funcional Supabase 5/5. O `rtk` não estava disponível; os comandos equivalentes foram executados diretamente. Warnings existentes de Browserslist, chunking e imports mistos do Dexie não bloquearam o build.

## Resultado do item 4

Fatos confirmados:

- `eventos_sanitario.produto_snapshot` permanece a única persistência factual do snapshot do produto executado;
- o núcleo tipado do item 4 contém produto executado e evidência por campo; o `withdrawalSnapshot` permanece uma extensão separada, materializada posteriormente pelo item 6;
- evidência `covers` exige produto, fonte e versão atuais, cobertura exata, vínculo produto–fonte, regra técnica e aplicabilidade determinística ao animal; cobertura ausente, ambígua ou divergente permanece não comprovada;
- dose e via factuais nunca são substituídas pelo catálogo, e produto planejado, Agenda, closure ou Protocolo isolado não criam snapshot factual;
- o snapshot é gravado atomicamente com o detalhe e a fila existentes, participa do fingerprint remoto e faz round-trip pelo pull sem sobrescrever operação local pendente;
- a validação remota foi adicionada antes da RPC existente e preserva replay por ledger; nenhuma migration, nova coluna, RPC ou segunda fonte de verdade foi criada;
- estoque, Conformidade, carência, autorização operacional, gates e rollout permaneceram inalterados.

Validação local concluída com testes focados, suíte completa, lint, build, Deno fmt/check, gate local agregado e baseline funcional Supabase 5/5. O `rtk` não estava disponível; foram usados os comandos equivalentes diretamente.

## Resultado do item 5

Fatos confirmados:

- correção sanitária cria novo Evento factual vinculado e nunca altera o Evento original;
- cadeia linear é determinística; ramificação permanece conflito explícito, sem last-write-wins;
- correções técnicas congelam snapshot próprio; correção somente de custo preserva carência e significado sanitário;
- replay idêntico é no-op, identidade divergente é conflito, retry mantém identidades e rollback não deixa persistência parcial;
- correções comuns não criam estoque nem estorno; compensações continuam nos gestures especializados.

## Resultado do item 6

Fatos confirmados:

- carência operacional depende exclusivamente do Evento factual, produto executado, `produto_snapshot`, `withdrawalSnapshot` e fonte forte com cobertura explícita para o campo;
- estados calculado, ausência explícita, desconhecido, ambíguo e não permitido são semanticamente distintos;
- carne e leite são independentes por animal; aptidão ausente, produto não identificado ou catálogo insuficiente permanecem desconhecidos;
- períodos em horas usam duração exata desde o fato; períodos em dias usam data nominal em `America/Sao_Paulo` e término inclusivo no fim do dia;
- cada Evento mantém seu snapshot; correções projetam o estado vigente pela cadeia factual do item 5;
- round-trip preserva fonte, versão, cobertura e cálculo; retry reutiliza o snapshot persistido;
- carência encerrada não autoriza venda, abate, leite, movimentação ou qualquer operação comercial.

## Hardening integrado local

Fatos confirmados:

- 166 testes focados dos cinco incrementos e das fronteiras sanitário/offline/`sync-batch` passaram;
- suíte completa, lint, build, baseline funcional Supabase 5/5, validador agregado e Deno fmt/check passaram;
- a cobertura existente satisfez a matriz integrada; nenhum defeito de código ou lacuna que exigisse novo teste foi encontrado;
- não houve mudança em migration, RPC, RLS, schema Dexie, UI, gates ou rollout;
- o timeout inicial da suíte completa não foi falha funcional: a mesma suíte foi reexecutada integralmente e aprovada.

## Transição oficial

```txt
Fase 12 — desenvolvimento técnico concluído
→ Fase 13 — Reprodução Operacional v1
```

O ciclo Dexie completo permanece coberto pela certificação local existente e não exige novo E2E remoto apenas para renovar evidência. O rollout sanitário continua separado, sem autorização para workaround do 40001, aumento de timeout ou reescrita preventiva.
