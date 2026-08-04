# Context Loading — RebanhoSync

Carregue apenas o contexto necessário para decidir e executar a tarefa.

Este arquivo define **o que carregar**. Para limitar expansão, use `.agents/rules/no-broad-context.md`. Para comandos e validações, siga `.agents/rules/rtk.md`.

---

## Bootstrap obrigatório

Antes de escolher uma skill:

1. Ler `AGENTS.md`.
2. Ler `.agents/rules/CORE_RULES.md`.
3. Aplicar este arquivo.
4. Ler `.agents/rules/no-broad-context.md`.
5. Classificar o tipo real da tarefa.
6. Escolher no máximo uma skill principal.

Uma segunda skill só é permitida quando houver interseção real de domínio crítico. Não abrir todos os `SKILL.md` para decidir.

### Precedência em conflito

1. Código + migrations ativas.
2. `docs/context/PROJECT_STATUS.md`.
3. Documentos normativos ativos.
4. Documentos derivados.
5. Histórico em `docs/archive/**`.
6. Definições da skill.

---

## Roteamento de skill

* Ponto de intervenção desconhecido: `repository-context-retrieval`.
* Hotspot conhecido com risco arquitetural: `harden-module` ou a skill do domínio principal.
* Patch concluído aguardando validação: `rebanhosync-verification-gate`.
* PR após gate aprovado: `prepare-pr`.
* Drift formal entre documentação e implementação: `reconcile-docs`.

Sync/offline, migrations/RLS e regras de domínio não devem ser carregados como segunda skill apenas por menção incidental. O risco principal da tarefa deve justificar o roteamento.

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
