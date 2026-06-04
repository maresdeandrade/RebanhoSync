# Update Final de Fase — RebanhoSync

Atualizado em: 2026-06-04  
Versão: 1.1.0

Use este prompt ao concluir uma fase ou subfase validada.

Este prompt atualiza a documentação permanente de continuidade. Não use para registrar conversa em andamento.

## Prompt

Você é o arquiteto técnico sênior do RebanhoSync.

Objetivo:
Atualizar a documentação de continuidade ao final da fase/subfase atual, sem iniciar nova implementação.

## Restrições

- Não alterar código funcional.
- Não alterar Supabase, migrations, RLS, RPC, schema ou edge functions.
- Não criar nova feature.
- Não reabrir fase fechada sem regressão comprovada.
- Não marcar como concluído o que não foi validado.
- Não inventar commit, teste, arquivo ou resultado.
- Não transformar roadmap em pendência técnica.
- Não arquivar documentos ativos de continuidade.

## Diagnóstico documental obrigatório antes de editar

Entregue primeiro:

1. fase/subfase concluída;
2. status do worktree;
3. commit atual, se confirmável;
4. data atual, se confirmável;
5. arquivos alterados na fase;
6. validações executadas;
7. pendências abertas;
8. pendências fechadas;
9. documentos que precisam atualização;
10. relatórios históricos que podem ser arquivados;
11. documentos que devem permanecer ativos.

## Baseline e data

Antes de atualizar documentação de fase, descobrir o commit e a data atuais.

Executar:

```powershell
git status --short --untracked-files=all
git diff --check
git log --oneline -1
git rev-parse --short HEAD
Get-Date -Format "yyyy-MM-dd"
```

Regras:

- Se houver alterações pendentes, não registrar novo baseline como definitivo.
- Se o worktree estiver limpo, usar `git rev-parse --short HEAD` como `Baseline Commit`.
- Usar `Get-Date -Format "yyyy-MM-dd"` como data documental.
- Não inventar commit ou data.
- Se o commit ainda não foi feito, registrar como “pendente de commit”, não como baseline definitivo.
- Se o objetivo for atualizar documentação após um commit recém-criado, primeiro confirmar `HEAD` limpo e só então atualizar o baseline.

## Atualizar, conforme aplicável

- `docs/review/LAST_PHASE_RESULT.md`
- `docs/review/CURRENT_PHASE_HANDOFF.md`
- `docs/review/ACTIVE_PHASE_PLAN.md`
- `docs/review/OPEN_REVIEW_ITEMS.md`
- `docs/context/PROJECT_STATUS.md`
- `docs/product/ROADMAP.md`
- `docs/archive/review/`, somente para relatórios históricos já resumidos

## Regras por arquivo

### `docs/review/LAST_PHASE_RESULT.md`

Deve permanecer ativo em `docs/review/`.

Registrar:

1. fase concluída;
2. objetivo;
3. arquivos alterados;
4. testes criados/ajustados;
5. comandos executados;
6. resultado de cada comando;
7. resultado técnico;
8. restrições preservadas;
9. pendências remanescentes;
10. riscos;
11. próximo passo recomendado.

Não arquivar `LAST_PHASE_RESULT.md`.

### Campos de baseline/data

Quando houver fechamento validado ou mudança consolidada, atualizar nos documentos aplicáveis:

```md
Atualizado em: YYYY-MM-DD  
**Baseline Commit:** `abcdef0`
```

Aplicar principalmente em:

- `docs/review/LAST_PHASE_RESULT.md`;
- `docs/review/CURRENT_PHASE_HANDOFF.md`;
- `docs/review/ACTIVE_PHASE_PLAN.md`;
- `docs/context/PROJECT_STATUS.md`, somente se houve mudança consolidada;
- `docs/product/ROADMAP.md`, somente se houve mudança macro.

Não aplicar `Baseline Commit` em:

- `.agents/prompts/**`;
- `.agents/rules/**`;
- `.agents/skills/**`.

Esses arquivos de instrução reutilizável devem usar apenas:

```md
Atualizado em: YYYY-MM-DD  
Versão: X.Y.Z
```

### `docs/review/CURRENT_PHASE_HANDOFF.md`

Deve ser curto e apontar para:

- fase atual ou próxima fase;
- `ACTIVE_PHASE_PLAN.md`;
- plano específico da fase, se houver;
- escopo permitido/proibido por referência;
- validação obrigatória por referência;
- bloqueios imediatos, se houver.

Não repetir todo o plano.

### `docs/review/ACTIVE_PHASE_PLAN.md`

Atualizar para a próxima fase/subfase ativa.

Deve conter:

- fase atual;
- subfase atual, se houver;
- objetivo imediato;
- arquivos de referência;
- diagnóstico obrigatório;
- validações mínimas;
- critérios de aceite;
- próximo passo técnico.

### `docs/review/OPEN_REVIEW_ITEMS.md`

Manter apenas pendências abertas reais.

Não colocar roadmap.
Não manter item fechado dentro de “Pendências abertas”.
Mover itens resolvidos para seção de fechados ou remover se já estiverem registrados em `LAST_PHASE_RESULT.md`.

### `docs/context/PROJECT_STATUS.md`

Atualizar apenas se houver mudança consolidada real:

- fase fechada;
- baseline novo;
- contrato de domínio novo;
- lacuna crítica resolvida;
- mudança estratégica;
- gate validado.

Não transformar em diário.

### `docs/product/ROADMAP.md`

Atualizar apenas se houver mudança na sequência planejada de fases.

Roadmap não é backlog técnico.
Roadmap não deve conter pendência operacional granular.

## Arquivamento

Mover para `docs/archive/review/` apenas relatórios históricos fechados e já resumidos, por exemplo:

- `RESULTADO_FASE_*.md`
- `RESULTADO_SUBFASE_*.md`
- `RESULTADO_GATE_*.md`

Não arquivar:

- `CURRENT_PHASE_HANDOFF.md`;
- `ACTIVE_PHASE_PLAN.md`;
- `OPEN_REVIEW_ITEMS.md`;
- `LAST_PHASE_RESULT.md`;
- plano ativo da fase atual.

## Validação obrigatória

```powershell
git status --short --untracked-files=all
git diff --name-only
git diff --stat
git diff --check
```

Se qualquer arquivo de código for alterado por engano, parar e justificar.

## Critérios de aceite

- documentação ativa coerente;
- fase concluída registrada;
- próxima fase/subfase apontada;
- pendências reais mantidas;
- itens fechados não aparecem como abertos;
- relatórios históricos arquivados apenas se já resumidos;
- `LAST_PHASE_RESULT.md` permanece ativo;
- nenhum código funcional alterado;
- baseline/data não foram inventados;
- `git diff --check` passa.

## Resultado final esperado

Responder com:

1. arquivos criados;
2. arquivos alterados;
3. arquivos arquivados;
4. baseline/data usados ou motivo para não atualizar;
5. pendências abertas finais;
6. próxima fase/subfase;
7. validações executadas;
8. confirmação de que não houve implementação funcional.