# Codex Prompt — Reconciliar Documentação

Use para alinhar documentação ativa ao estado real do código, dos testes e das fases já validadas.

Não use este prompt para finalizar fase.
Para final de fase, use:

```txt
.agents/prompts/continuity/UPDATE_FINAL_DE_FASE.md
```

---

## Objetivo

Reconciliar documentação com o estado atual do repositório sem criar documentação redundante e sem reabrir fases fechadas.

---

## Escopo

### Documentos-alvo

```txt
[LISTAR_DOCS]
```

### Código ou áreas de referência

```txt
[LISTAR_AREAS_DE_CODIGO]
```

---

## Regras

- Não alterar código de produto.
- Não alterar migrations, seed, RLS, RPCs ou testes.
- Não usar `docs/archive/**` como fonte operacional.
- Não tratar documentação antiga como verdade se contradizer código/migrations atuais.
- Não duplicar contratos já presentes em `.agents/rules/CORE_RULES.md` ou `docs/context/SOURCE_OF_TRUTH.md`.
- Arquivar documentos substituídos em vez de apagar.
- Não arquivar:
  - `docs/review/LAST_PHASE_RESULT.md`;
  - `docs/review/CURRENT_PHASE_HANDOFF.md`;
  - `docs/review/ACTIVE_PHASE_PLAN.md`;
  - `docs/review/OPEN_REVIEW_ITEMS.md`;
  - plano ativo da fase atual.

---

## Fontes de verdade

Seguir esta ordem de precedência:

1. Código + migrations ativas.
2. Testes e validações executadas.
3. `docs/context/PROJECT_STATUS.md`.
4. Docs normativos ativos.
5. Docs derivados.
6. Histórico em `docs/archive/**`.

---

## Verificar

- Docs obsoletos.
- Docs duplicados.
- Prompts longos que devem virar template compacto.
- Auditorias antigas ainda referenciadas como fonte ativa.
- Manuais completos usados como contexto padrão.
- Regras repetidas entre `AGENTS.md`, `.agents/rules`, docs e skills.
- Pendências fechadas listadas como abertas.
- Roadmap usado como backlog técnico.
- Relatórios históricos ainda na pasta ativa.
- `LAST_PHASE_RESULT.md` arquivado indevidamente.

---

## Saída esperada

Aplicar patch documental contendo:

- arquivos criados;
- arquivos alterados;
- arquivos movidos para archive;
- conteúdo extraído antes do arquivamento;
- links/referências atualizados;
- riscos/pendências, no máximo 3.

---

## Validação

Verificar estado local:

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --stat
git diff --check
```

Buscar duplicidade das invariantes:

```bash
rg -n "Agenda = intenção|Evento = fato|state_\\*|Protocolo = regra|Tags, sinais e insights|fonte primária" AGENTS.md docs .agents -g "!docs/archive/**"
```

Listar maiores markdowns ativos no PowerShell:

```powershell
Get-ChildItem -Recurse -File AGENTS.md,*.md |
  Where-Object { $_.FullName -notmatch "docs\\archive|node_modules" } |
  Select-Object FullName, Length |
  Sort-Object Length -Descending
```

---

## Critérios de aceite

- `AGENTS.md` permanece como dispatcher curto.
- `.agents/rules/*` concentra regras de agente.
- Docs longos ficam disponíveis sob demanda.
- Arquivos históricos ficam contidos em `docs/archive/`.
- Nenhuma fonte operacional aponta para `docs/archive/`.
- `LAST_PHASE_RESULT.md` permanece ativo em `docs/review/`.
- `OPEN_REVIEW_ITEMS.md` contém apenas pendências abertas reais.
- `CURRENT_PHASE_HANDOFF.md` aponta para `ACTIVE_PHASE_PLAN.md`.
- Nenhum código funcional foi alterado.