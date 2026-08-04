# Start Nova Conversa — RebanhoSync

Atualizado em: 2026-08-03  
Versão: 1.2.0

Use ao iniciar uma nova conversa para continuar o RebanhoSync a partir do estado ativo do repositório.

## Prompt

Você está retomando o desenvolvimento do RebanhoSync.

### Contexto adicional da conversa anterior

```txt
[COLAR_APENAS_O_QUE_AINDA_NAO_ESTA_DOCUMENTADO]
```

## Bootstrap mínimo

1. Leia `AGENTS.md`.
2. Aplique `.agents/rules/CORE_RULES.md`, `CONTEXT_LOADING.md` e `no-broad-context.md`.
3. Leia `docs/review/CURRENT_PHASE_HANDOFF.md` e `docs/review/ACTIVE_PHASE_PLAN.md`.
4. Se o plano ativo apontar para plano específico, leia-o.
5. Carregue `LAST_PHASE_RESULT.md`, `OPEN_REVIEW_ITEMS.md`, `PROJECT_STATUS.md` ou `ROADMAP.md` somente quando necessários para uma dúvida concreta.
6. Escolha no máximo uma skill principal para a tarefa atual.
7. Para comandos e validações, siga `.agents/rules/rtk.md`.

O contexto colado é complementar. Em conflito, siga a precedência das rules e confirme no repositório. Se o repositório não estiver acessível, declare o que não pôde ser verificado.

## Diagnóstico antes do patch

Entregue um diagnóstico curto contendo:

1. fase/subfase ou contexto atual;
2. estado: concluído, em andamento ou não confirmável;
3. baseline documentado e `HEAD` local, quando confirmáveis;
4. estado inicial do worktree, inclusive staged e untracked;
5. fontes ativas efetivamente lidas;
6. pendências abertas relevantes;
7. decisões já consolidadas;
8. próximo passo mínimo;
9. skill principal escolhida e motivo;
10. validação proporcional necessária.

## Regras

- Não implementar antes do diagnóstico.
- Não reabrir fase fechada sem evidência objetiva.
- Não marcar etapa em andamento como concluída.
- Não transformar roadmap em pendência técnica.
- Não executar hardening genérico.
- Não alterar Supabase, migrations, RLS, RPC, schema ou edge functions sem escopo e justificativa explícitos.
- Seguir o escopo permitido/proibido do plano ativo e do plano específico.
- Não repetir regras permanentes ou histórico já documentado.
- Não atualizar baseline automaticamente com worktree contendo alterações funcionais pendentes.

## Quando gerar prompt para agente

Produza prompt curto e referencial:

- aponte para os documentos normativos necessários;
- repita apenas objetivo, escopo e critérios de aceite específicos;
- exija diagnóstico antes do patch;
- exija validação proporcional via `.agents/rules/rtk.md`;
- não copie regras permanentes, plano completo ou histórico extenso.

## Formato da resposta

1. **Diagnóstico**
2. **Fatos confirmados**
3. **Inferências/limitações**
4. **Riscos**
5. **Plano mínimo**
6. **Validação obrigatória**
7. **Critério de aceite**
