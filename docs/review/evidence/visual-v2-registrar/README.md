# Visual V2 — Registrar: evidências

Atualizado em: 2026-10-20
**Baseline Commit:** `19bdaeb2b0fde90635f67acff0cec7606a53f0c0`

## Escopo e diagnóstico

Branch: `codex/visual-v2-registrar`, criada de `origin/main` após fetch. PRs #225 e #229 confirmados como MERGED. O checkout original e suas alterações foram preservados em outra worktree.

Prioridades verificadas:

- Botões com textos longos sem quebra e etapas truncadas no celular.
- Orientação para Financeiro onde a ação disponível é Negócios Patrimoniais.
- Campo de peso estreito em 320 px e controles encobertos pela barra sticky durante navegação por Tab no desktop.
- Fundo sobrescrito dos botões sanitários selecionados prejudicava contraste no tema escuro.

O patch altera o shell e componentes locais de apresentação. Preserva seleção/validação operacional, handlers, builders, guards, payloads, persistência e sync. Pesagem recebe somente ajuste responsivo; Sanitário recebe somente correção de classes e estado acessível dos botões. As diferenças adicionais de formatação nesses arquivos são mecânicas do Prettier.

## Método e resultados observados

Chromium via Playwright, tela Registrar real, React, Tailwind e fonte Inter do projeto. Fixture isolada em origem localhost, usuário/fazenda fictícios, Dexie real e refresh remoto desativado. Sem conexão a dados reais. O chrome global do aplicativo e autenticação real não fazem parte dessa fixture.

- 320, 390 e 1280 px, temas claro e escuro: contexto, operações, formulário sanitário extenso, erro de pesagem e revisão; 30 verificações de largura sem overflow horizontal.
- Seleção manual de lote e 12 animais; troca Sanitário → Pesagem; peso zero bloqueia revisão; preenchimento dos 12 pesos; revisão individual e retorno preservando valores.
- Em cada uma das seis combinações, confirmação offline com duplo clique pelo handler real: 12 eventos, 12 detalhes de pesagem, 1 gesto e 24 operações na fila local. Feedback contém sincronização pendente; navegação posterior observada. Contagens em [results.json](results.json).
- Entrada contextual de pesagem em 320, 390 e 1280 px: formulário preenchível, nenhum evento automático; Tab, digitação, Enter e revisão sem salvar. Novo percurso de Tab pelo formulário extenso não deixou controles focados sob a barra de ações.
- Revisão visual das capturas selecionadas abaixo. A barra continua no fluxo em mobile e sticky no desktop; margens de rolagem preservam controles focados visíveis.

## Validações locais

- `pnpm test -- src/pages/Registrar --maxWorkers=2`: 54 arquivos / 273 testes aprovados. Após os últimos ajustes, revalidados os testes da página, seleção e sanitário (27 aprovados, incluindo um novo caso loading/vazio) e pesagem (7 aprovados).
- `pnpm run lint`: aprovado.
- Prettier nos arquivos TS/TSX alterados: aprovado.
- `git diff --check`: aprovado.
- `pnpm exec fallow audit --gate new-only`: aprovado, sem achados novos. Achados herdados permanecem fora do escopo. O Fallow emite aviso de node_modules durante a análise do snapshot base, apesar da instalação local concluída.
- `pnpm run build`: aprovado. Avisos de Browserslist desatualizado, chunks grandes e importação estática/dinâmica de Dexie.

A primeira execução de Vitest nesta worktree falhou por variáveis Vite ausentes e expectativas dos rótulos anteriores sem acentos. A execução aprovada usou os valores fictícios documentados no workflow de CI; os testes de texto foram atualizados para os rótulos corrigidos.

## Capturas

| Largura / tema | Estado |
| --- | --- |
| 320 / claro | [Erro de pesagem](320-light-erro.png) |
| 320 / escuro | [Contexto inicial](320-dark-contexto.png) |
| 390 / claro | [Escolha de operação](390-light-operacoes.png) |
| 390 / escuro | [Revisão dos 12 animais](390-dark-revisao.png) |
| 1280 / claro | [Revisão no desktop](1280-light-revisao.png) |
| 1280 / escuro | [Formulário sanitário extenso](1280-dark-formulario-extenso.png) |

## Limitações

- Sem validação de autenticação real, confirmação remota, RLS ou dispositivo Android/iOS físico. Nenhum desses contratos foi alterado.
- O salvamento offline completo foi exercitado em pesagem. Demais domínios foram cobertos pelos testes de Registrar, sem alegar execução completa em navegador de cada operação.
- O resultado remoto de Required validation deve ser consultado no PR; este relatório registra evidência local.
