# Context Loading — RebanhoSync

Carregue apenas o contexto necessário para decidir e executar a tarefa. Este arquivo é o roteador autoritativo de contexto, seleção de skill e progressão entre fases; READMEs e prompts são catálogos ou wrappers e não criam roteamento concorrente.

Este arquivo define **o que carregar**. Para limitar expansão, use `.agents/rules/no-broad-context.md`. Para comandos e validações, siga `.agents/rules/rtk.md`.

---

## Bootstrap obrigatório

Antes de escolher uma skill:

1. Ler `AGENTS.md`.
2. Ler `.agents/rules/CORE_RULES.md`.
3. Aplicar este arquivo.
4. Ler `.agents/rules/no-broad-context.md`.
5. Classificar o tipo real da tarefa.
6. Escolher no máximo uma skill principal para a fase ou subetapa atual.

Durante implementação, uma skill de apoio só é permitida quando houver interseção técnica concreta, deve ser justificada e não pode ampliar o escopo. Não abrir todos os `SKILL.md` para decidir.

### Precedência em conflito

Aplicar as precedências factual e procedimental definidas exclusivamente em `.agents/rules/CORE_RULES.md`. Rules de segurança não podem ser relaxadas por skill, prompt ou template.

---

## Roteamento de skill

### Papéis lógicos

* **Lifecycle:** `repository-context-retrieval`, `rebanhosync-verification-gate`, `reconcile-docs` e `prepare-pr`.
* **Engineering:** `harden-module`, `sync-offline-rollback` e `migrations-rls-contracts`.
* **Domain:** `animal-cadastro-origem-destino`, `movimentacao-transito-conformidade`, `reproducao-parto-posparto-cria`, `sanitario-registro-operacional` e `sanitario-catalogo-regulatorio-compliance`.
* **Método de engenharia genérica:** skills instaladas `superpowers:*`, selecionadas por subetapa conforme a seção Superpowers abaixo; não constituem uma nova camada de autoridade.

### Progressão entre fases

```txt
descoberta, se necessária → encerra descoberta
design/plano, se relevantes → uma principal por subetapa → encerra plano
testes/implementação → uma principal + até um apoio por subetapa → encerra patch
revisão independente, quando aplicável → fase separada
verification gate → fase separada
reconcile docs, se necessário → fase separada
prepare PR → fase separada
```

Skills de método ou lifecycle executadas em subetapas distintas não contam como apoio simultâneo. Registre o resultado da subetapa encerrada e o objetivo da próxima; mantenha somente os contratos e evidências necessários. Não carregar quatro ou mais skills simultaneamente por estarem listadas como possíveis coordenações, nem renomear subetapas para contornar o limite.

* Ponto de intervenção desconhecido: `repository-context-retrieval`.
* Hotspot conhecido com risco arquitetural: `harden-module` ou a skill do domínio principal, conforme o risco dominante.
* Patch concluído aguardando validação: `rebanhosync-verification-gate`.
* PR após gate aprovado: `prepare-pr`.
* Drift formal entre documentação e implementação: `reconcile-docs`.

Sync/offline, migrations/RLS e regras de domínio não devem ser carregados como apoio apenas por menção incidental. A interseção concreta e o risco dominante devem justificar a composição.

---

## Superpowers — engenharia genérica

### Responsabilidades e descoberta

| Responsabilidade | Método preferencial | Autoridade específica preservada |
|---|---|---|
| Design e plano de mudança relevante | `superpowers:brainstorming` → `superpowers:writing-plans` | Escopo autorizado, contratos e fontes do RebanhoSync |
| Organização da implementação | `superpowers:executing-plans` ou `superpowers:subagent-driven-development` | Skill local do risco dominante; `harden-module` nas extrações arquiteturais |
| Testes e causa raiz | `superpowers:test-driven-development`; `superpowers:systematic-debugging` | Contratos reais e validação proporcional em `.agents/rules/rtk.md` |
| Revisão e evidências | `superpowers:requesting-code-review` → `superpowers:verification-before-completion` | `rebanhosync-verification-gate`; `prepare-pr` somente após READY |

Descubra as skills pelos nomes, descrições e caminhos fornecidos pelo catálogo da sessão. Leia o `SKILL.md` instalado da skill selecionada e somente as referências necessárias. No Codex sem ferramenta dedicada de invocação de skill, essa leitura aplica o procedimento; não invente slash commands, ferramentas ou hooks. `superpowers:using-superpowers` orienta o uso inicial, subordinado ao bootstrap e à precedência do projeto.

A presença de arquivos no cache ou de documentação não comprova ativação. Confirme que a skill aparece no catálogo do host e que seu arquivo é legível. Não fixe caminhos pessoais ou uma versão do cache no repositório; não copie o plugin para `.agents/skills`, não instale nem atualize para resolver uma ausência sem autorização. Se a skill não estiver disponível, registre a limitação e execute apenas o fluxo local autorizado, sem alegar uso do Superpowers.

### Composição por subetapa

* Descoberta de contratos desconhecidos: `repository-context-retrieval` primeiro; encerre a descoberta antes do design.
* Design: `superpowers:brainstorming` como principal; planejamento: `superpowers:writing-plans` em seguida. Para tarefa simples ou especificação suficiente, use plano curto e prossiga conforme a autorização existente; não imponha rodadas de aprovação, arquivos de plano ou cerimônias redundantes. Pergunte quando uma decisão essencial permanecer sem resposta ou houver condição de parada do projeto.
* Testes: `superpowers:test-driven-development` como principal, com no máximo uma especialização local se necessária. Leia sua referência instalada `writing-good-tests.md` ao escrever testes; referências da mesma skill não são outra skill.
* Implementação: escolha a skill local do risco dominante como principal quando houver especialização real, com no máximo uma skill de método como apoio justificado. Sem risco especializado, use a skill de execução como principal. Não empilhe executor, TDD, hardening, domínio e sync: se mais de duas skills forem indispensáveis ao mesmo tempo, redelimite a unidade de trabalho antes de prosseguir. Preserve o ciclo de testes definido na subetapa anterior em cada incremento.
* Revisão: `superpowers:requesting-code-review` em subetapa separada, com alvo exato e revisor independente quando aplicável. Depois, use `superpowers:verification-before-completion` para conferir alegações contra as evidências; encerre essa conferência antes do gate local. O gate reaproveita resultados válidos, sem repetir comandos inalterados.

### Conflitos e adaptação ao host

| Orientação do plugin | Aplicação no RebanhoSync |
|---|---|
| Ativar skills por possibilidade incidental e encadear subskills obrigatórias | Aplicar pertinência concreta e carregamento seletivo. Uma principal e até um apoio por subetapa; encadeamento sequencial não autoriza carregamento acumulado. |
| TDD rigoroso, apagar código escrito antes do teste e rodar suíte completa | Para comportamento novo/bug, observar RED pela causa esperada antes da correção e GREEN depois; para refatoração, caracterizar o comportamento preservado antes da extração. Não apagar trabalho existente ou concorrente para reiniciar TDD. Docs, microcopy e mudanças triviais sem delta comportamental recebem checks proporcionais, sem testes artificiais. Suíte global, E2E e build extenso somente conforme escopo/risco e autorização; não por rotina do plugin. |
| Criar worktree, instalar dependências e executar baseline amplo | Inspecionar branch, HEAD, status e worktrees antes de decidir. Reutilizar isolamento adequado; criar worktree apenas quando necessário e autorizado, pelas ferramentas nativas disponíveis. Para patch documental localizado, trabalhar no checkout atual preservando alterações alheias. Usar pnpm e comandos comprovados em `rtk.md`; não instalar dependências por mera instrução genérica. |
| Commits frequentes, publicação e limpeza ao terminar | Plano/skill não autorizam commit, push, merge, deploy, migration remota, remoção de worktree ou descarte. Respeitar autorização da tarefa; não acionar automaticamente `superpowers:finishing-a-development-branch` quando a entrega termina no patch/gate. Não inferir propriedade de worktree pelo nome da pasta. |
| Execução contínua e decisões autônomas sobre conflitos | Continuar o trabalho já autorizado; manter todas as condições de parada de `AGENTS.md`. Registrar decisão não autoriza ultrapassar escopo, resolver fonte ambígua por suposição ou ignorar risco de produção. |
| Delegação, exemplos de modelos e APIs descritas para outros hosts | Usar apenas ferramentas, parâmetros e modelos realmente expostos na sessão. Delegar somente quando permitido pelo runtime e pela tarefa/regra aplicável; não alterar configuração global para habilitar ferramentas. Sem recurso disponível, registrar execução local/autorrevisão e a ausência de independência, sem simular subagente. |
| Revisão genérica ou findings estacionados pelo executor | Revisar diff real, inclusive staged/untracked, com severidades e limites de REVIEW do projeto. Não corrigir em revisão sem autorização. Finding crítico não resolvido continua bloqueante no gate; parecer do plugin não equivale a READY nem autoriza publicação. |
| Scripts auxiliares que pressupõem commits e intervalos BASE..HEAD | Confirmar interfaces antes de executar. Para patch não commitado, revisar working tree, staged e untracked contra o HEAD inicial; não usar HEAD..HEAD como evidência nem executar scripts que comitem ou limpem artefatos. Registrar progresso/evidências na tarefa ou plano pertinente, sem infraestrutura paralela obrigatória. |

Para delegação independente, forneça escopo, contratos, arquivos permitidos, baseline e proibições; cada agente recebe contexto mínimo e o mesmo limite de autorização. Use `superpowers:dispatching-parallel-agents` somente para trabalhos independentes sem disputa de arquivos/estado; implementação de tarefas dependentes permanece sequencial. Falha ou ausência de delegação não comprova revisão independente.

### Rotas operacionais

As setas indicam subetapas sequenciais, não skills simultâneas. A execução usa uma das alternativas acima conforme a tarefa; não ativa ambas.

| Tarefa | Roteamento esperado e evidência |
|---|---|
| Refatoração complexa de hotspot | Descoberta, se necessária → `superpowers:brainstorming` (limites e comportamento preservado) → `superpowers:writing-plans` (extrações incrementais) → `superpowers:test-driven-development` (caracterização) → implementação incremental com `harden-module` e até um apoio pertinente → revisão independente → conferência de evidências → `rebanhosync-verification-gate`. Comparar comportamento antes/depois; não exigir RED de teste que apenas caracteriza comportamento já existente. |
| Novo serviço | `repository-context-retrieval`, se contratos ainda desconhecidos → `superpowers:brainstorming` (interfaces/efeitos) → `superpowers:writing-plans` → ciclos RED/GREEN com `superpowers:test-driven-development` → execução/integração com especialização local conforme o risco → revisão independente → conferência de evidências → gate local. Testar o contrato e os modos de falha realmente envolvidos. |
| Correção de bug | `superpowers:systematic-debugging` (reprodução, rastreamento e causa raiz) → `superpowers:test-driven-development` (regressão falhando pela causa esperada) → correção mínima autorizada com skill local se pertinente → GREEN e checks focados → revisão conforme risco → conferência de evidências → gate local. Pedido somente de diagnóstico encerra antes de teste/correção que altere arquivos. |
| Engenharia de testes | Descobrir contratos/cobertura diretamente afetados → `superpowers:writing-plans` para cenários relevantes → `superpowers:test-driven-development` e sua referência de bons testes → testes por contrato → verificar sensibilidade a falha real (reprodução, controle negativo ou mutação controlada em ambiente isolado) → revisão de cobertura/redundâncias → conferência de evidências → gate local. Não mudar produto apenas para produzir RED; não presumir sensibilidade porque o teste passa. |

Revisão independente usa `superpowers:requesting-code-review`; conferência de evidências usa `superpowers:verification-before-completion`. Preserve offline-first, Dexie/IndexedDB, Supabase/RLS, isolamento por `fazenda_id`, fontes factuais, idempotência, retries, concorrência, reconciliação e compatibilidade local-remota com as skills locais pertinentes. Uma rota genérica não autoriza tocar esses contratos.

---

## Tarefa localizada

Carregar:

* `AGENTS.md` local da pasta afetada, se existir;
* Arquivos-alvo;
* Testes diretamente relacionados;
* Um documento de domínio somente se necessário para confirmar contrato.

Não carregar documentação ampla para ajuste visual, microcopy, teste unitário isolado ou patch com alvo já conhecido.

---

## Continuidade e fases

Use quando a tarefa envolver iniciar ou continuar conversa, fase/subfase, handoff, roadmap ou pendências formais.

### Documentos ativos

Carregar apenas os pertinentes entre:

* `docs/review/CURRENT_PHASE_HANDOFF.md`
* `docs/review/ACTIVE_PHASE_PLAN.md`
* `docs/review/LAST_PHASE_RESULT.md`
* `docs/review/OPEN_REVIEW_ITEMS.md`
* `docs/context/PROJECT_STATUS.md`
* `docs/product/ROADMAP.md`

Se `ACTIVE_PHASE_PLAN.md` apontar para um plano específico, carregar esse plano. Não abrir planos históricos sem necessidade explícita.

### Prompts de continuidade

Usar somente o prompt correspondente:

* `.agents/prompts/continuity/START_NOVA_CONVERSA.md`
* `.agents/prompts/continuity/UPDATE_FINAL_DE_FASE.md`
* `.agents/prompts/continuity/UPDATE_CONTEXTO_EM_ANDAMENTO.md`
* `.agents/prompts/continuity/CHECK_CONTEXT_DRIFT.md`

Restrições:

* Não usar `.agents/prompts/archive/**` nem `docs/archive/**` como fonte ativa.
* Não transformar roadmap em pendência técnica.
* Não marcar fase concluída sem validação correspondente.
* Tratar contexto colado pelo usuário como ponteiro, não como substituto dos documentos ativos.
* Se o repositório não estiver acessível, declarar o que não pôde ser confirmado.

### Prompts para agentes

* Referenciar fontes permanentes em vez de copiá-las.
* Repetir apenas escopo, restrições e critérios de aceite específicos.
* Manter o prompt curto, executável e sem alegar validações futuras como concluídas.

```txt
Prompt de execução deve apontar para a fonte de verdade, não reproduzi-la.
```

---

## Arquitetura

Carregar:

* `docs/context/SOURCE_OF_TRUTH.md`
* `docs/technical/ARCHITECTURE.md`

Adicionar `docs/technical/OFFLINE_SYNC.md` apenas se houver Dexie, fila, sync, rollback, gestures, `sync-batch` ou conflito local/remoto.

---

## Sync / offline

Carregar:

* `docs/technical/OFFLINE_SYNC.md`
* Arquivos afetados de Dexie, gestures, fila ou `sync-batch`;
* Testes relacionados.

Adicionar `docs/technical/SUPABASE_RLS.md` somente quando houver backend, RLS, RPC ou contrato Supabase. Usar `sync-offline-rollback` quando este for o risco principal.

---

## Supabase / RLS / migrations

Carregar:

* Migrations ativas relevantes;
* `docs/technical/SUPABASE_RLS.md`;
* `docs/technical/TESTING_GATES.md`, se aplicável;
* Scripts de validação existentes, conforme `.agents/rules/rtk.md`.

Usar `migrations-rls-contracts` como skill principal. Não usar `supabase/migrations_legacy_pre_baseline/**` nem materiais arquivados como fonte ativa, salvo pedido explícito.

---

## Sanitário

Carregar `docs/domain/SANITARIO.md` e somente a skill adequada ao fluxo:

* `sanitario-registro-operacional` para execução e registro factual;
* `sanitario-catalogo-regulatorio-compliance` para catálogo oficial, regra regulatória e compliance.

Não carregar compliance regulatório para ajuste simples de formulário operacional.

---

## Reprodução

Carregar `docs/domain/REPRODUCAO.md`.

Usar `reproducao-parto-posparto-cria` quando houver parto, nascimento, pós-parto, vínculo mãe-cria ou agenda derivada do ciclo da cria. Adicionar arquitetura/eventos apenas se o contrato factual ou o read model estiver em jogo.

---

## Animais, origem e destino

Carregar `docs/domain/ANIMAIS_TAXONOMIA.md`.

Usar `animal-cadastro-origem-destino` para identidade, cadastro, entrada/saída, compra/venda, óbito ou integridade dos dados-base. Adicionar `docs/context/SOURCE_OF_TRUTH.md` se envolver estado atual ou read model.

---

## Movimentação, lotes e pastos

Carregar `docs/domain/LOTES_PASTOS.md`.

Usar `movimentacao-transito-conformidade` quando houver movimento físico, origem/destino operacional, trânsito, GTA ou documentação associada. Adicionar eventos, sync ou RLS somente se esses contratos forem realmente afetados.

---

## Compra, venda e sociedade

Carregar `docs/domain/COMPRA_VENDA.md`.

Adicionar financeiro/KPI apenas se houver custo, margem, preço, estoque, snapshot econômico ou pagamento. Não inferir venda/abate ou aptidão operacional sem fonte técnica explícita.

---

## UX / UI

Carregar somente:

* Tela ou componente afetado;
* Teste relacionado;
* Documento específico entre `docs/ux/UX_PRINCIPLES.md`, `docs/ux/SCREEN_PATTERNS.md` e `docs/ux/VISUAL_TOKENS.md`.

Não carregar Supabase, sanitário, KPI ou arquitetura ampla para ajuste visual sem regra de domínio.

---

## Login / auth

Carregar:

* `docs/ux/LOGIN_UX.md`
* `docs/technical/SUPABASE_RLS.md`
* Arquivos de autenticação afetados.

Não carregar domínios não relacionados.

---

## Financeiro / KPI

Carregar `docs/finance/KPI_INDEX.md`.

Carregar `docs/finance/KPI_MATRIX_FULL.md` apenas para modelagem detalhada, cálculo, painel, revisão de fórmulas ou definição de KPI.

---

## Manual / suporte

Carregar somente a página específica em `docs/manuals/screens/` ou `docs/manuals/support/`. Não abrir o manual completo para dúvida localizada.

---

## Documentação

Carregar:

* `docs/context/PROJECT_STATUS.md`
* `docs/context/SOURCE_OF_TRUTH.md`, se houver contrato de fonte;
* Arquivos documentais diretamente afetados.

Usar `reconcile-docs` somente quando houver drift formal. Não atualizar documento derivado sem delta funcional ou decisão normativa correspondente.

---

## Auditoria ampla

Começar por índices, `PROJECT_STATUS.md`, `SOURCE_OF_TRUTH.md` e busca dirigida. Usar Graphify somente quando o impacto for transversal e conforme `.agents/rules/GRAPHIFY_USAGE.md`.

Arquivos longos e contexto adicional exigem justificativa nos termos de `.agents/rules/no-broad-context.md`.

---

## Não carregar por padrão

* `docs/archive/**`
* Auditorias e prompts antigos
* Manuais completos
* Matrizes longas
* Handoffs substituídos
* Migrations legadas
* Relatórios históricos fechados
* Todas as skills ou regras secundárias
