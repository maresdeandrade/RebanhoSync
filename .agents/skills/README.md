# RebanhoSync — Skills Index

Catálogo das skills especializadas do RebanhoSync. O roteamento autoritativo, a composição e a progressão entre fases ficam em `.agents/rules/CONTEXT_LOADING.md`; este índice não redefine essas regras. **Não abra todas as skills por padrão.**

---

## Bootstrap

Antes de escolher uma skill, executar o bootstrap definido em `AGENTS.md` e `.agents/rules/CONTEXT_LOADING.md`. Para comandos e validações, seguir `.agents/rules/rtk.md`. Para precedência factual e procedimental, seguir exclusivamente `.agents/rules/CORE_RULES.md`.

---

## Papéis lógicos

- **Lifecycle:** descoberta, verificação, reconciliação documental e preparação de PR, executadas em fases próprias.
- **Engineering:** hardening, sync/offline e migrations/RLS.
- **Domain:** regras específicas de animais, movimento, reprodução e sanitário.

Durante implementação, usar uma skill principal e no máximo uma skill de apoio conforme `CONTEXT_LOADING.md`. Lifecycle posterior não conta como apoio simultâneo.

---

## Skills Ativas

| Skill | Papel | Quando usar | Não usar quando |
|---|---|---|---|
| **`repository-context-retrieval`** | Lifecycle | O ponto de intervenção não está claro; é preciso localizar arquivos, fluxos, docs ou testes mínimos. | Arquivo-alvo já é conhecido; patch já está pronto; estruturação de PR body. |
| **`rebanhosync-verification-gate`** | Lifecycle | Fechamento técnico de patch, inspeção de diff, untracked, validações e classificação. | Planejamento, descoberta ou implementação em curso. |
| **`reconcile-docs`** | Lifecycle | Reconciliar documentação, prompts ou skills com código e migrations. | Patch sem impacto documental; preparação de PR. |
| **`prepare-pr`** | Lifecycle | Preparar narrativa após gate READY. | READY WITH CAVEAT, NOT READY ou validação ausente. |
| **`harden-module`** | Engineering | Hotspot delimitado com mistura de responsabilidades ou acoplamento. | Ajuste visual/microcopy ou hotspot ainda desconhecido. |
| **`sync-offline-rollback`** | Engineering | Dexie, gestures, fila, rollback, retry, reconcile ou conflito local/remoto. | UI sem persistência ou impacto offline. |
| **`migrations-rls-contracts`** | Engineering | Migrations, RLS, RPC, functions, constraints, RBAC e `fazenda_id`. | Alteração client-side sem backend/schema. |
| **`sanitario-registro-operacional`** | Domain | Evento sanitário, agenda executada, produto, dose e estoque operacional. | Catálogo oficial ou compliance conceitual. |
| **`sanitario-catalogo-regulatorio-compliance`** | Domain | Catálogo, fonte regulatória, overlay, feed-ban, suspeita e compliance. | Aplicação rotineira, dose, estoque ou conclusão operacional. |
| **`reproducao-parto-posparto-cria`** | Domain | Parto, pós-parto, cria, vínculo e agenda neonatal derivada. | Cadastro genérico, IATF amplo não implementado ou sanitário geral. |
| **`animal-cadastro-origem-destino`** | Domain | Identidade, cadastro, proveniência e ciclo de vida cadastral. | Parto/cria, movimentação física ou sanitário. |
| **`movimentacao-transito-conformidade`** | Domain | Movimento físico, lote/pasto, trânsito, GTA e transporte. | Cadastro sem deslocamento ou compliance sem trânsito. |

---

## Skills Arquivadas

| Skill | Motivo |
|---|---|
| `.agents/archive/skills/docs-reconciliation` | Histórico estrutural de migrations/RLS substituído funcionalmente por `migrations-rls-contracts`. Mantido fora da superfície ativa de descoberta. |
