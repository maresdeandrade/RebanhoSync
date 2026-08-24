# Migration Plan — RebanhoSync

Atualizado em: 2026-08-24
Status: **Matriz P0–P3 da Fase 18 — cinco jornadas P1 migradas na Fase 20**

## Decisão da auditoria

**READY.** O inventário de código, rotas, componentes e tokens foi concluído. A inspeção autenticada real cobriu Home, Animais, AnimalDetalhe, Registrar e Agenda em 1440 × 900 e 390 × 844, nos temas claro e escuro. O Registrar também foi verificado em 768 × 1024 e 1024 × 768 para delimitar a quebra responsiva.

**P0 aberto: 0.** O P0 responsivo do Registrar permanece resolvido. Na Fase 20, Home, Animais, AnimalDetalhe, Registrar e Agenda foram marcadas **MIGRATED** após inspeção autenticada em 390×844, 768×1024, 1024×768 e 1440×900, nos temas claro e escuro. A validação confirmou ausência de overlap, clipping e overflow estrutural, preservação de ações e separação semântica entre Evento, Agenda, `state_*` e Recommendation. Dívidas P2/P3 não bloqueantes permanecem destinadas às fases indicadas na matriz.

## Resultado da Fase 20

| Jornada | Estado | Evidência | Dívida remanescente |
|---|---|---|---|
| Home | **MIGRATED** | hierarquia de métricas/atalhos, 4 viewports, light/dark | detalhamento de inteligência permanece F21 |
| Animais | **MIGRATED** | FilterBar, busca/filtros, lista responsiva, 4 viewports, light/dark | polimento de filtros avançados é P2 |
| AnimalDetalhe | **MIGRATED** | tabs adaptativas, semântica localizada, 4 viewports, light/dark | decomposição interna do arquivo monolítico é dívida técnica separada |
| Registrar | **MIGRATED** | progresso, erro e action bar; P0 revalidado, 4 viewports, light/dark | nenhum P0/P1 operacional aberto |
| Agenda | **MIGRATED** | intenção futura explícita, estados e filtros, 4 viewports, light/dark | amostra visual permaneceu no estado vazio factual |


## Critério

- **P0:** risco operacional ou acessibilidade grave confirmado.
- **P1:** tela crítica, frequente e fortemente inconsistente.
- **P2:** dívida relevante sem risco imediato confirmado.
- **P3:** polimento, baixa frequência, alias ou consistência menor.

Frequência/densidade: `A/M/B` = alta/média/baixa. Responsividade: `adaptativa` quando há composição mobile explícita, `parcial` quando depende de grids/overflow ou precisa inspeção.

## Inventário completo de rotas ativas

| Route | Screen/component | Domínio / tipo | Freq./dens. | Ações críticas | Desktop/mobile | Padrões compartilhados | Dívida visual / responsiva / a11y | Pri. |
|---|---|---|---|---|---|---|---|---|
| `/` | Index | navegação / redirect | A/B | redirecionar | n/a | Navigate | nenhuma relevante | P3 |
| `/login` | Login | acesso / formulário | M/B | autenticar | adaptativa | Card, Input, Button | branding local; validar contraste/copy | P3 |
| `/signup` | SignUp | acesso / formulário | B/M | criar conta | adaptativa | Card, Input, Button | cores literais e formulário longo | P3 |
| `/invites/:token` | AcceptInvite | acesso / workflow | B/M | aceitar convite | parcial | PageIntro, Card, Button | estados de token precisam padronização | P2 |
| `/select-fazenda` | FarmSelection | contexto / listagem | M/M | selecionar fazenda | adaptativa | Card, Button | validar empty/loading/foco | P2 |
| `/criar-fazenda` | CreateFarm | contexto / formulário | B/M | criar fazenda | adaptativa | Form, Card | validação e ações mobile | P2 |
| `/home` | Home | operação / dashboard | A/A | registrar, abrir agenda/alertas | parcial | PageIntro, Card, StatusBadge, DecisionPanel | sete métricas, alta competição visual | P1 |
| `/onboarding-inicial` | OnboardingInicial | operação / workflow | B/A | configurar baseline | parcial | Card, Form, Progress | fluxo longo e hierarquia própria | P2 |
| `/animais` | Animais | rebanho / listagem | A/A | buscar, filtrar, abrir/criar animal | parcial | PageIntro, FilterChips, Card, StatusBadge | filtros densos; lista mobile a validar | P1 |
| `/animais/transicoes` | AnimaisTransicoes | rebanho / workflow | M/A | revisar/aplicar transição | parcial | Card, Table local, Badge | muitas células/cores literais | P2 |
| `/animais/importar` | AnimaisImportar | rebanho / workflow | B/M | importar/confirmar | parcial | PageIntro, Card, Progress | cores literais, erros por linha | P2 |
| `/animais/novo` | AnimalNovo | cadastro / formulário | M/A | cadastrar animal | parcial | PageIntro, Tabs, FormSection | formulário longo, scanner/ícones | P2 |
| `/animais/:id/editar` | AnimalEditar | cadastro / formulário | M/A | alterar cadastro-base | parcial | PageIntro, Tabs, FormSection | densidade e tabs | P2 |
| `/animais/:id/reproducao` | AnimalReproducao | reprodução / workflow | M/M | registrar contexto reprodutivo | parcial | Form, Card | hierarquia local | P2 |
| `/animais/:id/pos-parto` | AnimalPosParto | reprodução / workflow | M/M | registrar pós-parto | parcial | Form, Progress | cor/progresso local | P2 |
| `/animais/:id/cria-inicial` | AnimalCriaInicial | reprodução / workflow | B/A | cadastrar cria/vínculo | parcial | Form, Card | muitas cores literais; fluxo longo | P2 |
| `/animais/:id` | AnimalDetalhe | rebanho / detalhe | A/A | registrar manejo, mover, venda, óbito | parcial | Card, Tabs, Dialog, StatusBadge | 4k linhas, 5 tabs, dialogs sem descrição | P1 |
| `/lotes` | Lotes | estrutura / listagem | A/M | abrir/criar lote | adaptativa | Cards, EmptyState | padronizar header/lista | P2 |
| `/lotes/importar` | LotesImportar | estrutura / workflow | B/M | importar/confirmar | parcial | Card, Progress | cores literais, erros por linha | P2 |
| `/lotes/novo` | LoteNovo | estrutura / formulário | M/M | criar lote | adaptativa | Form, Card | adotar PageHeader | P2 |
| `/lotes/:id/editar` | LoteEditar | estrutura / formulário | M/M | editar lote | adaptativa | PageIntro, Form | validar hierarquia | P2 |
| `/lotes/:id` | LoteDetalhe | estrutura / detalhe | A/A | movimentar/gerir lote | parcial | PageIntro, Card | 93 cores literais, alta densidade | P2 |
| `/pastos` | Pastos | estrutura / listagem | M/M | abrir/criar pasto | adaptativa | Cards, EmptyState | header/lista divergentes | P2 |
| `/pastos/importar` | PastosImportar | estrutura / workflow | B/M | importar/confirmar | parcial | Card, Progress | cores literais, erros por linha | P2 |
| `/pastos/novo` | PastoNovo | estrutura / formulário | M/A | criar pasto | parcial | Form, Card | formulário extenso | P2 |
| `/pastos/:id/editar` | PastoEditar | estrutura / formulário | M/A | editar pasto | parcial | PageIntro, Form | densidade | P2 |
| `/pastos/:id` | PastoDetalhe | estrutura / detalhe | M/A | ocupação/movimentação | parcial | PageIntro, Card, timeline | 80 cores literais, grids locais | P2 |
| `/agenda` | Agenda | agenda / agenda | A/A | filtrar, abrir tarefa, registrar execução | parcial | PageIntro wrapper, metrics, FilterToolbar | filtros/grupos densos; banners locais | P1 |
| `/registrar` | Registrar | operação / workflow | A/A | selecionar alvo, revisar, registrar fato | parcial | PageIntro, StepIndicator, FormSections | P0 responsivo RESOLVED em 390/768/1024 light/dark; workflow/sticky permanecem dívida ampla | P1 |
| `/eventos` | Eventos | histórico / listagem | M/A | consultar fato | parcial | Cards/listas | densidade e padrões locais | P2 |
| `/financeiro` | Financeiro | financeiro / dashboard-lista | M/A | registrar/reverter transação | parcial | Card, Dialog | 36 cores literais; destrutivo | P2 |
| `/insumos` | Insumos | estoque / listagem-workflow | M/A | movimentar/ajustar estoque | parcial | Tabs, Dialogs, Cards | tela muito extensa; ações por ícone | P2 |
| `/relatorios` | Relatorios | inteligência / relatório | M/A | filtrar/exportar | parcial | PageIntro, Cards, charts | cobertura/partial e 15 cores literais | P2 |
| `/contrapartes` | Contrapartes | comercial / listagem-config. | B/M | criar/editar contraparte | parcial | Card, Dialog | dialog e responsive list | P2 |
| `/dashboard` | Dashboard | inteligência / dashboard | M/A | consultar KPIs | parcial | Metric cards/charts | concorrência com Home; origem/coverage | P2 |
| `/configuracoes` | Configuracoes | sistema / configuração | M/M | alterar preferências | adaptativa | PageIntro, sections | agrupar escopo e impacto | P2 |
| `/perfil` | Perfil | conta / configuração | B/A | editar perfil | parcial | Tabs, Form | 6 imports de Tabs; mobile | P3 |
| `/membros` | Membros | acesso / configuração | B/M | convidar/alterar papel | parcial | Card, member dialogs | dialogs sem descrição observada | P2 |
| `/reconciliacao` | Reconciliacao | sync / workflow | M/A | retry/reconciliar | parcial | Card, Dialog, StatusBadge | estado crítico, três dialogs, alta densidade | P2 |
| `/admin/membros` | AdminMembros | acesso / redirect | B/B | redirecionar | n/a | Navigate | alias legado | P3 |
| `/editar-fazenda` | EditarFazenda | contexto / formulário | B/A | editar fazenda | parcial | Form, Card | formulário longo | P2 |
| `/categorias` | Categorias | sistema / redirect | B/B | redirecionar | n/a | Navigate | alias legado | P3 |
| `/categorias/novo` | CategoriaNova | sistema / redirect | B/B | redirecionar | n/a | Navigate | alias legado | P3 |
| `/protocolos-sanitarios` | ProtocolosSanitarios | sanitário / configuração | M/A | configurar protocolo | parcial | Tabs, Card | 12 tabs/imports; alta densidade | P2 |
| `/protocolos-sanitarios/catalogo-v2` | SanitarioCatalogoV2 | sanitário / listagem-config. | M/A | consultar/adotar catálogo | parcial | Card, filters | densidade e estados regulatórios | P2 |
| `/reproducao` | ReproductionDashboard | reprodução / dashboard | M/A | consultar/abrir manejo | parcial | Cards, metrics | padronizar métricas/coverage | P2 |
| `*` | NotFound | sistema / erro | B/B | voltar | adaptativa | Button | texto/cores locais e copy em inglês | P3 |

## Análise das cinco jornadas críticas

### Home — P1

- tarefas: priorizar atrasos/hoje, verificar sync/compliance e iniciar registro;
- hierarquia atual: PageIntro, sete métricas, cinco atalhos e múltiplos painéis; a competição reduz o foco;
- primária: `Registrar execução`; secundárias: Agenda e Rebanho;
- estados/filtros: pending, atraso, sanitário, regulatório, estoque e recomendações; sem filtros globais;
- mobile: sete métricas e muitos blocos exigem ordenação por urgência;
- reutilização: PageIntro, MetricCard, StatusBadge, DecisionRecommendationsPanel;
- risco/padrão alvo: não esconder atraso, rejeição ou limitação; Dashboard com 3–5 métricas e fila de ação antes de leitura auxiliar.

### Animais — P1

- tarefas: localizar animal, entender estado/proxima agenda, abrir detalhe e cadastrar/importar;
- hierarquia atual: PageIntro, busca, painel de filtros extenso, demografia, aviso de transição e cards paginados;
- primária: `Novo animal`; secundária: importar;
- estados/filtros: nove dimensões de filtro, badges ativos, vazio base/filtrado;
- mobile: filtro precisa Sheet/painel progressivo; card deve preservar identificação, risco e próxima ação;
- reutilização: PageIntro, FilterChips/Toolbar, responsive list, EmptyState;
- risco/padrão alvo: status não pode sugerir saúde/autorização; List com filtros essenciais e detalhe progressivo.

### AnimalDetalhe — P1

- tarefas: confirmar identidade/estado, registrar manejo, consultar histórico e executar ações sensíveis;
- hierarquia atual: cabeçalho local, três métricas, muitos cards, cinco tabs e seis dialogs;
- primária: `Registrar manejo`; secundárias: mover, editar, histórico; venda/óbito exigem clareza;
- estados/filtros: bloqueio sanitário, peso, estágio, reprodução, sociedade, agenda e comercial;
- mobile: cabeçalho comprime imagem, identificação, badges, alerta e ações em duas colunas estreitas; cinco tabs fixas, cards densos e dialogs grandes continuam dívida prioritária;
- inconsistências: 126 cores literais; pelo menos três dialogs sem `DialogDescription`; possível duplicação de hierarquia;
- reutilização: PageHeader, MetricCard, StateBanner, Tabs responsivas, AlertDialog;
- risco/padrão alvo: Detail com identidade/risco/ação antes de métricas; ações destrutivas descritas e acessíveis.

### Registrar — P1 — P0 responsivo RESOLVED

- tarefas: escolher alvo, operação, preencher, revisar e registrar execução factual;
- hierarquia atual: PageIntro, contexto, indicador de três etapas, seções por domínio e barra sticky;
- primária: avançar/finalizar; secundária: voltar;
- estados: contexto de Agenda, validações, finalizing, offline/partial/rejected via contrato de resultado;
- mobile/tablet: controles de contexto empilham abaixo de `lg` e usam duas colunas em 1024 px+; revalidação 390/768/1024 light/dark confirmou zero overlap e zero clipping. Workflow longo, teclado e bottom nav ainda podem competir com a action bar;
- reutilização: StepIndicator, FormSection, StateBanner, StickyActionBar e resumo de confirmação;
- risco/padrão alvo: P0 responsivo encerrado; o padrão final permanece Operational Workflow, preservando input em falha e nunca apresentando parcial como sucesso global.

### Agenda — P1

- tarefas: ver atraso/hoje, filtrar, agrupar, abrir item e levar intenção ao Registrar;
- hierarquia atual: overview, refresh/error locais, métricas, diagnósticos, compliance, lifecycle, filtros e grupos;
- primária: `Registrar manejo`; secundárias: protocolos/filtros/expansão;
- estados/filtros: status, domínio, calendário, classe operacional, período e agrupamento;
- mobile: filtros e grupos precisam redução progressiva; ações do item com alvo de toque;
- reutilização: PageIntro via OverviewHeader, MetricCard, FilterBar, StateBanner, EmptyState;
- risco/padrão alvo: Agenda separa intenção de fato e não esconde compliance ou atraso.

## Matriz única de migração

Evidências: `E1` = revisão de código + testes existentes; `E2` = 360/768/1024/1440, light/dark, teclado e contraste; `E3` = contrato operacional/regressões; `E4` = comparação de primitives/tokens sem hardcoded novo.

| Route/grupo | Screen | Priority | Current patterns | Target patterns | Visual debt | Responsive debt | Accessibility debt | Operational risk | Dependencies | Phase | Acceptance evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| global | foundations/shell/branding | P1 | tokens parciais, AppShell, nav divergente | Foundations + semantic roles + shell único | hardcoded e aliases ausentes | modelo mobile divergente | foco/contraste/touch gate | alto se status virar brand | contrato F18 | F19 | E1–E4 |
| `/home` | Home | MIGRATED | Dashboard compartilhado | Dashboard + MetricCard + DecisionCard | dívida localizada não bloqueante | grid progressivo validado | landmarks preservados | preservado | F19 | F20 concluída | E1–E4 aprovadas |
| `/animais` | Animais | MIGRATED | List + FilterBar + responsive list | List + FilterBar + responsive list | P2 localizado | mobile validado | labels/ordem tratadas | preservado | F19 | F20 concluída | E1–E4 aprovadas |
| `/animais/:id` | AnimalDetalhe | MIGRATED | Detail + tabs adaptativas | Detail + StateBanner + tabs adaptativas | arquivo monolítico permanece dívida técnica | tabs validadas | headings/ações preservados | preservado | F19 | F20 concluída | E1–E4 aprovadas |
| `/registrar` | Registrar | MIGRATED (P0 RESOLVED) | Operational Workflow | Operational Workflow | composição extensa preservada | 390/768/1024/1440 aprovados | progresso/erro/foco tratados | preservado | F19 + fluxos canônicos | F20 concluída | E1–E4 aprovadas |
| `/agenda` | Agenda | MIGRATED | Agenda + FilterBar + StateBanner | Agenda + FilterBar + StateBanner | estado vazio real validado | filtros/grupos responsivos | feedback assíncrono tratado | preservado | F19 + fluxos canônicos | F20 concluída | E1–E4 aprovadas |
| auth/contexto | login, signup, invite, fazenda | P2/P3 | cards/forms locais | Form + PageHeader | branding/copy | formulários | labels/erros | médio | F19 | pós-F20 | E1,E2,E4 |
| cadastro animal | novo/editar/reprodução/pós-parto/cria | P2 | forms/tabs locais | Form/Workflow | cores/composição | fluxo longo | foco/erros | alto | padrões F20 | pós-F20 | E1–E4 |
| lotes | lista/importar/novo/editar/detalhe | P2 | cards/forms/detalhe local | List/Form/Detail | 93 cores no detalhe | grids/tabelas | ações/labels | alto | F19+F20 | pós-F20 | E1–E4 |
| pastos | lista/importar/novo/editar/detalhe | P2 | cards/forms/timeline | List/Form/Detail | 80 cores no detalhe | grids densos | ordem/ações | alto | F19+F20 | pós-F20 | E1–E4 |
| `/animais/transicoes` | AnimaisTransicoes | P2 | tabela local | DataTable/responsive list | cores/células | tabela mobile | headers/seleção | alto | F19+List | pós-F20 | E1–E4 |
| `/eventos` | Eventos | P2 | listagem histórica local | List/Detail read-only | densidade | lista mobile | proveniência | médio | List F20 | pós-F20 | E1–E4 |
| `/financeiro` | Financeiro | P2 | dashboard/lista/dialog | Dashboard + List + AlertDialog | cores/destrutivo | densidade | confirmação | alto | F19 | F22 | E1–E4 |
| `/insumos` | Insumos | P2 | tabs/cards/workflows | List + Workflow | extensão/duplicação | tabs/ações | ícones/labels | alto | F19+F20 | pós-F20 | E1–E4 |
| `/relatorios`, `/dashboard` | relatórios/KPIs | P2 | cards e gráficos locais | Report/Dashboard | coverage desigual | gráficos/tabelas | legendas/contraste | alto | F19 + MetricResult | F21/F22 | E1–E4 |
| `/contrapartes` | Contrapartes | P2 | lista/dialog | List + Dialog | composição | lista mobile | descriptions | médio | F19 | F22 | E1–E4 |
| configurações/conta | Configurações, Perfil, Membros, Fazenda | P2/P3 | sections/tabs/dialogs | Configuration/Form | padrões divergentes | tabs/forms | permissões/descriptions | médio | F19 | pós-F20 | E1–E4 |
| `/reconciliacao` | Reconciliacao | P2 | cards + 3 dialogs | Workflow + operational states | estados densos | dialogs | foco/causa | muito alto | F19 + sync canônico | F24 | E1–E4 |
| sanitário | Protocolos + Catálogo v2 | P2 | tabs/cards/filters | Configuration/List | tabs/densidade | filtros/tabs | leitura/estado | alto | F19 | F21 | E1–E4 |
| `/reproducao` | ReproductionDashboard | P2 | dashboard local | Dashboard/MetricCard | métricas | grid | coverage | médio | F19 | F21 | E1–E4 |
| redirects e `*` | Index/Admin/Categorias/NotFound | P3 | Navigate/erro local | alias documentado/ErrorState | copy/cores | baixa | idioma/foco | baixo | shell F19 | pós-F20 | E1,E2,E4 |

## Sequência

1. P0 responsivo do Registrar encerrado e revalidado; nenhum P0 permanece aberto na saída da F18.
2. F19 implementa foundations, shell e branding, sem migrar as jornadas da F20.
3. F20 migra Home, Animais, AnimalDetalhe, Registrar e Agenda, uma jornada por patch verificável.
4. Demais rotas migram por padrão comprovado e fase de produto, sem alterar contratos de domínio por conveniência visual.

## Restrições

Não alterar writer, fonte factual, sync, Dexie, Supabase, migration, RLS, RPC, `MetricResult` ou `DecisionRecommendation` para cumprir aparência. Qualquer mudança de fluxo exige consulta e classificação segundo `OPERATIONAL_FLOWS`.
