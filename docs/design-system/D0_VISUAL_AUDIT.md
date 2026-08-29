# D0 — Auditoria Visual 360° do RebanhoSync

Atualizado em: 2026-08-29
Status: **D0 fechada; fundação objetiva para D1–D6**

## 1. Decisão e baseline

**Decisão: READY — D0 CLOSED / D1 READY.**

- branch: `ux/d0-visual-audit`;
- baseline Git: `main@b110f0a566d9aa99c83769032d6b7ffdc7956c01`, igual a `origin/main` na abertura;
- árvore inicial: limpa, sem tracked, staged ou untracked;
- escopo alterado: somente este diagnóstico;
- runtime, estilos, componentes, rotas, testes, banco, sync e contratos de domínio: não alterados;
- P0 visual aberto confirmado nesta auditoria: **0**.

Esta D0 audita o estado pós-Fases 19–20. A Fase 18 já havia criado um Design System documental, a F19 implementou foundations e shell, e a F20 migrou as cinco jornadas críticas. Portanto, o objetivo atual não é redesenhar nem repetir o retrato anterior: é medir a adoção real, localizar o drift remanescente e fixar o sistema-alvo para D1–D6.

## 2. Evidência e método

### 2.1 Evidência confirmada

- inspeção estrutural da configuração, CSS global, shell, 58 primitives/arquivos de UI e entrypoints prioritários;
- busca dirigida em código produtivo `src/**/*.{ts,tsx,css}`, excluindo testes, para cores literais, tokens semânticos, `hex`, `rgb()`, `hsl()`, `style={{}}`, dark variants e tamanhos arbitrários;
- inventário estrutural das 47 rotas registradas em `src/App.tsx`;
- evidência visual autenticada já registrada no fechamento da F20 para Home, Animais, AnimalDetalhe, Registrar e Agenda em 390×844, 768×1024, 1024×768 e 1440×900, light/dark, sem overflow estrutural;
- calibração visual pós-F20 já registrada para rotas P2/P3 representativas, incluindo Lotes, Financeiro e Relatórios, em mobile/desktop e light/dark.

### 2.2 Limitação da evidência

Não foi produzida nova captura autenticada nesta D0. Login, Dashboard, Sanidade, Financeiro e Relatórios receberam auditoria estrutural atual; sua evidência visual reaproveita a calibração registrada na F20 quando disponível. D5 deve executar a matriz visual atual completa e D6 deve torná-la regressão automatizada. Essa limitação não bloqueia D1 porque tokens, papéis, medidas e prioridades já estão definidos.

### 2.3 Classificação

- **Fato confirmado:** observado no código atual ou em evidência ativa de fechamento.
- **Inferência:** risco provável derivado da composição, sem alegação de falha visual reproduzida agora.
- **Proposta:** sistema-alvo para a fase indicada; não implementado nesta D0.

## 3. Diagnóstico global

O sistema não parte do zero. Inter variável, HSL light/dark, cores semânticas, shell responsivo, primitives Radix/shadcn e padrões de página já formam uma base coerente. A principal dívida não é ausência de design system, e sim coexistência entre três camadas:

1. foundation semântica atual, reutilizável e compatível com dark mode;
2. composições estruturais Tailwind válidas, porém muitas vezes locais;
3. cores literais, microtipografia e layouts arbitrários remanescentes em hotspots antigos ou extensos.

O efeito sistêmico é uma experiência estável nas jornadas migradas, mas com qualidade variável ao entrar em detalhe clínico, timeline, workflows longos e páginas de alta densidade.

### 3.1 Números do inventário

| Medida | Resultado atual | Leitura |
|---|---:|---|
| Variáveis CSS únicas | 86 | foundation ampla; inclui aliases de brand, neutral e semantic |
| Declarações CSS light/dark | 171 | cobertura quase simétrica, com aliases herdados |
| Papéis tipográficos Tailwind | 9 | `display`, `h1`, `h2`, `h3`, `body`, `body-sm`, `label`, `caption`, `kicker` |
| Sombras nomeadas | 2 | `soft` e `crisp` |
| Arquivos/primitives em `components/ui` | 58 | boa superfície compartilhada |
| Ocorrências de cor semântica | 2.926 | adoção relevante |
| Cores Tailwind literais candidatas | 563 | dívida de migração; não significa 563 defeitos |
| `dark:` explícitos | 159 | sinal de bypass parcial dos tokens |
| `style={{}}` | 5 | todos dinâmicos/estruturais na amostra |
| Tipografia arbitrária 8–11 px | 114 | risco de legibilidade: 6×8 px, 5×9 px, 65×10 px, 38×11 px |
| `overflow-x-auto/scroll/hidden` | 10 | revisar tabelas/tabs no mobile |
| `min-w-[…]` | 20 | revisar dependência de scroll e corte |

## 4. A — Inventário visual

### 4.1 Tokens atuais e sistema-alvo

| Token atual | Uso atual | Problema | Proposta para D1 |
|---|---|---|---|
| `background` / `foreground` | canvas e texto base | `foreground` acumula texto primário e secundário | preservar; criar `text-secondary` e manter `text-muted` explícitos |
| `card` / `card-foreground` | cards e conteúdo primário | sobreposição conceitual com `surface` | canonizar `surface = card`; manter alias de compatibilidade |
| `popover` / `popover-foreground` | menus, dialogs e superfícies elevadas | não há papel nomeado `surface-elevated` | criar alias `surface-elevated = popover` |
| `secondary` | fundo/ação secundária | nome mistura controle e superfície | restringir a controles; agrupamento usa `surface-muted` |
| `muted` / `muted-foreground` | agrupamento e texto auxiliar | um par atende dois papéis com contrastes diferentes | separar `surface-muted` de `text-muted` mantendo compatibilidade |
| `primary` | CTA principal, foco e links | hover/subtle são opacidades locais | criar `primary-hover` e `primary-subtle` |
| `accent` | ação operacional positiva e destaque | pode ser confundido com warning por ambos serem âmbar | `accent` fica branding/ação; warning usa somente família semântica |
| `destructive` | erro e ação destrutiva | convive com `semantic-error` | `danger` é papel canônico; `destructive` permanece alias de componente |
| `border` / `input` | separadores e campos | `input` funciona como borda forte implícita | nomear `border-strong` e mapear `input` para ele |
| `ring` | foco | consistente, mas precisa gate de contraste | preservar e testar em D5 |
| `overlay` | backdrop | adequado | preservar light/dark |
| `success`, `warning`, `info` | famílias semânticas básicas | aliases duplicados com `semantic-*` | expor uma API canônica; aliases antigos ficam temporários |
| `semantic-offline` | transporte sem rede | correto e específico | preservar; não reutilizar como warning genérico |
| `semantic-pending` | persistido local/aguardando | correto e específico | preservar; nunca aparentar `success` |
| `semantic-conflict` | conflito de versões | correto e específico | preservar |
| `semantic-unknown` | desconhecido/indeterminado | correto e específico | preservar |
| `semantic-not-permitted` | bloqueio de permissão/regra | correto e específico | preservar |
| `brand-*` | identidade do produto | aliasa `primary/accent`, mas a separação conceitual existe | preservar e proibir brand como estado operacional |
| `neutral-*` | aliases de base | amplia a API sem ganho claro para consumidor novo | manter compatibilidade; novos usos preferem papéis de superfície/texto |
| `surface` / `surface-muted` | cards e agrupamentos | falta `surface-elevated`; `surface` duplica `card` | completar a família e documentar precedência |
| `sidebar-*` | navegação desktop/mobile | coerente, isolada do conteúdo | preservar; validar active/hover/focus nos dois temas |
| `--radius` + `rounded-*` | controles, cards e overlays | orientação documental e primitive nem sempre coincidem | fixar escala canônica em D1 e aplicar só via D3/D4 |
| `shadow-soft` / `shadow-crisp` | CTA/elevated e overlays | ainda há sombras arbitrárias | manter duas elevações; remover literais incrementalmente |
| escala Tailwind de spacing | padding, gap, grid e shell | não há aliases estruturais para página/seção | definir composição canônica, sem criar token para cada distância |
| Inter + escala nomeada | títulos, corpo e labels | primitives/páginas ainda usam `text-lg`, `text-3xl` e 8–11 px | novos primitives consomem papéis tipográficos; proibir texto operacional <12 px |

### 4.2 Classificação de hardcodes

| Classe | Evidência | Decisão |
|---|---|---|
| Token semântico | 2.926 ocorrências estimadas de `bg/text/border/ring` semânticos | manter e consolidar aliases em D1 |
| Token estrutural | breakpoints Tailwind, escala de 4 px, `grid`, `gap`, gutters e limites de largura | válido quando expressa composição; extrair somente padrões repetidos |
| Hardcode justificável | cinco `style={{}}` para progresso, gráfico, avatar e largura calculada; cores HSL de chart apontam para CSS vars; CSS fixo da exportação impressa | manter, documentar quando dinâmico ou isolado do tema |
| Hardcode justificável condicionado | larguras Radix, `calc()`, safe-area, altura de dialog e min-width de tabela técnica | manter apenas com evidência responsiva e fallback acessível |
| Hardcode inconsistente | 563 utilitários de cor literal candidatos; `emerald/amber/sky/rose/slate` usados como estado; sombras RGBA locais; texto de 8–11 px | migrar por hotspot e significado, nunca por substituição global cega |
| Resíduo sem consumidor | `src/App.css` contém três hex do scaffold Vite e não é importado pelo runtime | remover em D1 apenas após confirmação final de ausência de consumidor |

Hotspots de cor literal confirmados no entrypoint ou componente: `AnimalDetalhe` 91, `TimelineFactual` 64, `animalVisualProfile` 38, `SanitaryPrecheckPanelV2` 33 e `Registrar/index` 30. Os números são candidatos de auditoria, não autorização para troca mecânica.

### 4.3 Componentes e padrões

| Área | Estado atual | Problema sistêmico | Direção |
|---|---|---|---|
| Cards | `Card`, `CardField`, `CardStatus`, `MetricCard` | variantes locais ainda duplicam borda/fundo e `CardTitle` usa escala própria | consolidar density e tone no primitive |
| Buttons | variantes default/accent/destructive/outline/secondary/ghost/link; 44–56 px | `accent` pode colidir com warning | separar ação/brand de estado |
| Inputs | 44 px, foco semântico, fundo `background` | dialogs antigos compõem grids rígidos | primitive permanece; layout vai para FormSection |
| Tables | primitive canônico disponível | tabelas técnicas ainda usam `min-w` alto e HTML local | responsive list ou scroll com rótulo/contexto preservado |
| Dialogs/drawers/sheets | Radix com focus trap e dimensões base | quatro dialogs em `AnimalDetalhe`, só um com `DialogDescription`; workflows longos podem exceder modal | descrição obrigatória; workflow longo vira página/sheet em D3/D4 |
| Navigation/header | TopBar + SideNav a partir de `md` + bottom nav mobile | dois conceitos de dashboard e muitos destinos competem | D2 fixa arquitetura de informação e prioridade, sem trocar rotas |
| Badges/alerts | `StatusBadge`, `StateBanner`, sync badges | literais locais ainda representam estado | consumir família semântica canônica |
| Empty/loading/error | primitives existem, uso parcial | algumas páginas usam EmptyState para loading ou texto local para erro | separar `Empty`, `Loading`, `Error`, `Partial`, `Blocked` |
| Dark mode | class strategy + 86 tokens | 159 variantes `dark:` locais contornam a semântica | novo código não cria par literal quando token resolve |

## 5. Problemas sistêmicos priorizados

| ID | Categoria | Pri. | Fato/inferência | Achado | Destino |
|---|---|---:|---|---|---|
| V-01 | GLOBAL_TOKEN | P1 | fato | 563 cores literais candidatas coexistem com a API semântica | D1 define mapa e D3/D4 migram por componente/tela |
| V-02 | GLOBAL_TOKEN | P1 | fato | `card/surface`, `popover/surface-elevated`, `input/border-strong`, `destructive/danger` não têm uma precedência única | D1 |
| V-03 | GLOBAL_LAYOUT | P1 | fato | `/home` e `/dashboard` oferecem dashboards concorrentes, com hierarquia e objetivos diferentes | D2 decide papel de cada rota; não remover rota em D0 |
| V-04 | COMPONENT | P1 | fato | estados semânticos ainda são montados com `amber/emerald/sky/rose` em hotspots | D3 |
| V-05 | PAGE_LOCAL | P1 | fato | `AnimalDetalhe` tem 4.027 linhas, 91 cores literais, cinco tabs e seis overlays/confirmations no entrypoint | D4 por fatias, preservando fluxo |
| V-06 | ACCESSIBILITY | P1 | fato | 114 ocorrências de texto arbitrário entre 8–11 px; três dialogs de `AnimalDetalhe` sem descrição no entrypoint | D3/D5 |
| V-07 | RESPONSIVE | P1 | inferência | formulário do dialog financeiro usa grids de duas/três colunas sem breakpoint em vários blocos | D4/D5 com reprodução em 390 px |
| V-08 | DARK_MODE | P2 | fato | 159 `dark:` explícitos indicam que vários consumidores não herdam tokens | D1 cria regra; D4 migra hotspots |
| V-09 | COMPONENT | P2 | fato | `CardTitle`, métricas e headings locais não consomem uniformemente a escala tipográfica nomeada | D3 |
| V-10 | RESPONSIVE | P2 | fato | 20 min-width arbitrários e 10 overflows horizontais exigem decisão por tabela/tabs | D4/D5 |
| V-11 | PAGE_LOCAL | P2 | fato | Sanidade divide configuração, catálogo e histórico em composições densas e locais | D4 após primitives de estado/filtro |
| V-12 | ACCESSIBILITY | P2 | inferência | uso de EmptyState como loading no catálogo sanitário reduz diferenciação semântica de estado | D3/D4 |
| V-13 | DARK_MODE | P2 | inferência | stroke hex `#059669` e superfícies literais podem não manter contraste em ambos os temas | D1/D5 |
| V-14 | GLOBAL_TOKEN | P2 | fato | documentos de Design System ainda exibem status “documental/não implementado” em partes já implementadas na F19/F20 | D1 reconcilia documentação e código |
| V-15 | PAGE_LOCAL | P3 | fato | `src/App.css` é resíduo visual não importado | D1 cleanup controlado |

Não foi confirmado problema P0 que impeça uso. Eventuais quebras visuais inferidas só podem subir a P0 após reprodução na matriz D5.

## 6. B — Matriz das páginas prioritárias

Escala: **A** = adequada; **P** = parcial; **D** = dívida relevante. “Dark” mede aderência ao tema, não contraste WCAG comprovado nesta D0.

| Página | Hierarquia | Layout | Paleta | Responsive | Dark | Prioridade |
|---|---|---|---|---|---|---:|
| Login | A — foco único no acesso | A — card simples | P — branding local, semantic base | A estrutural | P — herda tokens, sem evidência atual de contraste | P2 |
| Home + Dashboard | D — dois dashboards e muita competição | P — grids progressivos | A/P — semântica alta, charts específicos | A nas jornadas F20; Dashboard estrutural | A/P — charts exigem contraste dedicado | P1 |
| Animais | A — header, filtros, resultado | P — densidade de nove filtros | A — entrypoint sem cor literal | A validado F20 | A por tokens | P2 |
| AnimalDetalhe | D — identidade, métricas, cards e tabs competem | D — 4.027 linhas, cinco tabs, overlays | D — 91 cores literais | P — validado F20, mas tabs dependem de scroll | D — 22 overrides no entrypoint | P1 |
| Lotes | A — lista simples e CTA clara | A — cards adaptativos | A — 11 usos semânticos, zero literal no entrypoint | A estrutural/calibração F20 | A por tokens | P2 |
| Agenda | A — intenção, período, filtros e grupos | P — densidade de filtros/grupos | A no entrypoint; componentes têm microtipografia | A validado F20 | A por tokens | P2 |
| Registrar | A — contexto, progresso, detalhe, revisão | D — workflow extenso e sticky action bar | D — 30 literais no entrypoint | A no P0 resolvido; tabelas internas ainda densas | P — 17 overrides no entrypoint | P1 |
| Sanidade | P — configuração, execução/histórico e catálogo competem | D — tabs, filtros e painéis densos | P — entrypoints sem literais; filhos são hotspots | P — tabelas técnicas e filtros | P — dependência de filhos locais | P1 |
| Financeiro | P — muitos blocos antes do ledger | D — formulário modal longo | A — 88 usos semânticos, zero literal no entrypoint | D inferido em grids fixos do dialog | A por tokens | P1 |
| Relatórios | A — escopo, cobertura, métricas, visualização | P — página longa e grids específicos | A — 137 usos semânticos, zero literal | P — listas/grids precisam matriz atual | A; charts precisam gate | P2 |

### 6.1 Matriz de estados e CTAs

| Página | Legibilidade/densidade | Empty | Loading | Erro | CTA | Pendência objetiva |
|---|---|---|---|---|---|---|
| Login | boa | n/a | texto no botão | inline e por campo | Entrar | validar contraste, foco e autofill light/dark |
| Home + Dashboard | densa | mensagens locais por bloco | parcial por fonte | falha tende a ficar por bloco/console | Registrar/abrir rotina | decidir papel de `/dashboard` e limitar 3–5 métricas primárias |
| Animais | densa nos filtros | base vazia e filtro vazio distintos | preserva estrutura carregada | feedback local/toast | Novo animal | filtros avançados em painel mobile |
| AnimalDetalhe | muito densa | por seção/tab | parcial em painéis | mistura local/toast | Registrar manejo | fatiar hierarquia, descrever dialogs e remover microtexto crítico |
| Lotes | confortável | `EmptyState` com CTA | simples | toast/local | Novo lote | manter padrão e usar como referência de lista simples |
| Agenda | densa | estado dedicado | atualização explícita | `StateBanner` de erro | Registrar manejo | reduzir microtexto e filtros progressivos |
| Registrar | muito densa | alvo/contexto ausente | estado de finalização nos filhos | preservar entrada e mostrar resultado | Avançar/Registrar | migrar literais por significado; revisar tabelas internas |
| Sanidade | muito densa | vários estados locais | catálogo usa EmptyState como loading | cards/toasts | planejar/consultar conforme rota | separar configuração, evidência e ação; loading canônico |
| Financeiro | muito densa | ledger/operação vazia | pouco explícito no entrypoint | blocos inline nos dialogs | Novo lançamento | formulário responsivo e hierarquia caixa/competência/previsão |
| Relatórios | densa e longa | por bloco/período | card textual | indisponibilidade por bloco | Exportar, secundária | manter cobertura antes de gráfico e validar tabelas mobile |

## 7. C — Design direction

### 7.1 Princípios

1. Aparência operacional, calma e legível; não decorativa.
2. Cor comunica papel, nunca autorização implícita.
3. Borda separa superfícies; sombra indica elevação real.
4. Um CTA primário por contexto; ações factuais usam verbo explícito.
5. Mobile preserva risco, fonte, limitação e ação crítica.
6. Agenda, Evento, `state_*`, protocolo e recomendação permanecem visualmente distinguíveis.

### 7.2 Paleta semântica alvo

Os valores preservam a direção petróleo + neutro quente já validada, mas completam os papéis faltantes. D1 pode ajustar contraste em até ±4 pontos de lightness sem rediscutir o significado.

| Papel | Light HSL | Dark HSL | Uso |
|---|---|---|---|
| `background` | `45 14% 93%` | `200 28% 12%` | canvas/shell |
| `surface` | `45 12% 96%` | `200 24% 16%` | card/conteúdo |
| `surface-muted` | `45 10% 87%` | `200 18% 21%` | agrupamento/filtro |
| `surface-elevated` | `45 12% 97%` | `200 24% 18%` | popover/dialog |
| `border` | `45 10% 75%` | `200 16% 29%` | separação normal |
| `border-strong` | `45 10% 62%` | `200 16% 38%` | campo, divisão importante |
| `text-primary` | `200 34% 14%` | `45 12% 90%` | conteúdo principal |
| `text-secondary` | `200 22% 27%` | `45 9% 76%` | apoio próximo |
| `text-muted` | `200 16% 36%` | `45 8% 66%` | metadado/legenda |
| `primary` | `200 76% 20%` | `198 72% 42%` | CTA/link/foco |
| `primary-hover` | `200 76% 16%` | `198 72% 48%` | interação |
| `primary-subtle` | `200 42% 88%` | `200 30% 22%` | seleção/destaque leve |
| `success` | `142 76% 25%` | `142 52% 40%` | confirmado/aplicado |
| `warning` | `35 92% 30%` | `35 72% 50%` | atenção/partial/ajuste |
| `danger` | `0 84% 40%` | `0 68% 48%` | erro/rejeição/destrutivo |
| `info` | `200 100% 25%` | `200 68% 44%` | informação/syncing |

Cada estado usa `base`, `foreground`, `subtle/muted` e `border`. `offline`, `pending`, `conflict`, `unknown` e `not-permitted` continuam famílias operacionais próprias. Não criar cores para “animal”, “lote”, “sanidade” ou “financeiro” sem significado transversal comprovado.

### 7.3 Tipografia alvo

| Papel | Tamanho / linha | Peso | Regra |
|---|---|---:|---|
| Page title | 32/40 px; 28/36 px mobile quando necessário | 600 | um `h1` por tela |
| Section title | 24/32 px | 600 | `h2` de bloco principal |
| Card/subsection title | 20/28 px | 600 | `h3`, sem uppercase integral |
| Body | 16/24 px | 400 | leitura padrão, máximo 75 caracteres |
| Body compact | 14/20 px | 400–500 | listas e metadados densos |
| Caption | 12/16 px | 500 | apenas apoio; nunca decisão crítica |
| Label | 14/20 px | 600 | campo/controle |
| Metric value | 32/40 px | 600–700 | `tabular-nums`, unidade separada |
| Button | 14/20 px; 16/24 px em `lg` | 600 | verbo explícito |

Texto operacional abaixo de 12 px é proibido. Texto crítico, ação, estado, fonte e limitação não ficam abaixo de 14 px.

### 7.4 Spacing, grid e layout alvo

| Papel | Alvo |
|---|---|
| Max-width do shell | 1440 px |
| Form/workflow | 1024 px, salvo comparação que exija mais |
| Page padding | 16 px mobile; 24 px `sm/md`; 32 px `lg+` |
| Page section gap | 24 px mobile; 32 px desktop |
| Card gap | 12–16 px |
| Card padding comfortable | 20 px mobile; 24 px desktop |
| Card padding compact | 16 px |
| Grid mobile | 1 coluna; métricas 2 apenas quando legíveis |
| Grid tablet | 1–2 colunas |
| Grid desktop | 2–4 colunas; não esticar além da leitura útil |
| Header | TopBar 56 px; PageHeader separado do shell |
| Sidebar | 272 px em `md+`, sticky; conteúdo `min-w-0` |
| Mobile nav | até cinco destinos, 80 px + safe-area; rótulos visíveis |
| Touch target | mínimo 44×44 px; CTA padrão 48 px |

Ordem de tela: `PageHeader → estado prioritário → ação/controles → conteúdo primário → evidência/limitações`. Dashboard usa no máximo 3–5 métricas primárias. Tabelas viram responsive list quando esconder coluna mudaria decisão.

### 7.5 Forma, borda e elevação

| Papel | Radius | Borda | Sombra |
|---|---:|---|---|
| Input/button | 12 px | `border`/`border-strong` | nenhuma; CTA pode `soft` |
| Card | 16 px | `border` 1 px | nenhuma por padrão |
| Badge/pill | full | borda semântica | nenhuma |
| Popover/menu | 16 px | `border` | `crisp` |
| Dialog/sheet | 20–24 px | `border-strong` | `crisp` + overlay |
| Superfície semântica | 16 px | borda da família | nenhuma |

Não empilhar cards apenas para criar profundidade. `surface-elevated` é reservado a conteúdo que flutua; `surface-muted` agrupa, não indica disabled.

## 8. D — Plano D1–D6

| Fase | Escopo | Entrega | Gate de saída |
|---|---|---|---|
| D1 — tokens/paleta | completar papéis, aliases, contraste, docs e lint | CSS vars + Tailwind + mapa de compatibilidade; remover `App.css` se confirmado morto | light/dark AA nos papéis; zero novo hardcode; sem troca ampla de classes |
| D2 — shell/layout | decidir Home × Dashboard, container, gutters, header/sidebar/mobile nav | contrato único de shell e navegação; sem mudar domínio | 390/768/1024/1440 sem overlap, CTA crítica a ≤1 toque |
| D3 — primitives | tipografia, Card density, PageHeader, FormSection, Dialog, Empty/Loading/Error/Partial | primitives canônicos e codemods apenas localizados | testes focados; descrição/foco/touch targets; API de estados única |
| D4 — páginas | migrar por fatia: AnimalDetalhe → Registrar/Sanidade/Financeiro → Home/Dashboard → Animais/Agenda/Lotes/Relatórios | uma jornada por patch, sem writer/regra de domínio | evidência visual + regressão funcional focada por tela |
| D5 — responsividade/a11y | matriz completa, teclado, screen reader, contraste, reduced motion | relatório por viewport/tema/estado | zero P0; P1 reproduzidos resolvidos ou formalmente bloqueados |
| D6 — visual regression | snapshots determinísticos de shell, primitives e páginas/estados | baseline automatizada light/dark/mobile/desktop | CI detecta drift e diferencia mudança intencional |

### 8.1 Ordem objetiva para D4

1. **P1:** AnimalDetalhe — maior concentração de cor literal, densidade, tabs e dialogs.
2. **P1:** Financeiro — dialog longo e risco responsivo/destrutivo.
3. **P1:** Sanidade — estados críticos, tabelas e densidade transversal.
4. **P1:** Registrar — migrar cores/microtipografia sem alterar o workflow já validado.
5. **P1:** Home × Dashboard — resolver arquitetura de informação antes de polish.
6. **P2:** Agenda e Animais — preservar migração F20; tratar filtros/microtipografia.
7. **P2:** Relatórios — cobertura, charts e responsive lists.
8. **P2:** Lotes — usar como referência estável, apenas ajustes residuais.
9. **P2:** Login — contraste, autofill, foco e branding; baixo custo, sem bloquear o núcleo.

Home, Animais, Agenda e Registrar não devem receber redesign em massa. Mesmo em D4, a migração é incremental e condicionada a evidência funcional.

## 9. Critério de aceite D0

- problemas globais estão separados dos locais: **atendido**;
- paleta tem função semântica e valores light/dark: **atendido**;
- layout, tipografia, spacing, radius, shadow e surfaces alvo estão definidos: **atendido**;
- dez superfícies prioritárias possuem diagnóstico e prioridade: **atendido**;
- não houve redesign amplo nem mudança runtime: **atendido**;
- D1 pode iniciar por mapa de aliases, contraste e governança de hardcodes: **atendido**.

## 10. Riscos remanescentes

1. A matriz visual atual completa ainda precisa de execução autenticada em D5; a evidência reutilizada é da F20.
2. Contagens por regex classificam candidatos: cada cor literal deve ser interpretada pelo significado antes de migrar.
3. Alterações visuais em AnimalDetalhe, Registrar, Sanidade e Financeiro podem tocar fluxos operacionais; D4 deve manter patches pequenos e testes focados.

**READY — D0 CLOSED / D1 READY**
