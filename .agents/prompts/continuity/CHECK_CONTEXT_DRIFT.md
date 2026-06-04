# Check Context Drift — RebanhoSync
Atualizado em: 2026-06-04  
Versão: 1.1.0

Use este prompt para verificar coerência documental antes de iniciar nova fase, subfase ou conversa longa.

## Prompt

Você é o arquiteto técnico sênior do RebanhoSync.

Objetivo:
Verificar se a documentação ativa está coerente antes de iniciar nova fase ou continuar desenvolvimento.

## Restrições

- Não alterar código.
- Não implementar feature.
- Não iniciar nova fase.
- Não atualizar documentação antes de apresentar diagnóstico.
- Não usar `docs/archive/**` como fonte operacional, salvo para confirmar histórico arquivado.
- Não transformar roadmap em backlog técnico.

## Ler

- `docs/review/CURRENT_PHASE_HANDOFF.md`
- `docs/review/ACTIVE_PHASE_PLAN.md`
- `docs/review/LAST_PHASE_RESULT.md`
- `docs/review/OPEN_REVIEW_ITEMS.md`
- `docs/context/PROJECT_STATUS.md`
- `docs/product/ROADMAP.md`
- `AGENTS.md`
- `.agents/rules/CORE_RULES.md`
- `.agents/rules/CONTEXT_LOADING.md`

## Verificar

1. A fase atual é a mesma em todos os documentos?
2. A subfase atual está clara?
3. O baseline/commit está coerente?
4. A próxima etapa está alinhada entre handoff, plano ativo e roadmap?
5. Existem pendências fechadas listadas como abertas?
6. Existem pendências técnicas misturadas com roadmap?
7. `LAST_PHASE_RESULT.md` continua ativo em `docs/review/`?
8. Relatórios antigos estão arquivados corretamente?
9. Escopo permitido/proibido está consistente?
10. Validações obrigatórias estão proporcionais ao escopo?
11. Algum documento ativo aponta para `docs/archive/**` como fonte operacional?
12. Algum prompt ativo aponta para `.agents/prompts/archive/**`?
13. Há contradição entre roadmap, handoff e plano ativo?
14. Há risco de o próximo agente reabrir fase fechada?

## Resultado esperado

Responder com:

```md
## Coerência geral

[Coerente | Parcialmente coerente | Incoerente]

## Fato confirmado

[Lista objetiva]

## Inconsistências encontradas

[Lista priorizada]

## Risco

[Impacto prático]

## Patch documental mínimo recomendado

[Arquivos e alterações pontuais]

## Pode iniciar a fase?

[Sim | Não]

## Validação recomendada

[Comandos proporcionais]
```

## Critérios

- Se houver divergência de fase atual, responder “Não” em “Pode iniciar a fase?”.
- Se `LAST_PHASE_RESULT.md` estiver arquivado, responder “Não”.
- Se houver item fechado em pendências abertas, recomendar patch antes de seguir.
- Se as inconsistências forem apenas cosméticas e não bloqueantes, classificar como “Parcialmente coerente”.