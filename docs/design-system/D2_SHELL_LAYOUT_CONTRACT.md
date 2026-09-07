# D2 — Shell, Layout & Navigation Contract

Atualizado em: 2026-09-07
Status: **Contrato estrutural implementado; D3 não iniciada**

## 1. Baseline

| Item | Valor |
|---|---|
| `main` inicial | `4f24ab5b6c67b172267dbe5f7c764444e7c66597` |
| `origin/main` inicial | `4f24ab5b6c67b172267dbe5f7c764444e7c66597` |
| Branch | `ux/d2-shell-layout` |
| Merge D1 | `4f24ab5b6c67b172267dbe5f7c764444e7c66597` |
| Head funcional D1 | `3c3dd4fe7ab99f637ebb7d03f76d3ff0f7744a4b` |
| Worktree | dedicada e limpa na abertura |

A D2 parte diretamente da `main` que contém a D1. Os commits `5a61aa7fa914e1153eac030b61b8461283212d79` e `3c3dd4fe7ab99f637ebb7d03f76d3ff0f7744a4b` foram confirmados como ancestrais de `origin/main` antes do patch.

## 2. Diagnóstico factual anterior

### 2.1 Shells

| Elemento | Implementação | Consumidores | Responsabilidade | Width/padding | Height/scroll | Navegação | Problema anterior |
|---|---|---|---|---|---|---|---|
| Shell autenticado | `src/components/layout/AppShell.tsx` | rotas protegidas por `RequireAuth` + `RequireFarm` | TopBar, SideNav, conteúdo, bottom nav e drawer mobile | conteúdo até 1440 px; gutters estavam no `main` | `min-h-svh`; body como scroll principal | desktop, mobile e menu completo | largura e gutters eram duas responsabilidades implícitas em elementos diferentes |
| Shell público de acesso | wrappers locais em Login e SignUp | `/login`, `/signup` | acesso centralizado em card | `p-4`, card `max-w-md` | `min-h-screen`; body | sem navegação global | duplicação local; não bloqueia o shell autenticado |
| Shell público de seleção | wrappers locais em SelectFazenda, CriarFazenda e AcceptInvite | seleção, criação e convite | fluxo pré-fazenda | `px-4`, `max-w-3xl/4xl/5xl` | `min-h-screen`; body | ações contextuais | medidas locais e múltiplos estados; migração exigiria escopo próprio |
| Shell especial admin | wrapper local em `pages/Admin` | `/admin` | backoffice superadmin | `container max-w-7xl` + gutters locais | body | retorno contextual | não usa AppShell e permanece isolado |

Não existe segundo `<main>` no shell autenticado. Dialogs e sheets são portais e não criam landmark principal concorrente.

### 2.2 Containers encontrados

| Padrão anterior | Consumidores confirmados | Leitura |
|---|---|---|
| `.app-content` + `max-w-[1440px]` | AppShell | limite global correto, sem gutter próprio |
| `mx-auto max-w-7xl` | Animais, Lotes, Pastos | páginas de lista em largura standard |
| `mx-auto max-w-5xl` | Registrar; SelectFazenda fora do AppShell | workflow narrow e shell público local |
| `mx-auto max-w-6xl` | importadores de Animais, Lotes e Pastos | largura intermediária legada; não migrada sem evidência visual específica |
| `container mx-auto` | superfícies sanitárias | padding adicional local; preservado para evitar colisão de domínio |
| sem wrapper local | Home, Dashboard e várias páginas densas | largura full herdada do shell |

### 2.3 Breakpoints e navegação anteriores

O projeto usa os breakpoints padrão do Tailwind: `sm=640`, `md=768`, `lg=1024`, `xl=1280` e `2xl=1536`. Não existe breakpoint visual customizado do shell. O hook móvel também troca em 768 px.

| Faixa | Comportamento confirmado |
|---|---|
| `<640` | gutter 16 px; TopBar compacto; bottom nav visível |
| `640–767` | gutter 24 px; grids locais podem abrir duas colunas; bottom nav visível |
| `768–1023` | SideNav de 272 px aparece; bottom nav desaparece; bottom padding volta ao fluxo normal |
| `>=1024` | gutter 32 px; main recebe 32 px vertical; TopBar mantém 56 px |
| `>=1280` | grids locais densos podem ganhar mais colunas; shell não muda |
| `>=1536` | conteúdo permanece limitado a 1440 px |

SideNav era sticky, iniciava abaixo do TopBar e mantinha scroll interno apenas para destinos. Mobile nav já tinha cinco itens, rótulos, alvos mínimos de 44 px e safe-area. TopBar já era sticky com 56 px.

### 2.4 Scroll ownership anterior

- `body`: único scroll vertical principal;
- `main`: cresce no fluxo e não define `overflow-y-auto`;
- SideNav: scroll interno justificado para uma lista de destinos maior que o viewport;
- drawer mobile: scroll interno justificado;
- dialogs, sheets e tabelas: scroll local conforme o primitive ou a necessidade da página;
- nenhum encadeamento global `body + main` foi encontrado.

## 3. Home × Dashboard

### 3.1 Matriz factual

| Item | Home | Dashboard |
|---|---|---|
| Rota | `/home` | `/dashboard` |
| Componente | `src/pages/Home.tsx` | `src/pages/Dashboard.tsx` |
| Entrypoint pós-login | sim; `/`, login, seleção de fazenda e fluxos de retorno convergem para `/home` | não |
| Função principal | central operacional diária | painel gerencial e saúde operacional |
| Métricas | agenda atrasada/hoje, rebanho, fila local, sanidade, estoque e sinais operacionais | backlog/rejeições, agenda, sanidade, gráficos, uso e telemetria do piloto |
| Ações | registrar execução, abrir agenda, rebanho e rotinas | investigar recortes, revisão, relatórios e saúde do sistema |
| Entrada pela navegação | item primário `Hoje` e marca do produto | filho de `Configurações`, apenas no modo completo |
| Saídas | rotas operacionais de registro e consulta | rotas gerenciais, de revisão e operacionais contextualizadas |
| Consumidores | todos os perfis com fazenda ativa | usuários do modo completo que alcançam Configurações |
| Dependências | Dexie/read models operacionais, agenda, sync e fontes de sinais | Dexie, rejeições, métricas de operação, gráficos e telemetria |

### 3.2 Fatos

- Home é o destino canônico de entrada e a prioridade da navegação diária.
- Dashboard não compete na navegação primária; está subordinado a Configurações no modo completo.
- As duas páginas consultam dados parcialmente sobrepostos, mas oferecem ações e níveis de análise diferentes.
- Nenhuma rota, widget, métrica ou link foi alterado na D2.

### 3.3 Inferências

- A sobreposição percebida na D0 decorre mais da ausência de um contrato de responsabilidade do que de duas entradas equivalentes.
- Renomear, fundir ou redirecionar exigiria pesquisa de compreensão e alteração funcional de D4.

### 3.4 Decisão

**KEEP_BOTH_WITH_DISTINCT_ROLES**

- Home permanece a central operacional e o entrypoint pós-login.
- Dashboard permanece uma superfície gerencial avançada, subordinada a Configurações e ao modo completo.
- D4 deve revisar nomenclatura e duplicação de widgets sem alterar fontes factuais ou transformar telemetria em verdade de domínio.

## 4. Contrato final D2

| Elemento | Contrato | Breakpoints | Consumidores |
|---|---|---|---|
| App shell | uma coluna estrutural com TopBar, região lateral/conteúdo e navegação mobile | todas as faixas | todas as rotas autenticadas com fazenda |
| Main | exatamente um `<main>`; cresce no fluxo; sem scroll vertical próprio | todas | Outlet autenticado |
| Limite global | `.app-content`: largura total máxima de 1440 px | limite efetivo em telas largas | TopBar e main |
| Gutters | 16 px base, 24 px em `sm`, 32 px em `lg` | 0/640/1024 | TopBar e main, centralizados em `.app-content` |
| `PageContainer full` | `max-w-none` dentro do shell | todas | Home e Dashboard; default para páginas densas |
| `PageContainer standard` | `max-w-7xl` (1280 px) | todas | Animais, Lotes e Pastos |
| `PageContainer narrow` | `max-w-5xl` (1024 px) | todas | Registrar |
| Ritmo vertical | topo 20 px base e 32 px em `lg`; seções principais preservam 20 px; rodapé 24–32 px no desktop | base/1024 | shell + páginas migradas |
| TopBar | 56 px, sticky, `z-40`, borda e `surface` D1, alinhado ao limite global | todas | shell autenticado |
| SideNav | 272 px, sticky abaixo do TopBar, scroll interno, borda e tokens sidebar | `md+` | navegação principal |
| Mobile nav | cinco destinos, 80 px de grade + safe-area, fixed, `z-40`, selected D1 e alvo >=44 px | `<md` | navegação prioritária |
| Drawer mobile | sheet à esquerda, até 22 rem/90 vw, scroll somente na lista | `<md`, sob demanda | destinos completos |
| Scroll principal | `body`; main nunca recebe `overflow-y-auto` | todas | aplicação |
| Viewport | shell usa `min-h-dvh`; sidebar desktop preserva altura sticky própria | todas | shell autenticado |
| Safe-area | bottom nav adiciona `env(safe-area-inset-bottom)` e main reserva 96 px + safe-area no mobile | `<md` | conteúdo e navegação mobile |

O gutter de 24 px começa em 640 px para manter compatibilidade com o contrato já documentado em `FOUNDATIONS.md` e com o breakpoint `sm` existente. Em 768 px, o resultado continua sendo 24 px conforme a matriz obrigatória.

## 5. Migration map

| Consumer | Antes | Depois | Status |
|---|---|---|---|
| AppShell/main | gutters locais no `main`; `min-h-svh`; fundo transparente | gutter em `.app-content`; `min-h-dvh`; surface/text D1; reserva de safe-area | MIGRATED |
| TopBar | gutter próprio, `card/foreground` e sombra RGBA literal | `.app-content`, `surface/content` D1 e borda como separação | MIGRATED |
| MobileBottomNav | aliases/opacidades locais para surface e selected | `surface`, `control-selected`, `primary-hover` e safe-area explícita | MIGRATED |
| Home | wrapper local sem nome | `PageContainer full`; conteúdo intacto | MIGRATED |
| Dashboard | wrapper local sem nome | `PageContainer full`; conteúdo intacto | MIGRATED |
| Animais | `mx-auto max-w-7xl` | preservado após a integração concorrente do F22A na mesma página | DEFER_D4 |
| Lotes | `mx-auto max-w-7xl` | `PageContainer standard` | MIGRATED |
| Pastos | `mx-auto max-w-7xl` | `PageContainer standard` | MIGRATED |
| Registrar | `mx-auto max-w-5xl` | `PageContainer narrow`; fluxo intacto | MIGRATED |
| Agenda, Financeiro e Relatórios | sem limite local | herdam full do shell | UNCHANGED |
| Importadores | `max-w-6xl` local | preservado até evidência específica | DEFER_D4 |
| Sanidade | `container` local com padding adicional | preservado por isolamento de domínio | DEFER_D4 |
| Login/SignUp e fluxos pré-fazenda | wrappers públicos locais | preservados | DEFER_D4 |
| Admin | shell especial local | preservado | DEFER_D4 |
| Cards, headers de seção e estados | variants locais | sem mudança | DEFER_D3 |

## 6. Classificação de achados

| Classe | Achado | Tratamento |
|---|---|---|
| D2_GLOBAL | gutters de TopBar/main não compartilhavam a mesma composição | resolvido por `.app-content` |
| D2_GLOBAL | reserva inferior mobile não somava a safe-area | resolvido no main |
| D2_GLOBAL | mobile selected e surfaces ainda usavam opacidades/aliases anteriores à D1 | resolvido com tokens canônicos |
| D3_COMPONENT | microtipografia de 11 px em BrandMark/SideNav | deferido; não é infraestrutura estrutural |
| D4_PAGE_LOCAL | wrappers `max-w-6xl` e containers sanitários locais | deferidos por exigirem validação por jornada |
| D5_A11Y | contraste mensurado, screen reader e reduced motion | deferidos para auditoria completa D5 |

## 7. Caveats

1. `PageContainer` centraliza apenas três larguras comprovadas; não absorve `max-w-6xl` sem decidir se importadores são standard ou narrow.
2. Shells públicos e Admin continuam com composição própria; unificá-los não é necessário para a previsibilidade do shell autenticado e pode tocar autenticação.
3. A D2 não altera a arquitetura de informação da navegação nem a quantidade de destinos da SideNav; apenas formaliza o papel atual de Home e Dashboard.
4. O smoke local em 390, 768, 1024 e 1440 px confirmou a tela pública de Login em dark mode sem overflow horizontal, sobreposição ou quebra de foco. A sessão isolada não possuía autenticação nem controle público de tema; portanto, o shell autenticado e light mode ainda exigem smoke no preview com sessão válida. Os testes estruturais cobrem landmarks, largura, navegação e reserva de safe-area, mas não substituem essa evidência visual.

## 8. Limites preservados

- nenhuma rota foi removida, redirecionada ou adicionada;
- nenhum conteúdo, grid interno, widget ou métrica de página foi reorganizado;
- D3, D4, D5 e D6 não foram iniciadas;
- F22, peso, GMD, ocupação e métricas econômicas não foram alterados;
- Agenda, Evento, `state_*`, protocolo, sinais e insights mantêm seus papéis;
- Dexie, sync, queue, writers, services, Supabase, RLS e migrations não foram tocados;
- a worktree C3 permaneceu isolada.
