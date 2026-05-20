---
name: prepare-pr
description: Use when implementation is done and you need to review the patch, validate scope, check invariants, and draft a clean pull request body.
---

# Prepare PR

## Missão
Preparar uma entrega para revisão com:
- escopo claro;
- riscos explícitos;
- evidência objetiva de validação;
- narrativa limpa de PR;
- distinção entre o que mudou e o que permaneceu fora de escopo.

Esta skill **não substitui** o gate técnico.  
Antes de concluir a preparação do PR, usar ou consumir o resultado de `rebanhosync-verification-gate`.
---

## Quando usar
Use quando:
- a implementação já terminou;
- você precisa revisar o patch antes de abrir PR;
- quer transformar um conjunto de mudanças em uma entrega revisável;
- a tarefa tocou área crítica do repositório;
- já existe ou deve existir um verification gate concluído.
---

## Quando NÃO usar
Não use para:
- explorar contexto inicial;
- implementar feature do zero;
- refatorar hotspot ainda aberto;
- produzir PR body ignorando validações pendentes;
- corrigir falhas detectadas pelo gate.

Nesses casos, usar:
- `repository-context-retrieval`;
- `harden-module`;
- skill de domínio correspondente;
- `rebanhosync-verification-gate`.
---

## Ler primeiro
1. `AGENTS.md`
2. `README.md`
3. `docs/CURRENT_STATE.md`
4. `docs/PROCESS.md`
---

## Leitura adicional por tipo de mudança

### Arquitetura / domínio
Ler quando aplicável:
- `docs/ARCHITECTURE.md`
- `docs/AGENT_CONTEXT.md`
- `AGENTS.md` local do caminho afetado
- skill de domínio relacionada

### Offline / sync
Ler quando aplicável:
- `src/lib/offline/AGENTS.md`
- `supabase/functions/sync-batch/AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/AGENT_CONTEXT.md`

### Schema / RLS / migrations
Ler quando aplicável:
- `supabase/migrations/AGENTS.md`
- migrations efetivamente tocadas
- `docs/ARCHITECTURE.md`
- `docs/AGENT_CONTEXT.md`

### Docs derivados
Abrir apenas se a mudança tiver impacto funcional real:
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/TECH_DEBT.md`
- `docs/ROADMAP.md`
- `docs/review/RECONCILIACAO_REPORT.md`
---

## Hard constraints
- Não ampliar escopo no fechamento.
- Não incluir refatoração oportunista fora do objetivo principal.
- Não misturar correção estrutural, limpeza e feature nova sem declarar.
- Preferir PR pequeno, coerente e alinhado a uma capability ou trilha `infra.*`.
- Não tratar ausência de validação como detalhe irrelevante.
- Não apresentar PR como pronto se `rebanhosync-verification-gate` terminou em `NOT READY`.
---

## Procedimento

### 1. Identificar o alvo do PR
Definir:
- capability principal ou trilha `infra.*`;
- problema resolvido;
- mudança central;
- arquivos principais afetados.
---

### 2. Confirmar o verification gate
Usar o resultado de `rebanhosync-verification-gate`.
Verificar:
- status final:
  - READY;
  - READY WITH CAVEAT;
  - NOT READY;
- comandos executados;
- pendências técnicas;
- arquivos untracked ou fora de escopo;
- warnings relevantes.

Se o gate não tiver sido executado, ele deve ser feito antes da conclusão da skill.
---

### 3. Revisar o patch
Checar:
- o diff está mínimo?
- existe arquivo fora de escopo?
- há mudança estrutural implícita?
- há duplicação evitável?
- arquivos novos foram considerados?
- docs/skills/scripts alterados combinam com a tarefa?
---

### 4. Revisar invariantes por área
Quando aplicável, verificar:
- Two Rails;
- append-only;
- `fazenda_id`;
- composite FKs;
- rollback / idempotência;
- catálogo global vs tenant-scoped;
- sanitário operacional vs regulatório;
- parto -> pós-parto -> cria inicial;
- anti-teleporte / trânsito / compliance;
- insights read-only.
---

### 5. Revisar impacto documental
Perguntar:
- a mudança exige atualização normativa?
- a mudança exige atualização derivada?
- os documentos devem permanecer inalterados de propósito?
- há drift entre o que o PR entrega e o que os docs dizem?
---

### 6. Redigir o PR
Montar:
- título;
- resumo do problema;
- solução aplicada;
- principais mudanças;
- limites do escopo;
- riscos;
- validações reais executadas;
- docs atualizados ou justificativa para não atualizar.
---

## PR body template

```md
## Contexto
- problema aberto:
- capability / trilha:
- objetivo da entrega:

## O que mudou
- item 1
- item 2
- item 3

## O que NÃO mudou
- fora de escopo 1
- fora de escopo 2

## Arquivos centrais
- `path/file`
- `path/file`
- `path/file`

## Riscos
1. ...
2. ...
3. ...

## Validação
| Comando | Status |
|---|---|
| `pnpm run lint` | PASS / FAIL / NOT RUN |
| `pnpm test` | PASS / FAIL / NOT RUN |
| `pnpm run build` | PASS / FAIL / NOT RUN |

Outros:
- `scripts/codex/validate.ps1`: ...
- `validate-supabase-baseline-functional.mjs`: ...

## Gate final
- `rebanhosync-verification-gate`: READY / READY WITH CAVEAT / NOT READY

## Docs
- atualizados:
- não atualizados porque:

## Expected output
Return:
1. suggested PR title
2. PR body ready to paste
3. list of central files
4. list of risks
5. final checklist before opening