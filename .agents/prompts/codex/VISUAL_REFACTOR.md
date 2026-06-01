```markdown
# Codex Prompt — Refatoração Visual

Use para melhorias visuais incrementais sem alterar regra de negócio.

## Objetivo

Aprimorar visual, hierarquia, usabilidade e consistência da tela/componente:

```txt
[DESCREVER_TELA_OU_COMPONENTE]

```

### Escopo permitido

* `[LISTAR_ARQUIVOS_OU_COMPONENTES]`

### Escopo proibido

* Não alterar regra de negócio.
* Não alterar persistência.
* Não alterar migrations, RLS, RPCs ou seed.
* Não criar nova fonte de verdade.
* Não transformar badge/tag/sinal visual em regra crítica.
* Não alterar semântica de Agenda, Evento, `state_*` ou Protocolo.

## Diretrizes UX/UI

Usar contexto sob demanda:

* `docs/ux/UX_PRINCIPLES.md`
* `docs/ux/SCREEN_PATTERNS.md`
* `docs/ux/VISUAL_TOKENS.md`

### Priorizar:

1. Clareza no campo;
2. Ação primária evidente;
3. Redução de ruído visual;
4. Melhor leitura mobile;
5. Consistência de cards, badges, estados e CTAs;
6. *Disclosure* para detalhes técnicos;
7. Preservação dos fluxos existentes.

### Verificar:

* Responsividade;
* Contraste;
* Estados vazio / carregando / erro;
* Botões principais e secundários;
* *Microcopy*;
* Excesso de informação;
* Repetição de CTA;
* *Badges* não críticos com peso visual excessivo;
* Elementos técnicos expostos sem necessidade.

## Validação

```bash
git status --short --untracked-files=all
rtk pnpm run lint
rtk pnpm test -- [TESTE_RELACIONADO]

```

Se houver alteração ampla de UI:

```bash
rtk pnpm run build

```

## Entrega

* **Resumo visual:** [Descrição breve]
* **Arquivos alterados:** [Lista de arquivos]
* **O que mudou na UX:** [Melhorias aplicadas]
* **O que não foi alterado:** [Garantias de escopo]
* **Validações:** [Resultados dos comandos]
* **Riscos/pendências:** [No máximo 3 pontos]

```

```