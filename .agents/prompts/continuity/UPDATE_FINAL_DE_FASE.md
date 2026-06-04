# Update Final de Fase — RebanhoSync

Use este prompt ao concluir uma fase ou subfase validada.

Este prompt atualiza a documentação permanente de continuidade.

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

## Diagnóstico documental obrigatório antes de editar

Entregue primeiro:

1. fase/subfase concluída;
2. baseline/commit atual, se informado;
3. arquivos alterados na fase;
4. validações executadas;
5. pendências abertas;
6. pendências fechadas;
7. documentos que precisam atualização;
8. relatórios históricos que podem ser arquivados;
9. documentos que devem permanecer ativos.

## Atualizar, conforme aplicável

- `docs/review/LAST_PHASE_RESULT.md`
- `docs/review/CURRENT_PHASE_HANDOFF.md`
- `docs/review/ACTIVE_PHASE_PLAN.md`
- `docs/review/OPEN_REVIEW_ITEMS.md`
- `docs/context/PROJECT_STATUS.md`
- `docs/product/ROADMAP.md`
- `docs/review/RESULTADO_FASE_*.md`
- `docs/review/RESULTADO_SUBFASE_*.md`
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

### `docs/review/CURRENT_PHASE_HANDOFF.md`

Deve ser curto e apontar para:

- fase atual ou próxima fase;
- `ACTIVE_PHASE_PLAN.md`;
- plano específico da fase, se houver;
- escopo permitido;
- escopo proibido;
- validação obrigatória.

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
- critérios de aceite.

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

Mover para `docs/archive/review/` apenas relatórios históricos fechados, por exemplo:

- `RESULTADO_FASE_*.md`
- `RESULTADO_SUBFASE_*.md`
- `RESULTADO_GATE_*.md`

Não arquivar:

- `CURRENT_PHASE_HANDOFF.md`
- `ACTIVE_PHASE_PLAN.md`
- `OPEN_REVIEW_ITEMS.md`
- `LAST_PHASE_RESULT.md`
- plano ativo da fase atual.

## Validação obrigatória

```bash
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
- `git diff --check` passa.

## Resultado final esperado

Responder com:

1. arquivos criados;
2. arquivos alterados;
3. arquivos arquivados;
4. pendências abertas finais;
5. próxima fase/subfase;
6. validações executadas;
7. confirmação de que não houve implementação funcional.