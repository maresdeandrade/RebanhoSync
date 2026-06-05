# ACTIVE_PHASE_PLAN - Fase 10

**Status:** em andamento
**Foco:** UX Operacional dos Fluxos Centrais
**Criado:** 2026-06-04
**Atualizado:** 2026-06-04
**Baseline de handoff:** `84383ab`

---

## Objetivo em 1 parágrafo

Iniciar a Fase 10 com diagnóstico UX/produto dos fluxos centrais do RebanhoSync, preservando o que foi consolidado na Fase 9. A fase deve melhorar clareza, continuidade e fricção operacional das jornadas principais sem criar regra crítica nova, sem antecipar motor comercial/financeiro e sem transformar leitura, snapshot, tag, sinal ou insight em autorização.

---

## Conduta obrigatória de início

A Fase 10 começou por diagnóstico, não por patch direto.

Diagnóstico mínimo:

1. delimitar fluxos centrais a revisar;
2. confirmar estado atual em telas, rotas e componentes afetados;
3. identificar fricções UX com evidência local;
4. separar problema de UX de regra de domínio;
5. propor patch pequeno, reversível e testável;
6. definir validação proporcional antes de editar.

Status local:

- 10A — Diagnóstico UX e mapa de fricção: concluída sem patch.
- 10B — Agenda/Registrar: clareza de intenção futura vs execução real: concluída localmente.
- 10C — Home/Central Operacional: concluída localmente.
- 10D — Animal, Eventos e Histórico: concluída localmente.
- Próximo foco sugerido: 10E — Lotes/Pastos, Relatórios e Compra/Venda.

Resultado da 10B:

- CTA global da Agenda: `Registrar execução`;
- estado vazio da Agenda: `Registrar execução`;
- ação direta de item: `Fechar pendência`;
- hints de item reforçam diferença entre Registrar execução e fechar tarefa futura;
- teste focado de Agenda atualizado.

Não houve alteração em regra de negócio, Supabase, migrations, RLS, RPC, edge functions, schema ou sync.

Resultado da 10C:

- CTA principal da Home: `Registrar execucao`;
- descrição da Home reforça agenda como pendência e Registrar como execução real;
- atalhos de Home passaram a explicitar registro de evento executado;
- copy reforça que atalhos e sinais não autorizam venda, abate ou carência;
- painel da Central explicita estados completo/parcial/vazio/bloqueado;
- sinais auxiliares seguem read-only, sem persistência de tags e sem autorização operacional;
- nenhum cálculo de insight, relatório ou regra crítica foi alterado;
- nenhuma alteração em Supabase, RLS, migrations, RPC, edge functions, schema ou sync.

Resultado da 10D:

- `AnimalDetalhe` explicita `Estado atual`;
- estado, status e classificação são apresentados como leitura operacional, sem autorizar venda ou abate;
- CTA comercial do animal passou para `Registrar venda manual`;
- `Eventos` explicita `Historico de eventos executados`;
- CTA de Eventos passou para `Novo registro manual`;
- copy de Eventos reforça fatos executados, registro manual e que agenda não vira histórico;
- quick action comercial de Registrar passou para `Venda manual`, sem validar aptidão comercial;
- testes focados de AnimalDetalhe, Eventos e quick action de Registrar passaram;
- nenhum cálculo de classificação, evento ou relatório foi alterado;
- nenhuma alteração em Supabase, RLS, migrations, RPC, edge functions, schema ou sync.

---

## Escopo permitido

- Diagnóstico UX/produto dos fluxos centrais.
- Ajustes de clareza, hierarquia, navegação, estados vazios, mensagens e fluxo de trabalho.
- Melhorias read-only em apresentação de informação já existente.
- Organização visual/operacional sem alterar fonte de verdade.
- Testes proporcionais de UI/fluxo quando houver patch.

---

## Escopo proibido

- Criar venda, abate, DRE, ROI, margem, custo por arroba ou motor comercial avançado.
- Criar autorização automática.
- Criar carência liberatória.
- Criar regra crítica baseada em classificação, snapshot, tag, sinal ou insight.
- Criar financeiro automático por sociedade.
- Alterar migrations, RLS, RPCs, edge functions, seed ou sync sem tarefa explícita.
- Reabrir Fase 5, Fase 6, Fase 9A, Fase 9B ou Fase 9C.
- Tratar hardening sanitário residual como nova fase de produto.

---

## Handoff recebido da Fase 9

Fase 9 concluída localmente pela 9D.

Consolidado:

- 9A — Inventário Operacional: concluída localmente.
- 9B — Relatórios Operacionais de Custo Parcial: concluída localmente.
- 9C — Sociedade Patrimonial e Classificação Operacional Read-only: concluída localmente.
- 9D — Fechamento do Gate Fase 9 e Handoff para Próxima Fase: executada.

Riscos residuais P2 permanecem em `docs/review/OPEN_REVIEW_ITEMS.md` e não bloqueiam o início da Fase 10.

---

## Validação inicial recomendada

Antes de qualquer patch:

```bash
git status --short --untracked-files=all
git diff --check
```

Se houver patch funcional:

```bash
pnpm test
pnpm run lint
pnpm run build
```

Se houver Supabase, migrations, RLS, RPC, edge functions, sync-batch ou baseline:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```
