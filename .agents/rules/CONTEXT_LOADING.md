```markdown
# Context Loading — RebanhoSync

Use apenas o contexto necessário para a tarefa.

Este arquivo decide **o que carregar**.
Para restrições contra leitura ampla, use `.agents/rules/no-broad-context.md`.
Para execução de comandos, use `.agents/rules/rtk.md`.

---

## Sempre

* `AGENTS.md`
* `.agents/rules/CORE_RULES.md`

---

## Tarefa Localizada

### Use:
* `AGENTS.md` local da pasta afetada, se existir;
* Arquivos-alvo;
* Testes relacionados.

> ⚠️ **Restrição:** Não carregar documentação ampla.

### Exemplos:
* Ajuste em uma tela;
* Bug localizado;
* *Microcopy*;
* Teste unitário específico;
* Patch visual pequeno.

---
## Continuidade / Fases

Use quando a tarefa envolver:

- iniciar nova conversa;
- continuar fase/subfase;
- fechar fase/subfase;
- atualizar handoff;
- revisar coerência entre plano ativo, roadmap e pendências.

### Documentos ativos

Carregar:

- `docs/review/CURRENT_PHASE_HANDOFF.md`
- `docs/review/ACTIVE_PHASE_PLAN.md`
- `docs/review/LAST_PHASE_RESULT.md`
- `docs/review/OPEN_REVIEW_ITEMS.md`
- `docs/context/PROJECT_STATUS.md`
- `docs/product/ROADMAP.md`

Se `ACTIVE_PHASE_PLAN.md` apontar para um plano específico da fase atual, carregar também esse plano.

### Prompts de continuidade

Usar:

- `.agents/prompts/continuity/START_NOVA_CONVERSA.md`
- `.agents/prompts/continuity/UPDATE_FINAL_DE_FASE.md`
- `.agents/prompts/continuity/UPDATE_CONTEXTO_EM_ANDAMENTO.md`
- `.agents/prompts/continuity/CHECK_CONTEXT_DRIFT.md`

### Restrições

- Não usar `.agents/prompts/archive/**` como fonte ativa.
- Não usar `docs/archive/**` como fonte operacional.
- Não arquivar `docs/review/LAST_PHASE_RESULT.md`.
- Não transformar roadmap em pendência técnica.
- Não marcar fase como concluída sem validação correspondente.

### Contexto colado em nova conversa

Quando houver contexto de continuidade colado pelo usuário:

- usar como ponteiro de continuidade, não como substituto dos documentos ativos;
- não repetir regras já documentadas;
- não repetir escopo já documentado;
- distinguir fato confirmado de informação pendente de verificação local;
- se o repositório não estiver acessível, declarar que baseline, worktree e documentos precisam ser confirmados localmente.

---

### Geração de prompts para agentes

Quando a tarefa for criar um prompt para Codex, Antigravity, Jules ou outro agente:

- carregar apenas os documentos ativos necessários;
- referenciar regras permanentes em vez de copiá-las;
- referenciar escopo permitido/proibido em vez de duplicá-lo;
- repetir apenas requisitos específicos que não estejam documentados;
- incluir o caso de aceite específico da tarefa, se houver;
- manter o prompt curto e executável.

Regra prática:

```txt
Prompt de execução deve apontar para a fonte de verdade, não reproduzi-la.
```

Se o usuário pedir “não repetir regras permanentes”, tratar isso como prioridade sobre qualquer lista de exemplos fornecida na mesma solicitação.

---

## Arquitetura

### Use:
* `docs/context/SOURCE_OF_TRUTH.md`
* `docs/technical/ARCHITECTURE.md`

### Adicionar `docs/technical/OFFLINE_SYNC.md` apenas se envolver:
* Dexie;
* Fila local;
* *Sync*;
* *Rollback*;
* *Gestures*;
* `sync-batch`;
* Conflito local/remoto.

---

## Sync / Offline

### Use:
* `docs/technical/OFFLINE_SYNC.md`
* `.agents/rules/rtk.md`
* Arquivos afetados de Dexie, *gestures*, fila ou `sync-batch`.

> **Nota:** Adicionar `docs/technical/SUPABASE_RLS.md` se houver backend, RLS, RPC ou Supabase.

---

## Supabase / RLS / Migrations

### Use:
* `docs/technical/SUPABASE_RLS.md`
* `docs/technical/TESTING_GATES.md`
* Migrations ativas relevantes;
* Scripts de validação Supabase, se aplicável.

> ⚠️ **Restrição:** Não usar migrations antigas em `docs/archive/**` ou `supabase/migrations_legacy_pre_baseline/**` como fonte ativa, salvo pedido explícito.

---

## Sanitário

### Use:
* `docs/domain/SANITARIO.md`
* Skill sanitária adequada:
  * `sanitario-registro-operacional`
  * `sanitario-catalogo-regulatorio-compliance`

> ⚠️ **Restrição:** Não carregar compliance regulatório para ajuste simples de formulário operacional.

---

## Reprodução

### Use:
* `docs/domain/REPRODUCAO.md`

### Adicionar arquitetura/eventos apenas se envolver:
* Parto;
* Cria / pós-parto;
* *Linking* determinístico;
* Evento reprodutivo;
* Agenda derivada.

---

## Animais / Taxonomia

### Use:
* `docs/domain/ANIMAIS_TAXONOMIA.md`

> **Nota:** Adicionar `SOURCE_OF_TRUTH.md` se envolver fonte primária, estado atual ou *read model*.

---

## Lotes / Pastos

### Use:
* `docs/domain/LOTES_PASTOS.md`

> **Nota:** Adicionar eventos se envolver histórico de movimentação, ocupação, ganho de peso ou KPI por período.

---

## Compra / Venda / Sociedade

### Use:
* `docs/domain/COMPRA_VENDA.md`

> **Nota:** Adicionar financeiro/KPI apenas se envolver custo, margem, preço, estoque, *snapshot* econômico ou pagamento.

---

## UX / UI

### Use:
* `docs/ux/UX_PRINCIPLES.md`
* `docs/ux/SCREEN_PATTERNS.md`
* `docs/ux/VISUAL_TOKENS.md`
* Tela afetada.

> ⚠️ **Restrição:** Não carregar docs técnicos de Supabase, sanitário ou KPI para ajuste visual sem regra de domínio.

---

## Login / Auth

### Use:
* `docs/ux/LOGIN_UX.md`
* `docs/technical/SUPABASE_RLS.md`
* Arquivos de autenticação afetados.

> ⚠️ **Restrição:** Não carregar sanitário, KPI, pastos ou manuais completos.

---

## Financeiro / KPI

### Use:
* `docs/finance/KPI_INDEX.md`

### Carregar `docs/finance/KPI_MATRIX_FULL.md` apenas para:
* Modelagem detalhada;
* Cálculo financeiro;
* Painel de indicadores;
* Revisão de fórmulas;
* Definição de novos KPIs.

---

## Manual / Suporte

### Use apenas a página específica:
* `docs/manuals/screens/`
* `docs/manuals/support/`

> ⚠️ **Restrição:** Não carregar manual completo para dúvida de uma única tela.

---

## Documentação

### Use:
* `docs/context/PROJECT_STATUS.md`
* `docs/context/SOURCE_OF_TRUTH.md`
* Skill `reconcile-docs`, se houver *drift* documental.

> ⚠️ **Restrição:** Não atualizar docs derivados sem delta funcional real.

---

## Auditoria Ampla

### Use:
* Índices;
* `SOURCE_OF_TRUTH.md`;
* `PROJECT_STATUS.md`;
* `Graphify`, se houver impacto transversal;
* Arquivos longos apenas após justificar a necessidade.

---

## Não Carregar por Padrão

* `docs/archive/**`
* Auditorias antigas
* Prompts antigos
* Manuais completos
* Matrizes longas
* *Handoffs* substituídos
* Migrations legadas
* Relatórios históricos fechados

```
