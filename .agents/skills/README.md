# RebanhoSync — Skills Index

Este diretório concentra skills especializadas para o Codex atuar no RebanhoSync sem reler o repositório inteiro a cada tarefa.

## Como usar estas skills

Escolha a skill pelo **tipo real de problema**, não pelo nome da tela.

Ordem prática:
1. identificar o domínio principal da tarefa
2. abrir a skill correspondente
3. ler apenas os arquivos indicados
4. evitar expandir para outros domínios sem necessidade
5. entregar diff mínimo, riscos e validação focada

## Regras gerais

- As skills **não substituem** o `AGENTS.md` raiz.
- O `AGENTS.md` raiz define o enquadramento geral do projeto.
- Cada skill restringe leitura, destaca invariantes e reduz custo de contexto.
- Em caso de conflito:
  1. código + migrations
  2. `docs/CURRENT_STATE.md`
  3. docs normativos
  4. skill
- Não usar material histórico como fonte operacional.
- Workflows antigos do Cline foram absorvidos aqui como skills do Codex.

## Skills disponíveis

### 1) `harden-module`
Use quando a tarefa for sobre:
- hotspot com mistura de responsabilidades
- hardening arquitetural incremental
- separação entre Normalize / Select-Policy / Payload / Plan / Effects / Reconcile
- refatoração incremental de módulos como `Registrar` e `syncWorker`

Não usar para:
- bug visual local
- ajuste simples de texto
- mudança operacional pequena sem dívida arquitetural real

### 2) `prepare-pr`
Use quando a tarefa for sobre:
- revisar patch pronto
- preparar PR
- checar escopo, riscos, invariantes e validação
- montar título e corpo do PR

Não usar para:
- implementar feature do zero
- refatorar hotspot
- reconciliação documental ampla

### 3) `reconcile-docs`
Use quando a tarefa for sobre:
- reconciliar documentação com o estado real do código
- medir delta da iteração
- atualizar snapshot, normativos ou derivados
- fechar drift documental

Não usar para:
- pequena mudança local sem impacto funcional
- ajuste visual
- simples refino de wording sem reconciliação real

### 4) `sanitario-registro-operacional`
Use quando a tarefa for sobre:
- registrar evento sanitário
- concluir item de agenda sanitária
- vacinação, vermifugação, tratamento, exame sanitário
- `produtos_veterinarios`
- fluxo operacional em `Registrar`, `Agenda`, `Eventos`, `Relatorios`

Não usar para:
- catálogo oficial
- overlay estadual
- `conformidade`
- `feed-ban`
- bloqueios regulatórios amplos

### 5) `sanitario-catalogo-regulatorio-compliance`
Use quando a tarefa for sobre:
- catálogo oficial sanitário
- overlay estadual
- pack oficial
- `fazenda_sanidade_config`
- `conformidade`
- `feed-ban`
- suspeita/notificação sanitária
- bloqueios regulatórios
- `regulatoryReadModel`

Não usar para:
- registro sanitário manual simples
- autocomplete de produto
- ajuste local de formulário operacional

### 6) `animal-cadastro-origem-destino`
Use quando a tarefa for sobre:
- cadastro-base do animal
- criação ou edição de animal
- origem, entrada, compra
- venda, saída, morte
- status do animal
- separação entre atributo-base e projeção derivada

Não usar para:
- parto
- pós-parto
- cria inicial
- episode linking
- trânsito/GTA

### 7) `reproducao-parto-posparto-cria`
Use quando a tarefa for sobre:
- cobertura / IA
- diagnóstico de gestação
- parto
- pós-parto
- cria inicial
- ficha reprodutiva
- episode linking
- fatos reprodutivos que projetam `taxonomy_facts`

Não usar para:
- cadastro-base simples
- compra/venda
- movimentação
- sanitário regulatório

### 8) `movimentacao-transito-conformidade`
Use quando a tarefa for sobre:
- movimentação entre lotes ou pastos
- anti-teleporte
- trânsito externo
- GTA/e-GTA
- PNCEBT
- bloqueio por suspeita sanitária
- bloqueio por compliance
- tracing operacional de origem-destino

Não usar para:
- cadastro-base simples
- reprodução
- sanitário operacional simples
- catálogo regulatório fora do impacto em movimentação

### 9) `sync-offline-rollback`
Use quando a tarefa for sobre:
- Dexie
- offline-first
- gestures
- `queue_gestures`, `queue_ops`, `queue_rejections`
- rollback
- `before_snapshot`
- `tableMap`
- pull
- `syncWorker`
- retry
- idempotência
- telemetria de sync

Não usar para:
- ajuste local de UI sem impacto em sync/store
- regra de domínio pura sem impacto offline

### 10) `migrations-rls-contracts`
Use quando a tarefa for sobre:
- migrations SQL
- schema
- FKs compostas
- enums
- views
- triggers append-only
- RLS / RBAC
- RPCs `SECURITY DEFINER`
- contratos versionados
- catálogo global versus tenant-scoped

Não usar para:
- ajuste puramente de UI
- refino local sem impacto estrutural

### 11) `docs-reconciliation`
Use quando a tarefa for sobre:
- reconciliar documentação
- medir delta real da iteração
- atualizar `IMPLEMENTATION_STATUS`
- `TECH_DEBT`
- `ROADMAP`
- `RECONCILIACAO_REPORT`
- decidir se precisa ADR
- fechar drift documental

Não usar para:
- pequena mudança local sem pedido de atualização documental
- ajuste visual
- refatoração interna sem impacto funcional real

## Mapa rápido por tipo de tarefa

### Refatoração arquitetural
- hotspot com mistura de camadas -> `harden-module`

### Fechamento de entrega
- revisão final e corpo de PR -> `prepare-pr`

### Governança documental
- snapshot / backlog / roadmap / drift -> `reconcile-docs` ou `docs-reconciliation`

### Fluxo operacional diário
- sanitário manual -> `sanitario-registro-operacional`
- movimentação interna/externa -> `movimentacao-transito-conformidade`
- cadastro/compra/venda -> `animal-cadastro-origem-destino`
- parto/pós-parto/cria -> `reproducao-parto-posparto-cria`

### Infraestrutura
- rollback / Dexie / sync -> `sync-offline-rollback`
- migration / RLS / contrato -> `migrations-rls-contracts`

### Regulatório sanitário
- pack oficial / compliance / overlay -> `sanitario-catalogo-regulatorio-compliance`

## Regras de escalonamento

Se a tarefa começar em uma skill e tocar outra fronteira:

- de hardening para PR -> escalar para `prepare-pr`
- de hardening para docs -> escalar para `reconcile-docs`
- de sanitário operacional para regulatório -> escalar para `sanitario-catalogo-regulatorio-compliance`
- de domínio para Dexie/sync/rollback -> escalar para `sync-offline-rollback`
- de código para schema/RLS/contrato -> escalar para `migrations-rls-contracts`

## O que evitar

- abrir várias skills ao mesmo tempo sem necessidade
- usar uma skill de domínio para decidir migration estrutural
- usar skill documental para implementar feature
- usar material de `docs/archive/**` como fonte operacional
- reintroduzir nomenclatura antiga do projeto

## Convenção de manutenção

Ao editar ou criar nova skill:
- manter escopo estreito
- explicitar “quando usar” e “quando não usar”
- referenciar só fontes de verdade atuais
- evitar exemplos longos e excesso de snippet
- revisar se a skill ainda bate com `docs/CURRENT_STATE.md`

## Observação

Se uma tarefa não encaixar claramente em nenhuma skill, começar por:
- `AGENTS.md` raiz
- `docs/CURRENT_STATE.md`
- `docs/PROCESS.md`

e só então decidir se precisa criar uma nova skill.