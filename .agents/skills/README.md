```markdown
# RebanhoSync — Skills Index

Skills especializadas para agentes atuarem no RebanhoSync sem reler o repositório inteiro a cada tarefa.  
Use uma skill apenas quando o tipo real da tarefa exigir. **Não abra todas as skills por padrão.**

---

## Regra Geral

Antes de escolher uma skill:
1. Leia `AGENTS.md`.
2. Leia `.agents/rules/CORE_RULES.md`.
3. Leia `.agents/rules/CONTEXT_LOADING.md`.
4. Leia `.agents/rules/no-broad-context.md`.
5. Escolha no máximo **1 skill principal**.
6. Use uma segunda skill apenas se houver interseção real de domínio crítico.

> ⚙️ **Execução e Comandos:** Para comandos, testes, Graphify, pnpm, WSL/Windows e validações locais, use obrigatoriamente as diretrizes contidas em `.agents/rules/rtk.md`.

*Nota: Não use `docs/archive/**` como fonte operacional de verdade.*

---

## Fonte de Verdade em Conflito

Em caso de divergência ou conflito de informações, confie estritamente nesta ordem de precedência:
1. Código + migrations ativas.
2. `docs/context/PROJECT_STATUS.md`.
3. Documentos normativos ativos.
4. Documentos derivados.
5. Histórico em `docs/archive/**`.
6. Definições desta Skill.

> 💡 A skill apenas orienta o procedimento de trabalho do agente. Ela não substitui o código-fonte, migrations ativas ou contratos normativos atuais do sistema.

---

## Skills Ativas

| Skill | Quando usar | Não usar quando |
|---|---|---|
| **`repository-context-retrieval`** | O ponto de intervenção não está claro; é preciso localizar arquivos, fluxos, docs ou testes mínimos. | Arquivo-alvo já é conhecido; patch já está pronto; estruturação de PR body. |
| **`rebanhosync-verification-gate`** | Fechamento técnico de patch, inspeção de diff, checagem de arquivos untracked, validações locais e classificação READY/NOT READY. | Etapas de planejamento, descoberta inicial de contexto ou implementação de código. |
| **`prepare-pr`** | Preparar a narrativa do PR (título/corpo) após o patch ter sido formalmente validado e aprovado pelo verification gate. | Corrigir bugs, revisar arquiteturas ou compensar a falta de validações executadas. |
| **`harden-module`** | Hotspots com mistura de responsabilidades, regras de negócio vazadas na UI, alto acoplamento ou necessidade de hardening incremental. | Ajuste visual de layout ou alterações simples de microcopy/texto; tarefas sem risco arquitetural. |
| **`reconcile-docs`** | Reconciliar formalmente documentações, prompts ou skills com o estado real atual do código e das migrations. | Patch de produto localizado sem impacto documental; preparação de PR body. |
| **`sync-offline-rollback`** | Manipulação do Dexie, criação de gestures, fila de sincronização, comportamento otimista, rollback, retry, reconcile, conflito local/remoto ou lógica de `sync-batch`. | UI simples e pontual sem persistência de dados ou impacto em sincronização. |
| **`migrations-rls-contracts`** | Criação ou ajuste de migrations, escrita de RLS policies, RPCs, functions, triggers, chaves estrangeiras compostas, RBAC e isolamento estrito por `fazenda_id`. | Alterações client-side puras sem impacto no backend ou no schema do banco de dados. |
| **`sanitario-registro-operacional`** | Registro manual de eventos sanitários, vacinação, tratamentos, conclusão de agenda sanitária, dados de produtos, doses e consumo/baixa de lotes de estoque. | Modelagem de compliance regulatório abrangente, catálogos oficiais, biossegurança ou regras de feed-ban. |
| **`sanitario-catalogo-regulatorio-compliance`** | Estruturação de catálogos oficiais, overlays estaduais, regras de feed-ban, notificações compulsórias, fluxo de suspeita clínica, biossegurança e checklists de conformidade. | Registro operacional ou manual simples de aplicações sanitárias rotineiras. |
| **`reproducao-parto-posparto-cria`** | Eventos de parto, manejo de pós-parto, nascimento e criação de cria, vínculo determinístico mãe-cria e geração de agendas derivadas do ciclo de vida do bezerro. | Cadastros-base simples de animais, planejamento amplo de IATF não implementado ou agenda sanitária geral. |
| **`animal-cadastro-origem-destino`** | Cadastro, edição e identificação base de animais, registros de entrada/saída, fluxos de compra/venda, registro de óbito, categorizações taxonômicas e integridade da identidade do animal. | Fluxos de parto/cria específicos, movimentação interna entre lotes/pastos, manejo sanitário ou geração de KPIs financeiros. |
| **`movimentacao-transito-conformidade`** | Movimentação física de animais entre lotes ou pastos, trânsito animal inter-fazendas, emissão/vínculo de GTA, transportes e conformidades/regras associadas ao trânsito. | Ajuste puramente visual em cartões de lote/pasto; compliance sanitário sem transporte ou trânsito físico envolvido. |

---

## Skills Arquivadas

| Skill | Motivo |
|---|---|
| `_archive/docs-reconciliation` | Substituída e consolidada por `reconcile-docs`. **Não usar como skill ativa.** |

```