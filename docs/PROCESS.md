# Processo de Desenvolvimento (DevOS) - Capability-Centric

> **Status:** Normativo
> **Fonte de Verdade (Execucao):** GitHub (PRs, Issues e Projects)
> **Fonte de Verdade (Analise):** `docs/IMPLEMENTATION_STATUS.md` -> `docs/TECH_DEBT.md` -> `docs/ROADMAP.md` -> `docs/review/RECONCILIACAO_REPORT.md`
> **Ultima Atualizacao:** 2026-04-07

Este documento define o processo de desenvolvimento do RebanhoSync com governanca capability-centric, usando `capability_id` como chave de derivacao entre matriz analitica, divida tecnica, roadmap e reconciliacao.

## 0. Principio central

Toda mudanca relevante de codigo deve se conectar a um `capability_id` do catalogo ou a um item `infra.*` quando estiver fora do catalogo funcional.

Regra pratica:

- o estado analitico nasce em `IMPLEMENTATION_STATUS.md`;
- os gaps abertos viram itens em `TECH_DEBT.md`;
- o recorte de execucao vem de `ROADMAP.md`;
- a consistencia entre esses arquivos e auditada em `docs/review/RECONCILIACAO_REPORT.md`.

## 1. Taxonomia da documentacao

### 1.1 Normativo

Decide contratos, arquitetura e regras de negocio.

Exemplos:

- `docs/PRODUCT.md`
- `docs/SYSTEM.md`
- `docs/PROCESS.md`

### 1.2 Derivado

Mede o estado do repositorio e deve ser mantido coerente por derivacao.

Exemplos:

- `docs/IMPLEMENTATION_STATUS.md`
- `docs/TECH_DEBT.md`
- `docs/ROADMAP.md`
- `docs/review/RECONCILIACAO_REPORT.md`

### 1.3 Snapshot operacional

Resume o estado atual do produto e do repositorio para leitura humana rapida.

Exemplos:

- `README.md`
- `docs/CURRENT_STATE.md`
- `docs/REFERENCE.md`

### 1.4 Historico

Material preservado para consulta, sem valor de verdade operacional.

Exemplos:

- `docs/archive/`
- `docs/ADRs/`

Observacao: `docs/review/` contem apenas os relatorios ainda usados pelos gates documentais. Auditorias antigas ficam em `docs/archive/`.

## 2. Regra de derivacao analitica

### 2.1 Regra unica de gap

`gap(capability_id) = (E2E != PASS) OR (qualquer camada aplicavel em {warning, fail})`

Regras complementares:

- camadas marcadas como `N/A` nao contam como gap;
- `infra.*` nao entra no score funcional nem no `gap_set`;
- a secao editorial dos documentos ajuda na leitura, mas nao substitui a matriz analitica.

### 2.2 Pipeline de derivacao

`IMPLEMENTATION_STATUS` -> `gap_set(capability_id)` -> `TECH_DEBT OPEN` -> `ROADMAP` -> `RECONCILIACAO_REPORT`

Se houver divergencia entre esses arquivos, o report de reconciliacao deve apontar o mismatch explicitamente.

## 3. Espelho operacional no GitHub

As docs sao a fonte de verdade do estado analitico. GitHub e o espelho operacional do trabalho em andamento.

### 3.1 Convencao de titulos

Issues e PRs devem trazer o identificador principal no titulo:

- catalogo funcional: `[<capability_id>] resumo curto`
- infraestrutura: `[infra.<tema>] resumo curto`

Exemplos:

- `[movimentacao.registro] fechar FK composta de lotes`
- `[infra.ci] endurecer validacao de derivacao`

### 3.2 Relacao entre backlog e execucao

- `TECH_DEBT.md` define o conjunto consolidado de gaps abertos;
- `ROADMAP.md` organiza a ordem sugerida de execucao;
- GitHub Projects acompanha prioridade, status e responsavel.

## 4. Fluxo padrao de trabalho

### 4.1 Selecionar o alvo

1. Escolher um item em `TECH_DEBT OPEN` ou no trilho `infra.*`.
2. Confirmar qual `capability_id` ou `infra.*` sera atacado.
3. Criar ou atualizar a Issue correspondente no GitHub.

### 4.2 Implementar

- alterar codigo em `src/**`, `supabase/migrations/**` e `supabase/functions/**` conforme necessario;
- manter coerencia com as fontes normativas em arquitetura, offline, contratos, banco e RLS;
- quando houver mudanca de contrato ou invariante, abrir ADR.

### 4.3 Quality gates antes de concluir

#### Gate A: Qualidade executavel

- `pnpm run lint`
- `pnpm test`
- `pnpm run build`

#### Gate B: Derivacao documental

Quando houver mudanca nos docs derivados, garantir:

- baseline coerente entre `IMPLEMENTATION_STATUS`, `TECH_DEBT`, `ROADMAP` e `RECONCILIACAO_REPORT`;
- presenca de `capability_id` nas secoes derivadas;
- consistencia entre `gap_set`, `TECH_DEBT OPEN` e `ROADMAP`.

Scripts relevantes:

- `scripts/antigravity/validate_scoped_changes.sh`
- `scripts/antigravity/validate_rev_d_headers.sh`
- `scripts/antigravity/data_contract_audit.sh`

#### Gate C: Contratos, seguranca e multi-tenant

Se a mudanca tocar sync, migrations, RLS ou Edge Functions:

- revisar isolamento por `fazenda_id`;
- revisar FKs compostas;
- revisar invariantes append-only e anti-teleporte;
- atualizar as evidencias documentais quando necessario.

### 4.4 Regen dos derivados

Quando o trabalho alterar estado funcional relevante, atualizar os derivados nesta ordem:

1. `docs/IMPLEMENTATION_STATUS.md`
2. `docs/TECH_DEBT.md`
3. `docs/ROADMAP.md`
4. `docs/review/RECONCILIACAO_REPORT.md`

Se a alteracao for apenas de apresentacao, limpeza de arquivos ou organizacao documental sem impacto funcional, nao ha obrigacao de mexer em todos os derivados.

### 4.5 Definition of Done

Um item so vai para concluido quando:

- o codigo necessario esta implementado;
- lint, test e build estao verdes;
- o `capability_id` deixa de aparecer como gap, ou o item `infra.*` foi resolvido;
- os docs derivados foram atualizados quando aplicavel;
- a reconciliacao nao aponta inconsistencias abertas para aquele item.

## 5. Regras para `infra.*`

Itens `infra.*` cobrem estabilidade, DX, CI, documentacao operacional e hygiene do repositorio.

Regras:

- nao entram no `capability_score`;
- podem aparecer em `TECH_DEBT.md` e `ROADMAP.md`;
- devem ter descricao objetiva do risco e do impacto esperado.

## 6. Quando abrir ADR

Abrir ADR quando a mudanca alterar qualquer uma destas bases:

- contrato do sync (`sync-batch`, ordering, deduplicacao, status codes);
- modelo de dados canonico;
- invariantes de RLS, RPC ou RBAC;
- arquitetura offline-first ou estrategia Two Rails;
- regras normativas que deixam de ser apenas implementacao local e passam a orientar o produto.

Template: `docs/ADRs/ADR-0000-template.md`

## 7. Hygiene do repositorio

Para reduzir ruido e evitar drift:

- nao versionar artefatos gerados como `dist/`, caches, `*.tsbuildinfo` e saidas temporarias;
- manter `README.md` e `docs/CURRENT_STATE.md` como leitura inicial do estado atual;
- usar `docs/archive/` para material historico sem valor operacional;
- evitar espalhar relatorios temporarios na raiz do repositorio.

## 8. Resumo operacional

Em caso de duvida, a ordem de consulta deve ser:

1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/PRODUCT.md`
4. `docs/SYSTEM.md`
5. `docs/REFERENCE.md`
6. documentos derivados (`IMPLEMENTATION_STATUS`, `TECH_DEBT`, `ROADMAP`)

Esse encadeamento reduz confusao entre intencao, implementacao e historico.

## 9. Gaps Residuais (beta interno)

No estado atual desta revisao, nao ha TDs residuais abertos.

Quando novos gaps surgirem, eles devem voltar a aparecer aqui apenas depois de entrarem em `TECH_DEBT.md` e `ROADMAP.md`.
