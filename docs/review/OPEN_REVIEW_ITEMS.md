# Open Review Items — RebanhoSync

Atualizado em: 2026-06-02
**Baseline Commit:** `32d7779`

## Objetivo

Registrar pendências abertas identificadas durante a reorganização documental, auditoria de contexto/agentes e revisão do estado atual do RebanhoSync.

Este documento deve conter apenas itens ainda acionáveis.

Quando uma pendência for resolvida, mover para histórico ou registrar no relatório correspondente.

---

## Critérios de prioridade

| Prioridade | Critério |
|---|---|
| `P0` | Risco de erro operacional, segurança, RLS, perda de dados ou decisão crítica falsa. |
| `P1` | Risco de drift documental, duplicidade de fonte ou alto consumo de contexto. |
| `P2` | Melhoria de clareza, organização, suporte ou manutenção. |
| `P3` | Ajuste cosmético/documental não bloqueante. |

---

## Status

| Status | Significado |
|---|---|
| `ABERTO` | Ainda não iniciado. |
| `EM_ANDAMENTO` | Está sendo tratado. |
| `BLOQUEADO` | Depende de decisão, fonte ou validação. |
| `PRONTO_PARA_VALIDAR` | Patch feito, falta validação. |
| `FECHADO` | Resolvido; deve sair deste arquivo em próxima limpeza. |

---

# Pendências abertas

## P0 — Garantir baseline em todos os documentos ativos

**Status:** `ABERTO`  
**Área:** documentação  
**Risco:** perda de rastreabilidade pós-baseline.

### Descrição

Todos os documentos ativos novos ou reconciliados devem conter:

```md
Atualizado em: 2026-05-31  
**Baseline Commit:** `3664395`
```

### Áreas afetadas

- `docs/context/`
- `docs/technical/`
- `docs/domain/`
- `docs/product/`
- `docs/ux/`
- `docs/finance/`
- `docs/manuals/`
- `docs/review/`
- `.agents/rules/`
- `.agents/skills/`
- `.agents/prompts/`
- `AGENTS.md`

### Critério de aceite

- `rg "Baseline Commit" docs .agents AGENTS.md` retorna todos os arquivos ativos esperados.
- Nenhum documento ativo novo fica sem baseline.
- Arquivos em `docs/archive/**` podem manter cabeçalho histórico próprio.

---

## P0 — Verificar contradições sobre carência sanitária

**Status:** `ABERTO`  
**Área:** sanitário / domínio / UX / produto  
**Risco:** app ou agente interpretar carência como venda/abate/liberação final.

### Descrição

Garantir consistência em toda documentação:

```txt
Carência sanitária pode ser sinal limitado.
Carência sanitária exige evento sanitário estruturado.
Carência sanitária não libera venda.
Carência sanitária não libera abate.
Carência sanitária não é liberação sanitária final.
```

### Comandos sugeridos

```bash
rg "livre de carência|livre_carencia|carencia_ativa|sem_carencia_vigente|apto para abate|pronto para venda|liberação sanitária" docs .agents
```

```bash
rg "Carência ativa.*Bloqueado|Livre de carência.*Bloqueado|sanitario:livre_carencia.*bloqueado|sanitario:carencia_ativa.*bloqueado" docs .agents
```

### Critério de aceite

- `sanitario:carencia_ativa` e `sanitario:sem_carencia_vigente` aparecem como sinais permitidos com restrição.
- `sanitario:liberacao_final`, `comercial:pronto_venda` e `comercial:apto_abate` seguem bloqueados.
- Copy evita “livre de carência” como mensagem principal.
- Manuais e UX explicam que carência não autoriza venda/abate.

---

## P1 — Consolidar `docs/archive/`

**Status:** `ABERTO`  
**Área:** documentação  
**Risco:** agentes usarem auditorias antigas como fonte ativa.

### Descrição

Criar/organizar `docs/archive/` para mover:

- auditorias antigas;
- handoffs fechados;
- relatórios substituídos;
- prompts antigos;
- documentação superada;
- outputs de fases encerradas.

### Critério de aceite

- `docs/archive/README.md` explica que archive não é fonte operacional.
- `AGENTS.md` e `.agents/rules/CONTEXT_LOADING.md` instruem não abrir archive por padrão.
- Docs ativos não dependem de archive como fonte principal.

---

## P1 — Validar links internos da documentação reorganizada

**Status:** `ABERTO`  
**Área:** documentação  
**Risco:** docs apontarem para arquivos inexistentes ou renomeados.

### Descrição

Depois de criar as pastas novas, revisar links para:

- `docs/context/`
- `docs/technical/`
- `docs/domain/`
- `docs/product/`
- `docs/ux/`
- `docs/finance/`
- `docs/manuals/`
- `docs/review/`

### Critério de aceite

- Links internos relevantes existem.
- Nomes seguem `UPPER_SNAKE_CASE.md` para arquivos normativos.
- Pastas seguem lowercase.

---

## P1 — Revisar `.agents/skills/` para evitar sobreposição

**Status:** `ABERTO`  
**Área:** agentes / skills  
**Risco:** skill errada carregar contexto excessivo ou regra antiga.

### Descrição

Validar que cada skill:

- tem escopo claro;
- não repete todo o contexto global;
- aponta para `AGENTS.md` e `.agents/rules/`;
- não carrega docs amplos por padrão;
- não contradiz carência sanitária ponderada;
- não usa archive como fonte ativa.

### Critério de aceite

- `docs-reconciliation` legado arquivado ou removido se duplicar `reconcile-docs`.
- Cada skill tem entrada no índice `.agents/skills/README.md`.
- Skills sanitárias refletem carência como sinal, não autorização.

---

## P1 — Revisar `.agents/prompts/` para reduzir verbosidade

**Status:** `ABERTO`  
**Área:** prompts / agentes  
**Risco:** prompts longos repetirem regras já centralizadas.

### Descrição

Prompts devem:

- ser curtos;
- referenciar `AGENTS.md`;
- referenciar `.agents/rules/CONTEXT_LOADING.md`;
- declarar arquivos-alvo;
- declarar validações;
- evitar repetir contexto amplo do RebanhoSync;
- evitar instruções duplicadas entre prompts.

### Critério de aceite

- Prompts reutilizam blocos mínimos.
- Não há prompt com contexto fixo excessivo.
- Cada prompt tem escopo, restrições, validações e critérios de aceite.

---

## P1 — Confirmar convenção de nomes em `docs/manuals/`

**Status:** `ABERTO`  
**Área:** manuais  
**Risco:** inconsistência entre arquivos e links.

### Decisão atual

Pastas em lowercase.

Arquivos em `UPPER_SNAKE_CASE.md`.

Estrutura esperada:

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

### Critério de aceite

- Arquivos criados conforme estrutura.
- Links no índice funcionam.
- Manuais não viram fonte de regra técnica.

---

## P1 — Atualizar matriz de carregamento de contexto

**Status:** `ABERTO`  
**Área:** agentes / documentação  
**Risco:** agentes ainda abrirem documentos grandes sem necessidade.

### Descrição

Atualizar referências para incluir:

- `docs/finance/`
- `docs/manuals/`
- `docs/review/`
- `docs/archive/`

### Critério de aceite

- Tarefa simples usa só doc específico.
- KPI usa `KPI_INDEX.md` antes de `KPI_MATRIX_FULL.md`.
- Manual completo não é leitura padrão.
- Review ativo não é usado como fonte final se já virou contrato estável.

---

## P2 — Criar checklist de revisão para PR documental

**Status:** `ABERTO`  
**Área:** revisão / PR  
**Risco:** PR de documentação passar sem validar drift e baseline.

### Descrição

Criar template de PR ou checklist específico para documentação:

- baseline presente;
- links internos;
- pasta correta;
- sem duplicidade;
- sem contradição com contratos;
- archive separado.

### Critério de aceite

- Checklist incorporado em `REVIEW_CHECKLIST.md` ou template de PR.
- Usado nas próximas revisões documentais.

---

## P2 — Separar revisão ativa de contrato estável

**Status:** `ABERTO`  
**Área:** docs/review  
**Risco:** `docs/review/` virar fonte de verdade permanente.

### Regra

```txt
Review ativo → docs/review/
Contrato estável → docs/context|technical|domain|product|ux|finance/
Histórico fechado → docs/archive/
```

### Critério de aceite

- `ACTIVE_REVIEW_INDEX.md` mostra data/status de cada revisão.
- Revisões fechadas saem da pasta ou são arquivadas.
- Docs de review não substituem `SOURCE_OF_TRUTH.md`.

---

## P2 — Validar comando de estado do repo após criação dos docs

**Status:** `ABERTO`  
**Área:** validação  
**Risco:** arquivos untracked ficarem fora de revisão.

### Comandos

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --stat
```

### Critério de aceite

- Arquivos novos aparecem no status.
- PR inclui todos os arquivos criados.
- Não depender apenas de `git diff` para arquivos untracked.

---

# Itens fechados

## Fase 6 — Sanitária em staging, sync/replay e RLS

**Status:** `FECHADO`
**Área:** sanitário / sync / RLS / sociedade
**Relatório:** `docs/review/RESULTADO_FASE_6_SANITARIA_STAGING_SYNC_RLS.md`

### Fechado nesta versão

- Contrato de payload corretivo sanitario formalizado.
- Replay corretivo idempotente validado.
- Sociedade validada como patrimonial, sem sanitario/conformidade/financeiro automatico.
- Baseline funcional Supabase ampliado e validado para sanitario, estoque e sociedade.

## Gate Suite Global Pos-Fase 6

**Status:** `FECHADO`
**Área:** testes / UI
**Relatório:** `docs/review/RESULTADO_GATE_SUITE_GLOBAL_POS_FASE_6.md`

### Fechado nesta versão

- `LoteEditarData.test.ts` isolado por banco Dexie unico e cleanup explicito.
- Vitest configurado com `maxWorkers: 2` para estabilidade local.
- `pnpm test -- --run` passou.

---

## Manutenção

Atualizar este arquivo quando:

- nova pendência for identificada;
- pendência for resolvida;
- risco mudar de prioridade;
- revisão ativa for encerrada;
- contrato sair de review para doc estável.

Remover itens fechados em ciclos de limpeza e mover resumo para `docs/archive/` quando fizer sentido.
