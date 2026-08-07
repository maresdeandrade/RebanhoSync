# Start Nova Conversa — RebanhoSync

Atualizado em: 2026-08-07
Versão: 1.3.0

Use para retomar o RebanhoSync a partir do estado ativo do repositório. Por padrão, esta execução termina em diagnóstico e decisão; não autoriza patch apenas porque existe um plano ativo.

## Modo

`SOMENTE_LEITURA` por padrão.

Implementação só é permitida quando a tarefa atual contém objetivo, escopo e autorização explícitos. Nesse caso, após entregar o diagnóstico, aplicar o prompt operacional adequado em uma fase separada.

## Entradas obrigatórias

### Objetivo da tarefa atual

```txt
[OBJETIVO_ATUAL_OU_DIAGNOSTICO_DE_CONTINUIDADE]
```

### Contexto não documentado da conversa anterior

```txt
[COLAR_APENAS_O_QUE_AINDA_NAO_ESTA_DOCUMENTADO]
```

## Dependências autoritativas

1. Ler `AGENTS.md` e aplicar `.agents/rules/CORE_RULES.md`.
2. Usar `.agents/rules/CONTEXT_LOADING.md` para contexto, skill e progressão.
3. Aplicar `.agents/rules/no-broad-context.md`.
4. Ler `docs/review/CURRENT_PHASE_HANDOFF.md` e `docs/review/ACTIVE_PHASE_PLAN.md`.
5. Se o plano ativo apontar para plano específico, lê-lo.
6. Carregar `LAST_PHASE_RESULT.md`, `OPEN_REVIEW_ITEMS.md`, `PROJECT_STATUS.md` ou `ROADMAP.md` somente para dúvida concreta.
7. Seguir `.agents/rules/rtk.md` se houver comandos somente leitura.

O contexto colado é complementar. Em conflito, aplicar as precedências de `CORE_RULES.md`. Se o repositório não estiver acessível, declarar o que não pôde ser verificado.

## Escopo proibido

- Não implementar, editar, commitar ou iniciar a próxima fase apenas com base no handoff ou plano ativo.
- Não reabrir fase fechada sem evidência.
- Não marcar etapa em andamento como concluída.
- Não transformar roadmap em pendência técnica.
- Não executar hardening genérico.
- Não alterar Supabase, migrations, RLS, RPC, schema ou edge functions sem tarefa atual explícita e prompt operacional apropriado.
- Não atualizar baseline automaticamente com alterações funcionais pendentes.

## Diagnóstico obrigatório

Confirmar:

1. fase/subfase ou contexto atual;
2. estado: concluído, em andamento ou não confirmável;
3. baseline documentado e `HEAD`, quando confirmáveis;
4. worktree completo, inclusive staged e untracked;
5. fontes ativas efetivamente lidas;
6. pendências abertas relevantes;
7. decisões consolidadas;
8. próximo passo mínimo;
9. skill indicada para a próxima fase, sem carregá-la antecipadamente;
10. validação proporcional necessária.

## Condições de parada

Se fase, baseline, escopo atual ou autorização não puderem ser confirmados, parar no diagnóstico. Não inferir permissão de implementação.

## Saída obrigatória

1. **Diagnóstico**;
2. **Fatos confirmados**;
3. **Inferências/limitações**;
4. **Riscos**;
5. **Decisão:** `CONTINUAR_DIAGNOSTICO`, `PRONTO_PARA_NOVA_TAREFA` ou `BLOQUEADO_POR_CONTEXTO`;
6. **Próximo passo mínimo**;
7. **Validação necessária**;
8. **Critério de aceite da próxima fase**.
