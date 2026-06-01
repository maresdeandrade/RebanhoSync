# Docs Reconciliation Report — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Registrar a reconciliação documental ativa do RebanhoSync a partir do baseline `3664395`.

Este relatório descreve a nova organização de documentação, os contratos preservados, os riscos tratados e as pendências abertas.

---

## Decisão

Adotar uma estrutura documental separada por função:

```txt
docs/
  context/
  technical/
  domain/
  product/
  ux/
  finance/
  manuals/
  review/
  archive/
```

---

## Motivo

A documentação anterior tendia a misturar:

- fonte de verdade;
- status do projeto;
- regra de domínio;
- decisão de produto;
- UX;
- financeiro;
- manuais;
- auditorias;
- prompts;
- histórico.

Essa mistura aumentava:

- consumo de tokens;
- risco de drift;
- uso de documento antigo como fonte ativa;
- dificuldade de manutenção;
- risco de interpretação errada por agentes.

---

## Baseline

Esta reconciliação usa como marco:

```txt
Baseline Commit: 3664395
```

Todo documento ativo novo ou reconciliado deve conter o baseline no cabeçalho.

---

# Estrutura reconciliada

## 1. `docs/context/`

### Função

Fonte de verdade, status, lacunas e regras gerais de carregamento.

### Arquivos esperados

```txt
docs/context/
  README.md
  CORE_RULES.md
  SOURCE_OF_TRUTH.md
  PROJECT_STATUS.md
  KNOWN_GAPS.md
  CONTEXT_LOADING_MATRIX.md
```

### Contrato

Deve responder:

- qual é a fonte de verdade;
- qual é o estado atual do projeto;
- quais lacunas existem;
- como carregar contexto;
- o que não deve ser inferido.

---

## 2. `docs/technical/`

### Função

Arquitetura, sync, RLS, eventos, agenda e gates técnicos.

### Arquivos esperados

```txt
docs/technical/
  README.md
  ARCHITECTURE.md
  OFFLINE_SYNC.md
  SUPABASE_RLS.md
  EVENTS_AGENDA_CONTRACT.md
  TESTING_GATES.md
  REPO_MAP.md
```

### Contrato

Deve preservar:

- offline-first;
- Dexie/local;
- Supabase/Postgres;
- RLS;
- multi-tenant;
- `fazenda_id`;
- sync;
- rollback;
- idempotência;
- testes.

---

## 3. `docs/domain/`

### Função

Regras agropecuárias e contratos de domínio.

### Arquivos esperados

```txt
docs/domain/
  README.md
  AGRO_BASE.md
  TAGS_SIGNALS_CONTRACT.md
  ANIMAIS_TAXONOMIA.md
  LOTES_PASTOS.md
  SANITARIO.md
  REPRODUCAO.md
  COMPRA_VENDA.md
```

### Contrato

Deve preservar:

```txt
Agenda = intenção/tarefa futura.
Evento = fato histórico executado.
state_* = estado atual/read model.
Protocolo = regra/configuração.
Tags/sinais/insights = auxiliares.
```

---

## 4. `docs/product/`

### Função

Escopo, visão, roadmap, decisões e fora de escopo.

### Arquivos esperados

```txt
docs/product/
  README.md
  PRODUCT_VISION.md
  MVP_SCOPE.md
  CAPABILITY_MAP.md
  ROADMAP.md
  DECISION_LOG.md
  OUT_OF_SCOPE.md
```

### Contrato

Deve responder:

- o que está no MVP;
- o que está parcial;
- o que está bloqueado;
- o que é futuro;
- quais decisões já foram tomadas.

---

## 5. `docs/ux/`

### Função

Experiência do usuário, telas, copy, login e estados visuais.

### Arquivos esperados

```txt
docs/ux/
  README.md
  UX_PRINCIPLES.md
  LOGIN_UX.md
  SCREEN_PATTERNS.md
  FORM_PATTERNS.md
  EMPTY_PARTIAL_BLOCKED_STATES.md
  NAVIGATION_MODEL.md
  COPY_GUIDELINES.md
  VISUAL_TOKENS.md
```

### Contrato

Deve impedir que a UI transforme:

- agenda em histórico;
- sinal em autorização;
- carência sanitária em venda/abate;
- margem parcial em lucro;
- peso registrado em peso atual confiável.

---

## 6. `docs/finance/`

### Função

Custos, snapshots econômicos, KPIs e limites financeiros.

### Arquivos esperados

```txt
docs/finance/
  README.md
  FINANCE_BASE.md
  FINANCIAL_LIMITS.md
  COSTING_CONTRACT.md
  ECONOMIC_SNAPSHOTS.md
  KPI_INDEX.md
  KPI_MATRIX_FULL.md
```

### Contrato

Deve preservar:

```txt
Custo ausente ≠ custo zero.
Margem parcial ≠ lucro final.
Receita de venda ≠ resultado líquido.
Snapshot econômico ≠ preço atual.
Último peso ≠ peso atual confiável.
Carência sanitária ≠ aptidão comercial.
```

---

## 7. `docs/manuals/`

### Função

Manual prático por tela e suporte.

### Estrutura esperada

```txt
docs/manuals/
  README.md
  USER_MANUAL_INDEX.md

  screens/
    AGENDA.md
    ANIMAIS.md
    LOTES_PASTOS.md
    COMPRA_VENDA.md
    REGISTRAR.md
    SANITARIO.md

  support/
    FAQ_LOGIN.md
    FAQ_SYNC.md
    FAQ_AGENDA.md
    FAQ_SANITARIO.md
    TROUBLESHOOTING.md
```

### Contrato

Manual orienta uso.  
Manual não é fonte primária de regra técnica, sanitária, financeira ou RLS.

---

## 8. `docs/review/`

### Função

Revisões ativas, pendências e relatórios acionáveis.

### Arquivos esperados

```txt
docs/review/
  README.md
  ACTIVE_REVIEW_INDEX.md
  DOCS_RECONCILIATION_REPORT.md
  AI_CONTEXT_OPTIMIZATION_REPORT.md
  OPEN_REVIEW_ITEMS.md
  REVIEW_CHECKLIST.md
```

### Contrato

Se ainda orienta ação atual, fica em `docs/review/`.  
Se virou contrato estável, vai para pasta normativa.  
Se foi fechado ou superado, vai para `docs/archive/`.

---

## 9. `docs/archive/`

### Função

Histórico fechado ou substituído.

### Contrato

Não deve ser fonte operacional por padrão.

Usar somente quando:

- pedido explícito;
- auditoria histórica;
- comparação de decisões;
- investigação de regressão documental.

---

# Contratos preservados

## Agenda/Eventos

```txt
Agenda = intenção/tarefa futura.
Evento = fato histórico executado.
```

Risco mitigado:

- usar agenda como histórico;
- concluir agenda como fato sem evento;
- KPI histórico baseado em agenda.

---

## Estado atual

```txt
state_* = estado atual/read model.
```

Risco mitigado:

- usar estado atual como histórico completo;
- calcular permanência sem eventos;
- inferir trajetória passada por snapshot atual.

---

## Protocolo

```txt
Protocolo = regra/configuração.
```

Risco mitigado:

- protocolo isolado ser tratado como execução;
- protocolo gerar carência sem evento;
- protocolo virar compliance executado.

---

## Sinais e insights

```txt
Tags, sinais e insights = auxiliares.
```

Risco mitigado:

- sinal virar decisão crítica;
- insight criar fato;
- tag virar fonte primária.

---

## Carência sanitária

Decisão reconciliada:

```txt
Carência sanitária pode ser sinal limitado quando derivada de evento sanitário estruturado.
Carência sanitária não é liberação final.
Carência sanitária não autoriza venda.
Carência sanitária não autoriza abate.
```

---

## Financeiro

Decisão reconciliada:

```txt
Custo ausente ≠ custo zero.
Margem parcial ≠ lucro final.
Valor de venda ≠ resultado líquido.
```

---

# Riscos remanescentes

## 1. Drift por documentos antigos

Risco:

- arquivo antigo fora do archive continuar sendo usado.

Mitigação:

- mover para `docs/archive/`;
- atualizar `AGENTS.md`;
- usar `CONTEXT_LOADING.md`.

---

## 2. Contradição sobre carência

Risco:

- algum doc antigo ainda tratar carência como totalmente bloqueada ou como liberação.

Mitigação:

- rodar busca textual;
- corrigir docs;
- registrar pendência em `OPEN_REVIEW_ITEMS.md`.

---

## 3. Links quebrados

Risco:

- docs novos citarem caminhos que ainda não existem.

Mitigação:

- validar links após criação;
- revisar índices.

---

## 4. Manuais virarem fonte de regra

Risco:

- agente usar manual de usuário como contrato de domínio.

Mitigação:

- `README.md` da pasta manual deve deixar claro que manual é orientação de uso;
- regras ficam em `docs/context/`, `docs/domain/`, `docs/technical/` e `docs/finance/`.

---

## 5. Matriz KPI ser carregada sempre

Risco:

- `KPI_MATRIX_FULL.md` consumir tokens em tarefa simples.

Mitigação:

- `KPI_INDEX.md` como leitura padrão;
- matriz completa apenas sob demanda.

---

# Validações recomendadas

## Estado do repositório

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --stat
```

## Baseline nos docs

```bash
rg "Baseline Commit" docs .agents AGENTS.md
```

## Contradições de carência

```bash
rg "livre de carência|livre_carencia|carencia_ativa|sem_carencia_vigente|apto para abate|pronto para venda|liberação sanitária" docs .agents
```

## Archive usado indevidamente

```bash
rg "docs/archive" AGENTS.md .agents docs/context docs/technical docs/domain docs/product docs/ux docs/finance docs/manuals docs/review
```

---

# Pendências

As pendências ficam registradas em:

```txt
docs/review/OPEN_REVIEW_ITEMS.md
```

Principais pendências atuais:

- aplicar baseline a todos os documentos ativos;
- validar contradições sobre carência;
- criar/organizar archive;
- revisar links internos;
- revisar skills;
- revisar prompts;
- atualizar matriz de carregamento de contexto.

---

## Critério de conclusão da reconciliação

A reconciliação documental pode ser considerada concluída quando:

- todas as pastas ativas existem;
- todos os arquivos ativos têm baseline;
- `docs/archive/` está separado;
- `AGENTS.md` aponta para regras corretas;
- `.agents/rules/CONTEXT_LOADING.md` está atualizado;
- não há contradição ativa sobre carência;
- docs de manual não são usados como contrato técnico;
- matriz KPI completa não é leitura padrão;
- `git status --short --untracked-files=all` mostra todos os arquivos rastreados ou prontos para commit.