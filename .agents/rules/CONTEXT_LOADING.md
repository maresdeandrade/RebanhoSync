# Context Loading — RebanhoSync

Roteador de contexto e seleção de skills. Recebe o bootstrap de entrada definido em `AGENTS.md`; não manda reler a entrada nem reinicia o bootstrap. Use apenas contexto vigente: referências em prompts/skills não exigem releitura. As precedências e invariantes são de `CORE_RULES.md`; comandos/validação são de `rtk.md`; a classificação final é do `rebanhosync-verification-gate`.

## Contexto mínimo e seleção

Comece por arquivos-alvo, testes diretamente relacionados e AGENTS local já identificado no bootstrap. Escolha **uma skill principal e no máximo uma skill de apoio**, somente por interseção técnica concreta e justificada; não carregar skills por palavra incidental nem abrir todo o catálogo para decidir.

Ponto de intervenção incerto: `repository-context-retrieval`, com busca dirigida antes de leitura ampla. Encerre cada subetapa com resultado/evidência na conversa antes de trocar a principal; não acumule skills sob nomes de fases. Não criar documento, handoff, delegação ou pausa de aprovação sem necessidade técnica.

## Rotas dentro de IMPLEMENTATION

Risco crítico prevalece sobre tamanho. Estas rotas não são modos, skills ou gates novos e não ampliam autorização.

| Rota | Execução |
|---|---|
| A — Patch localizado | Inspecionar → corrigir → testar → revisar diff → entregar. Sem plano formal, delegação ou documento de fase por padrão; gate breve quando aplicável, com as mesmas evidências. Docs/microcopy/triviais sem delta comportamental recebem checks pertinentes, sem teste artificial. |
| B — Incremento funcional | Inspecionar → plano curto na conversa → implementar → testar resultado funcional observável → entregar pelo gate. |
| C — Contrato crítico | Diagnóstico dirigido → patch incremental → testes de falha → revisão proporcional → gate. Preservar idempotência, RLS, concorrência, retries, histórico factual, isolamento e compatibilidade. |

Descoberta/diagnóstico sem autorização de escrita encerram antes da correção. Quando a implementação já estiver autorizada, retome-a após delimitar a causa/alvo e continue até a entrega; nova aprovação somente para decisão essencial pendente ou condição de parada de `AGENTS.md`.

## Catálogo dirigido

Abra somente a linha pertinente, junto da implementação e dos testes afetados. Caminhos partem do repositório; nomes de documentos sem diretório usam a pasta indicada em seu grupo. Skills são resolvidas no catálogo da sessão.

| Necessidade | Skill principal quando aplicável | Contexto necessário |
|---|---|---|
| Identidade/cadastro, entrada/saída, compra/venda ou óbito animal | `animal-cadastro-origem-destino` | `docs/domain/ANIMAIS_TAXONOMIA.md`; `docs/domain/COMPRA_VENDA.md` se envolver negócio; fonte de verdade se tocar estado/read model |
| Parto, pós-parto, mãe-cria e agenda derivada do nascimento | `reproducao-parto-posparto-cria` | `docs/domain/REPRODUCAO.md`; eventos/arquitetura apenas se afetados |
| Movimento físico, lotes/pastos, trânsito/GTA | `movimentacao-transito-conformidade` | `docs/domain/LOTES_PASTOS.md`; eventos, sync ou RLS somente se afetados |
| Execução sanitária, doses, estoque e conclusão de agenda | `sanitario-registro-operacional` | `docs/domain/SANITARIO.md`; não carregar catálogo regulatório para simples formulário |
| Catálogo sanitário oficial, regras/fontes regulatórias e compliance | `sanitario-catalogo-regulatorio-compliance` | `docs/domain/SANITARIO.md` e fontes diretamente pertinentes |
| Dexie, fila/gestures, retry/replay, rollback e reconciliação | `sync-offline-rollback` | `docs/technical/OFFLINE_SYNC.md`; persistência, fila, auth e callers afetados; RLS se houver contrato remoto |
| Schema, migration, RLS, grants, RPC e sync-batch remoto | `migrations-rls-contracts` | Objeto/migration ativa, policies/callers e `docs/technical/SUPABASE_RLS.md`; `docs/technical/TESTING_GATES.md` quando aplicável |
| Hotspot conhecido com responsabilidades misturadas | `harden-module` ou domínio pelo risco dominante | `docs/technical/ARCHITECTURE.md`, fonte de verdade e testes da extração; offline/sync somente se afetado |
| UX/UI ou auth | Método pertinente, sem skill de domínio por padrão | Tela, primitives/tokens e teste; documento pertinente em `docs/ux/UX_PRINCIPLES.md`, `SCREEN_PATTERNS.md` ou `VISUAL_TOKENS.md`; auth: `docs/ux/LOGIN_UX.md` e contrato RLS |
| Financeiro/KPI | Especialização apenas se o fluxo exigir | `docs/finance/KPI_INDEX.md`; `KPI_MATRIX_FULL.md` somente para cálculo/modelagem detalhada |
| Atualização documental autorizada ou drift formal | `reconcile-docs` | Fontes de maior precedência e documentos afetados; status do projeto apenas se o estado atual for necessário |
| Patch concluído aguardando classificação | `rebanhosync-verification-gate` | Diff real, contratos afetados e evidências vigentes; não acionar durante implementação |
| Título/corpo de PR após READY vigente | `prepare-pr` | Template atual e evidência validada; não revalidar, implementar ou fazer merge |

Antes de alterar writers, Eventos, Agenda, `state_*`, sync/retry/reconciliação, read models, bulk ou fluxos operacionais, consultar `docs/architecture/OPERATIONAL_FLOWS.md`. Se a fonte de verdade exigir determinação explícita, consultar `docs/context/SOURCE_OF_TRUTH.md`. Não carregar esses documentos por mera menção.

Em sync/offline, considerar concorrência, duplicidade, sucesso parcial, interrupção de rede, fechamento/reabertura, reprocessamento e conflito local-remoto; em banco/RLS, considerar isolamento, callers, clientes antigos/offline e convergência. Testes e checks seguem o risco efetivamente alterado, conforme `rtk.md`.

### Continuidade, consulta e suporte

- Fase/handoff/pendências formais: selecionar os pertinentes entre `docs/review/CURRENT_PHASE_HANDOFF.md`, `ACTIVE_PHASE_PLAN.md`, `LAST_PHASE_RESULT.md`, `OPEN_REVIEW_ITEMS.md`, `docs/context/PROJECT_STATUS.md` e `docs/product/ROADMAP.md`. Abrir plano específico somente se apontado pelo plano ativo. Não transformar roadmap em pendência nem contexto colado em prova.
- Prompts de continuidade: usar somente o correspondente em `.agents/prompts/continuity/`: `START_NOVA_CONVERSA.md`, `UPDATE_FINAL_DE_FASE.md`, `UPDATE_CONTEXTO_EM_ANDAMENTO.md` ou `CHECK_CONTEXT_DRIFT.md`. Referenciar fontes permanentes, repetindo apenas escopo, restrições e aceite específicos.
- Manual/suporte: somente a página da tela ou fluxo em `docs/manuals/screens/` ou `docs/manuals/support/`.

## Superpowers proporcional

Superpowers permanece o método preferencial de engenharia genérica quando disponível; skills locais preservam os contratos específicos. Descobrir pelo catálogo da sessão e ler o SKILL instalado selecionado e referências necessárias. Sem ferramenta de invocação, essa leitura aplica o procedimento; cache/documentação isolados não comprovam ativação. Não inventar comandos nem fixar versão/caminho pessoal no repositório, copiar, instalar ou atualizar o plugin sem autorização. Na ausência, registrar limitação e seguir o fluxo local autorizado.

Selecionar por necessidade, **sem encadeamento universal**:

| Necessidade real | Método |
|---|---|
| Explorar decisão de design ainda aberta | `superpowers:brainstorming` |
| Planejar mudança relevante | `superpowers:writing-plans`; especificação suficiente permite plano curto na conversa |
| Investigar bug | `superpowers:systematic-debugging` |
| Testar comportamento/bug ou caracterizar refatoração | `superpowers:test-driven-development` e referência instalada `writing-good-tests.md` |
| Executar plano existente | `superpowers:executing-plans`; `subagent-driven-development` somente quando delegação for pertinente e permitida |
| Revisão independente necessária | `superpowers:requesting-code-review`; `dispatching-parallel-agents` apenas para trabalhos independentes sem disputa de estado |
| Conferir alegações ainda sem evidência conferida | `superpowers:verification-before-completion`; gate final reaproveita evidências válidas |

`superpowers:using-superpowers` orienta a seleção inicial, subordinada ao bootstrap e à precedência do projeto. Não ativa todas as demais skills.

Adaptações obrigatórias às instruções genéricas do plugin:

- Não impor plano formal, arquivo de plano, aprovação repetida, worktree, dependências, commits ou limpeza por rotina. Inspecionar o estado Git antes de decidir isolamento; respeitar autorização para operações e ferramentas/modelos realmente disponíveis no host.
- Em bug/comportamento novo, observar RED pela causa esperada antes da correção e GREEN depois, quando viável; refatoração exige caracterização prévia, sem RED artificial. Não apagar trabalho existente/concorrente para reiniciar TDD, criar testes artificiais para docs/microcopy ou executar suíte global por rotina.
- Revisão precisa de alvo/baseline explícitos; patch não commitado inclui staged/untracked, não `HEAD..HEAD`. Autorrevisão não é independente; ao delegar, fornecer escopo, contratos, arquivos permitidos, baseline e proibições. Não simular agente nem alterar configuração global para habilitá-lo.
- Reutilizar testes/revisão apenas com conteúdo, baseline e condições relevantes inalterados. Repetir somente evidência afetada ou ausente; não criar conferência ou gate concorrente. Falha crítica não resolvida impede READY. Build, E2E, Supabase e suíte ampliada dependem de risco/aceite e autorização conforme `rtk.md`, não do plugin.
- `prepare-pr` só após READY; integração, publicação e `finishing-a-development-branch` não são continuação automática da entrega.

## Expansão de contexto

Expandir somente diante de lacuna concreta: alvo desconhecido, impacto transversal, conflito código/documentação, contrato factual, arquitetura entre módulos, sync/RLS/migration/RPC efetivamente afetados ou auditoria ampla solicitada. Registrar brevemente dúvida, arquivos já consultados, risco e próximo arquivo necessário, conforme `no-broad-context.md`.

Começar por índices/buscas dirigidas; em auditoria transversal, usar `PROJECT_STATUS.md` e `SOURCE_OF_TRUTH.md` conforme a pergunta. Graphify somente nos casos de `.agents/rules/GRAPHIFY_USAGE.md`, nunca como prova isolada ou fonte superior ao código.

Não carregar por padrão arquivos longos, todo o repositório, todas as rules/skills, manuais/matrizes completos, auditorias/prompts antigos, handoffs substituídos ou arquivos em `.agents/archive/**`, `docs/archive/**`, `.agents/prompts/archive/**` e `supabase/migrations_legacy_pre_baseline/**`. Históricos exigem solicitação ou necessidade comprovada.
