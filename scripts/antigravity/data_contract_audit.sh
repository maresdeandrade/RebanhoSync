# Antigravity — Evolução para `capability_id` (Upgrade Rev D+)

## 🎯 Objetivo
Evoluir a governança de documentação de um modelo **TD-centrado** (editorial) para um modelo **capability-centrado** (analítico), introduzindo `capability_id` como **join key determinístico** entre:

`IMPLEMENTATION_STATUS → TECH_DEBT → ROADMAP → RECONCILIACAO_REPORT`

**Requisito-chave:** não perder legibilidade atual.
- Preservar as seções editoriais existentes.
- Adicionar uma camada analítica mínima, **mecânica** e **auditável**.

---

## 0) Baseline e Integridade (hard rules)
- Se o usuário fornecer BASELINE: usar.
- Senão: `BASELINE = git rev-parse --short HEAD`
- Se `git status --porcelain` != vazio: **ABORTAR** (não gerar commit).
  - Saída única permitida: atualizar somente `docs/review/RECONCILIACAO_REPORT.md` com:
    - `Baseline Integrity: DIRTY (no-commit)`
    - comandos recomendados (`git status -sb`, `git diff`)
    - lista de arquivos modificados
  - Não alterar os demais arquivos.

---

## 1) Escopo (somente estes arquivos podem mudar)
- docs/IMPLEMENTATION_STATUS.md
- docs/TECH_DEBT.md
- docs/ROADMAP.md
- docs/review/RECONCILIACAO_REPORT.md

Opcional (somente se já existirem no repo):
- scripts/antigravity/validate_derivation_rev_d.sh
- scripts/antigravity/validate_derivation_td.sh (manter como fallback durante transição)

Proibido editar qualquer outro arquivo.

---

## 2) Fontes permitidas (não inventar)
### Código (fonte de verdade para claims)
- src/**
- supabase/migrations/**
- supabase/functions/**

### Docs referência (somente leitura)
- docs/ARCHITECTURE.md
- docs/DB.md
- docs/OFFLINE.md
- docs/CONTRACTS.md
- docs/EVENTOS_AGENDA_SPEC.md
- docs/E2E_MVP.md
- docs/RLS.md

Regra: toda afirmação estrutural relevante exige evidência mínima:
- `PM:` path + linha(s) aproximadas
- opcional `P:` comando `rg -n` reproduzível

---

## 3) Resultado esperado (o que `capability_id` deve habilitar)
- Cada capacidade importante possui `capability_id` estável:
  - formato: `<dominio>.<capability>`
- `IMPLEMENTATION_STATUS` passa a conter **Matriz Analítica** com `capability_id` (sem remover editorial).
- `TECH_DEBT` passa a referenciar `capability_id` em **todo TD** (OPEN/CLOSED).
- `ROADMAP` lista itens derivados **somente** de `TECH_DEBT OPEN`, sempre com `TD-###` + `capability_id`.
- `RECONCILIACAO_REPORT` registra:
  - progresso da migração
  - mapping TD → capability_id (e ambiguidades)
  - `NEW (Proposed)` (capabilities fora do catálogo)

---

## 4) Determinismo (reduzir churn)
### 4.1 Ordenação fixa
- Domínios (ordem fixa): sanitario, pesagem, nutricao, movimentacao, reproducao, financeiro, agenda
- Camadas (ordem fixa): DB → Server → Offline → UI Write → UI Read/Hist → E2E
- Status permitido por célula: `✅` | `⚠️` | `❌` | `— (N/A)`

### 4.2 Source of derivation (regra)
- **Somente** a Matriz Analítica alimenta:
  - `gap(capability_id)` → TECH_DEBT OPEN → ROADMAP
- Seções editoriais continuam existindo, mas **não** são fonte de derivação.

---

## 5) Catálogo inicial (mínimo viável)
### 5.1 Regra
- Criar um **Capability Catalog** dentro de `docs/IMPLEMENTATION_STATUS.md` (na seção analítica).
- O catálogo deve ser pequeno e estável: **somente** domínios/capabilities já suportados no repo/documentos.
- Se surgir capability fora do catálogo: registrar no `RECONCILIACAO_REPORT` como:
  - `NEW (Proposed)` com evidência (PM/P)
  - **não entra** em score/TD/roadmap até ser promovida ao catálogo

### 5.2 Sugestão base (usar apenas se casar com o repo; remover o que não existir)
- sanitario: registro, historico, agenda_link
- pesagem: registro, historico
- nutricao: registro, historico (estoque = OUT-OF-SCOPE)
- movimentacao: registro, historico, anti_teleport_client
- reproducao: registro, historico, episode_linking
- financeiro: registro, historico
- agenda: gerar, concluir, dedup, recalculo

---

## 6) Layer Applicability Map (obrigatório)
Para evitar dívida falsa, definir aplicabilidade por capability (ou por família), e usar `— (N/A)` nas camadas não aplicáveis.

Regras mínimas:
- `*.registro`: UIW aplicável; persistência (DB e/ou Offline) aplicável; E2E aplicável; UIR aplicável para PASS (readback).
- `*.historico`: UIR aplicável; UIW geralmente `—`; demais camadas conforme fonte dos dados.
- validações client-only (ex.: `movimentacao.anti_teleport_client`): UIW e E2E aplicáveis; DB/SRV/OFF/UIR = `—`.

`— (N/A)`:
- não exige evidência
- não conta como gap
- não gera TECH_DEBT

---

## 7) Como migrar sem churn (preservar editorial + adicionar analítico)

### 7.1 docs/IMPLEMENTATION_STATUS.md
1) Preservar seções existentes (Resumo executivo + tabelas por domínio).
2) Adicionar seção nova:
   - `## Matriz Analítica (capability_id)`
3) Inserir tabela com colunas fixas:
   - `capability_id | DB | Server | Offline | UI Write | UI Read/Hist | E2E | Evidence (EIDs)`
4) Exigir unicidade:
   - cada `capability_id` do catálogo deve aparecer **exatamente uma vez** na tabela.
5) Evidência via Evidence Index com EIDs **por célula**:
   - EID padrão: `[E.<dominio>.<capability>.<layer>]`
   - layers permitidos: `DB`, `SRV`, `OFF`, `UIW`, `UIR`, `E2E`
   - no fim da seção analítica: `### Evidence Index`
6) Definir gap determinístico:
   - `gap(capability_id) = (E2E != PASS) OR (qualquer camada aplicável ∈ {⚠️, ❌})`
7) Score (opcional, mas determinístico):
   - `capability_score = (#capability_id com E2E == PASS) / (total capability_id do catálogo)`

**Regra:** manter o editorial; adicionar nota: “A Matriz Analítica é a fonte de derivação”.

---

### 7.2 docs/TECH_DEBT.md
1) Não renumerar TD IDs.
2) Para cada TD (OPEN e CLOSED), adicionar campo determinístico:
   - `capability_id: <...>`
3) Regra de cardinalidade:
   - **1 TD → 1 capability_id**
   - Se um TD cobrir múltiplas capabilities:
     - manter o TD como está (para não quebrar histórico)
     - registrar no `RECONCILIACAO_REPORT` como **Split Proposal** com tabela:
       - `TD | capability_id(s) propostos | rationale | impacto`
4) Consistência obrigatória:
   - conjunto `capability_id` em `TECH_DEBT OPEN` == conjunto de `gap(capability_id)` do `IMPLEMENTATION_STATUS`

Se algum TD não mapear claramente:
- registrar no report como `Mapping Ambiguity` + evidência + proposta (sem renumerar, sem apagar histórico).

---

### 7.3 docs/ROADMAP.md
1) ROADMAP deve conter **somente** itens de `TECH_DEBT OPEN` (nenhum item extra).
2) Cada item do roadmap deve incluir:
   - `TD-###` + `capability_id`
3) Manter a estrutura/horizonte atual; apenas tornar a derivação mecânica.

---

### 7.4 docs/review/RECONCILIACAO_REPORT.md
Adicionar seção fixa:
- `## capability_id Migration`
  - BASELINE + data
  - Status da migração (ex.: `% TDs com capability_id`, `% catálogo coberto`)
  - Tabela:
    - `TD | capability_id | status (OPEN/CLOSED) | notas`
  - `NEW (Proposed)` (se houver)
  - `Mapping Ambiguity` (se houver)
  - `Split/Merge Proposals` (se houver)
  - comandos `rg` usados (reproduzíveis)

---

## 8) Compatibilidade (modo transicional)
Durante a migração:
- `TD-###` continua existindo como identificador humano/histórico.
- `capability_id` passa a ser o join key principal para derivação.
- Se houver divergência entre validação por TD e por capability:
  - reportar no RECONCILIACAO_REPORT como “Transitional Inconsistency”
  - priorizar correção do mapping (sem inventar capabilities)

---

## 9) Critérios de aceitação (hard)
- Working tree CLEAN (senão: modo DIRTY report-only).
- Todos os 4 arquivos atualizados possuem cabeçalho Rev D:
  - Status, Baseline, Última Atualização, Derivado por
- `IMPLEMENTATION_STATUS` contém:
  - Capability Catalog
  - Layer Applicability Map
  - Matriz Analítica com `capability_id` (únicos, completos para o catálogo)
  - Evidence Index (EIDs por célula)
- Todo TD em `TECH_DEBT` tem exatamente **1** `capability_id`.
- `TECH_DEBT OPEN capability_id set` == `IMPLEMENTATION_STATUS gap set`.
- `ROADMAP items` == `TECH_DEBT OPEN` (mesmo conjunto de TD IDs e capability_id).
- Capabilities fora do catálogo não entram em score/TD/roadmap; vão para `NEW (Proposed)` no report.
- Evidências (PM/P) presentes para claims estruturais relevantes.

---

## 10) Output
- Entregar o conteúdo completo atualizado dos 4 arquivos.
- Se CLEAN: um commit único:
  - `docs: introduce capability_id derivation (baseline <BASELINE>)`
- Se DIRTY: nenhum commit; apenas RECONCILIACAO_REPORT com warning.

---

## 11) Heurísticas úteis (para mapear TD → capability_id)
- Use nomes de seções atuais (domínios) e builders/offline:
  - `createGesture`, `syncWorker`, `tableMap`, `syncOrder`
- Use migrations/tabelas:
  - `eventos_*`, `agenda_*`, `state_*`
- Registrar no report quando:
  - 1 TD cobre múltiplas capabilities (propor split)
  - múltiplos TDs cobrem a mesma capability (propor merge)
