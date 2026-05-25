# Current State (Snapshot Operacional)

> **Status:** Snapshot vivo
> **Ultima Atualizacao:** 2026-05-20
> **Estado do produto:** Beta interno
> **Fase atual:** MVP funcional completo -> **SLC (Simple, Lovable, Complete) em consolidacao**

---

## 1. Leitura de fase

O RebanhoSync nao esta mais na fase de organizar arvore e quebrar monolitos iniciais.

Os hotspots criticos de UI (`Registrar` e `Agenda`) passaram pelo hardening estrutural principal, com shell mais fino e fronteiras locais mais claras entre composicao, estado, interacao, policy e efeitos.

A fase corrente e de **consolidacao operacional**:
- preservar previsibilidade dos fluxos centrais;
- reduzir friccao de uso em campo;
- aumentar consistencia de experiencia;
- estabilizar qualidade para evolucao incremental sem regressao estrutural.

Consolidacoes recentes da fase SLC:
- semantica transversal padronizada: `Registrar`, `Executar`, `Encerrar`, `Aplicar protocolo`, `Seguir fluxo` (reproducao);
- remocao de termos ambiguos legados da UI operacional;
- reforco do modelo Two Rails: Agenda (`agenda_itens`) != Eventos (`eventos`);
- `Aplicar protocolo` atua apenas na agenda (materializacao/recalculo), sem gerar evento.
- saneamento sanitario P0-P6.4b concluido no recorte atual: SQL/Supabase permanece motor lider de materializacao/recompute; TypeScript preserva contratos, adapters, golden tests e suporte offline.
- calendario sanitario TS->SQL alinhado; dedup sanitario canonico estruturado em TS/SQL; agenda sanitaria canonica agora bloqueia geracao indevida por catalogo global e exige gates explicitos por janela, risco, configuracao, ativacao operacional ou especie canonica transicional.
- taxonomia sanitaria passiva introduzida (`ProtocolKind`, `MaterializationMode`, `ComplianceKind`) sem mudanca de comportamento.
- `src/lib/sanitario/**` reorganizado por responsabilidade e boundary `Registrar` <-> sanitario documentado.
- Shims de migrations pos-squash removidos da pasta ativa; testes de contrato leem a baseline canonica ou fixtures canonicas.
- `docs/review/RebanhoSync_auditoria.md` foi ajustado pos-validacao como contrato documental de fontes de verdade para orientar uso de `insights` e marcadores sem transformar sinal auxiliar em fonte primaria ou comportamento operacional.
- `src/lib/insights/` foi consolidado como core puro/read-only de composicao operacional; a primeira integracao passiva foi conectada na Home por `src/features/operationalInsights/` sem IO no core, sem persistencia, sem eventos e sem acoes de dominio.
- Pastagens passaram a ter trilho historico proprio para avaliacao/ronda: `dominio='pastagem'`, detalhe `eventos_pasto_avaliacao`, store local `event_eventos_pasto_avaliacao` e registro minimo em `PastoDetalhe`, sem atualizar `pastos`, `lotes`, `pasto_ocupacoes` ou agenda.
- Refatoracao visual SLC aplicada em duas passagens: Home virou painel tatico, Animais ficou card-first sem tabela tecnica duplicada, Registrar foi compactado por intencao/alvo/essencial/salvar e telas operacionais, gerenciais, auxiliares e cadastros passaram a usar headers, cards, badges e espacamentos mais consistentes, sem alterar regras de negocio.

### ✅ Refinamentos Recentes (Maio/2026)
- **Identidade Azul Sync Técnico**: Implementada e consolidada em runtime.
- **Contraste Corretivo**: Light/Dark mode validados para legibilidade em campo (red-400 p/ perigo, cards com 10% opacidade).
- **Navegação Híbrida**: Bottom Nav (mobile) e SideNav (desktop) operacionais.
- **Home Operacional**: Validada como painel tatico "Hoje", priorizando atrasos, agenda do dia e acoes imediatas; leituras passivas foram removidas ou rebaixadas.
- **Fluxo de Registro**: Entrada contextual segura por Lote/Pasto/Animal/Agenda, sem inferência automática destrutiva.
- **Refatoracao visual SLC**: Reducao agressiva de cards, descricoes redundantes, tabelas densas e status tecnicos em Home, Registrar, Animais, Lotes, Pastos, Reproducao, Dashboard, Eventos, Financeiro, Relatorios, Reconciliacao, Configuracoes, selecao de fazenda e cadastros de apoio.
- **Selecao de fazenda contextual**: cards de fazenda agora exibem municipio/UF, area, producao e manejo quando disponiveis, mantendo o fluxo de selecao sem nova regra de negocio.
- **Handoff Design**: Documentado em `docs/design/HANDOFF_VISUAL_UX_20260508.md`.

---

## 2. O que foi consolidado

### Hotspot `src/pages/Registrar`

Hardening estrutural principal concluido:
- IO saiu do shell;
- pacotes financeiro/sanitario sairam do shell;
- finalize orchestration saiu do shell;
- step-flow saiu do shell;
- query parsing saiu do shell;
- quick action policy saiu do shell;
- adapters de section/shell state sairam do shell.

Residual dominante:
- volume de composicao/JSX (sem orquestracao densa relevante).
- no recorte sanitario, o `Registrar` atua como orquestrador: payload, preflight, pacote sanitario e boundary RPC/fallback estao delegados a `src/lib/sanitario/**`.
- no recorte sanitario, `src/pages/Registrar/**` nao importa diretamente `@/lib/sanitario/engine/*`; labels visuais de calendario passam por `src/lib/sanitario/models/calendarDisplay.ts`.

### Hotspot `src/pages/Agenda`

Hardening estrutural principal concluido:
- action controller saiu do shell;
- shell state saiu do shell;
- interaction state saiu do shell;
- blocos macro de resumo/compliance/lifecycle sairam do shell;
- componente visual monolitico principal foi fatiado.
- TD-026 em reducao incremental: leitura/local data hook (`useAgendaPageData`), resumos visuais (`helpers/pageSummaries`) e metadados de linha (`helpers/rowMeta`) sairam do shell.

Residual dominante:
- wiring/orquestracao local de read-model, filtros, grupos, alvos criticos e efeitos existentes no shell.

### Dominio `src/lib/sanitario`

Estrutura fisica atual pos-P2:
- `models/`: tipos, adapters de payload, taxonomia passiva, preflight e builders puros.
- `engine/`: calendario, dedup, scheduler, regimen e precedencia de layers.
- `catalog/`: protocolos base, catalogo oficial, produtos e operacoes de catalogo.
- `compliance/`: read models, guards e regras regulatorio-documentais.
- `infrastructure/`: service, agenda schedule e boundary RPC/fallback.
- `customization/`: customizacao de protocolos por fazenda.

Contratos sanitarios centrais:
- `resolveRegistrarSanitaryPackage`
- `buildSanitaryExecutionPayload`
- `validateSanitaryExecutionPreflight`
- `executeSanitaryCompletion`
- `buildSanitaryDedupKey`
- adapters `toSqlCalendarMode` / `fromSqlOrLegacyCalendarMode` e equivalentes de anchor
- taxonomia passiva em `models/taxonomy.ts`

Contrato atual de agenda sanitaria pos-P6.4b:
- P6.1 consolidou o catalogo sanitario conservador: o seed e tecnico/idempotente, separa catalogo oficial, tecnicos recomendados, notificaveis e produtos, mas nao e fonte normativa completa.
- P6.2.1 materializa brucelose PNCEBT apenas para femeas ativas, com nascimento conhecido, janela etaria 90-240 dias, `gera_agenda=true`, dedup canonico por janela e bloqueio de backfill expirado.
- P6.2.2a/P6.2.2b impedem reabertura de brucelose concluida: primeiro por agenda concluida com evento sanitario valido e depois por `payload.sanitary_completion` espelhado em `eventos` e persistido canonicamente em `eventos_sanitario`.
- P6.2.3 permite raiva dos herbivoros somente por protocolo operacional ativo, item `gera_agenda=true`, `family_code='raiva_herbivoros'`, `fazenda_sanidade_config.zona_raiva_risco` medio/alto e ativacao explicita no payload; nao ha vacinacao universal.
- P6.2.4 permite agenda tecnica recomendada somente por protocolo operacional da fazenda, item `gera_agenda=true` e ativacao explicita no payload; `controle_parasitario` exige `pressao_helmintos` medio/alto e `controle_carrapato` exige `pressao_carrapato` medio/alto.
- P6.3a adicionou `animais.especie` como campo canonico nullable minimo (`bovino` | `bubalino` | `null`), sem backfill obrigatorio e sem tornar especie obrigatoria.
- P6.3b aplica gate sanitario transicional por especie na `sanitario_recompute_agenda_core`: `especie=null` continua elegivel temporariamente; brucelose e raiva permitem `bovino`, `bubalino` e `null`; tecnicos recomendados respeitam alvo explicito de especie quando existir e, sem alvo explicito, permitem as especies canonicas e `null`.
- P6.4a fixou o contrato TS de raiva operacional D1/D2/anual em `baseProtocols`/regimen: `raiva_d1`, `raiva_d2`, `raiva_anual`, `schedule_kind`, `depends_on`, `agenda_activation` por risco medio/alto e `unknown_history_policy='start_from_d1'` para D1; alias legado `raiva_reforco_30d` normaliza para `raiva_d2` apenas como leitura compativel.
- P6.4b materializou a sequencia de raiva na `sanitario_recompute_agenda_core`: D1 exige risco medio/alto, ativacao explicita e `unknown_history_policy='start_from_d1'`; D2 depende de evento sanitario D1 valido; anual exige D2 valida e ancora na ultima anual valida ou, na ausencia dela, em D2; datas vencidas sao clampadas para evitar backfill amplo.
- Sindrome vesicular/aftosa deixou de aparecer como verificacao PNEFA independente no seed; deve ser tratada dentro de `catalogo_doencas_notificaveis` pelo fluxo unico "Doencas notificaveis - registrar suspeita e orientar notificacao". IN50/doencas notificaveis, GTA, suspeitas, checklists e biosseguranca continuam fora da agenda automatica.
- Casos sanitarios estruturais foram introduzidos como estado mutavel por animal (`sanitario_casos` / `state_sanitario_casos`) para agrupar suspeita notificavel, manejo clinico e acompanhamento longitudinal. Eventos continuam fatos append-only e podem apontar para o caso por `sanitario_caso_id`; o alerta legado ainda funciona como fallback de leitura. O `Registrar` ja consegue vincular manejo sanitario a caso clinico ativo ou abrir novo caso clinico no mesmo gesto offline do evento, e o detalhe do animal lista os casos persistidos com timeline filtrada por caso, acao de manejo e encerramento manual validado para casos clinicos.
- O detalhe do animal tambem exibe apoio clinico read-only para casos clinicos com contexto de TPB, mastite, diarreia neonatal, sindrome respiratoria/pneumonia ou feridas/miiase, derivado da biblioteca canonica atual. A selecao pode vir de contexto textual, codigo clinico ou contrato versionado `payload.clinical_protocol` (`schema_version=1`), com origem visivel no card. Cada item pode abrir o `Registrar` com conduta/produto pre-preenchido, caso vinculado e referencia `clinical_protocol` carregada para o payload do evento quando o usuario salvar explicitamente; a timeline do caso tambem mostra leitura operacional desse contrato por evento vinculado e o painel de casos permite filtrar casos por roteiro clinico derivado. Essa navegacao/leitura nao cria agenda, evento, prescricao ou baixa de estoque.
- A governanca da biblioteca clinica minima agora e contrato TS testavel em `CLINICAL_PROTOCOL_LIBRARY_GOVERNANCE` e `validateClinicalProtocolLibraryGovernance`: todo roteiro clinico suportado deve ser `medicamentos`, `profile=terapeutico`, `gera_agenda=false`, `calendario_base.mode=clinical_protocol` e alvo por animal. O contrato tambem explicita efeitos proibidos: nao materializar agenda, nao criar evento sem acao explicita, nao prescrever automaticamente e nao baixar estoque.
- Terapia de Vaca Seca deixou de ser apenas pre-contrato: `evaluateDryCowTherapyReadiness` classifica candidatas por femea ativa, em lactacao, ainda nao seca, `data_prevista_parto` e janela 45-75 dias antes do parto; o `Registrar` registra secagem manual em gesto offline unico, gravando `payload.dry_cow_therapy` no evento e atualizando apenas `taxonomy_facts` do animal (`secagem_realizada=true`, `data_secagem`, `em_lactacao=false`). A migration `20260524000000_dry_cow_therapy_agenda_recompute.sql` implementa recompute SQL incremental por wrapper de `sanitario_recompute_agenda_core`, com owner preservado, ativacao operacional obrigatoria (`gera_agenda=true`, `family_code=terapia_vaca_seca`, `item_code=secagem-intramamario`, `agenda_activation.mode=dry_off_reproductive_window`), ancora em `taxonomy_facts.data_prevista_parto`, vencimento alvo em parto previsto - 60 dias com clamp por `_as_of`, dedup por ciclo de parto previsto e bloqueios anti-agenda-zumbi por evento `dry_cow_therapy`/agenda concluida. O item clinico padrao continua `gera_agenda=false`; a UI de protocolos da fazenda permite ativar/desativar explicitamente a agenda de Vaca Seca na copia tenant-scoped do item, sem alterar o catalogo canonico, sem criar evento e sem baixar estoque. A exposicao do controle e deliberadamente limitada a usuarios `owner`/`manager` em fazenda com `app_experience.mode="completo"`; fora desse modo o item segue visivel como apoio clinico com badge de exposicao controlada, mas sem CTA de ativacao. O script `scripts/codex/validate-dry-cow-therapy-functional.mjs` valida o fluxo Supabase local com item clinico sem ativacao, ativacao operacional, recompute, dedup, conclusao por evento, bloqueio de recriacao e cancelamento anti-agenda-zumbi; `scripts/codex/prepare-dry-cow-ui-smoke.mjs` e `scripts/codex/run-dry-cow-ui-smoke-cdp.mjs` cobrem o smoke visual/operacional em app real via Supabase local, Vite e Chrome/Edge CDP.
- Estoque MVP deixou de ser apenas guardrail conceitual e ganhou contrato estrutural inicial: a migration `20260525000000_insumos_inventory.sql` cria `insumos`, `insumo_apresentacoes`, `insumo_lotes` e `insumo_movimentacoes` como tabelas tenant-scoped por `fazenda_id`, com RLS, FKs compostas, lotes fisicos, apresentacoes/volumes e saldo hibrido. `insumo_movimentacoes` e append-only, consumo exige evento fonte ativo, e saldo de lote e materializado por trigger sem baixa automatica ao registrar evento. O offline/sync ja conhece `state_insumos`, `state_insumo_apresentacoes`, `state_insumo_lotes` e `state_insumo_movimentacoes`; helpers puros cobrem conversao de apresentacao, projecao de saldo, bloqueio de saldo insuficiente, entrada/ajuste auditavel e elegibilidade nutricional por `eventos_nutricao` ou `eventos_pasto_avaliacao`. A tela `/insumos` oferece o primeiro fluxo operacional: entrada inicial de insumo/apresentacao/lote para `owner|manager`, entrada complementar em lote existente, ajuste positivo/negativo auditavel, consumo manual por evento sanitario/nutricional/pastagem elegivel e leitura de saldo operacional com movimentacoes locais pendentes. Ao abrir, a tela mescla eventos fonte sanitarios/nutricionais/pastagem e atualiza o catalogo veterinario para permitir consumo direto a partir de eventos ja sincronizados.

### Central Operacional passiva

Primeira integracao read-only concluida:
- `src/lib/insights/` atua como core puro de composicao operacional, com funcoes deterministicas e sem IO, Supabase, Dexie, UI, persistencia ou `Date.now`.
- `src/features/operationalInsights/operationalInsightsAdapter.ts` normaliza dados ja carregados em memoria/read models para os modulos puros de insights.
- `src/features/operationalInsights/useOperationalInsights.ts` memoiza o consumo do adapter.
- `src/features/operationalInsights/OperationalInsightsPanel.tsx` expõe painel somente leitura.
- `src/pages/Home.tsx` e a primeira superficie da Central Operacional passiva, agora organizada como painel tatico em camadas: prioridade operacional, acao imediata e contexto secundario.
- A Home prioriza atrasadas, agenda de hoje e registro rapido; leituras passivas como resumo de base e manejo recente foram removidas/rebaixadas para reduzir densidade.
- O painel read-only foi mantido como contexto secundario, com estados mais compactos e sem competir com a acao primaria.

Leituras preservadas ou rebaixadas conforme contexto:
- pendencias abertas, vencem hoje e atrasadas;
- pendencias sanitarias e sinais operacionais auxiliares;
- rebanho por estagio e KPIs mensais apenas como contexto, nao como prioridade operacional da Home.

Estados exibidos:
- `Bloqueado`: fonte obrigatoria ausente;
- `Vazio`: fonte carregada, sem itens;
- `Parcial`: fonte carregada com limitacao;
- `Completo`: fonte carregada, leitura completa.

Fontes lidas pela primeira integracao:
- `state_agenda_itens`;
- `state_animais`;
- `event_eventos` / eventos factuais do periodo mensal;
- `state_protocolos_sanitarios_itens` como apoio de produto/protocolo.

Limites preservados:
- a Central nao conclui agenda, nao gera agenda e nao cria evento;
- nao persiste tag/marcador e nao transforma `tagSignals` em fonte primaria;
- nao calcula carencia operacional, pronto para venda/abate, peso atual confiavel ou IATF amplo;
- agenda continua intencao operacional, nao fato historico;
- protocolo configurado continua regra, nao execucao.
- o painel permanece sem botao, link, `onClick` ou CTA de dominio.

---

### Pastagens e rondas de campo

Consolidacao recente no dominio de pastos:
- P0/P1 preservam a separacao entre movimentacao factual (`eventos_movimentacao`) e estado/materializacao operacional (`lotes.pasto_id`, `pasto_ocupacoes`).
- P2 adicionou ficha tecnica agronomica do pasto (`tipo_area`, forrageira/cultivar, metas de altura e capacidade UA alvo), mantendo `tipo_pasto` legado.
- P3 removeu curral/brete/balanca da infraestrutura ativa do pasto; `infraestrutura.curral` permanece apenas como legado tolerado.
- P4 registra avaliacao/ronda de pasto como evento historico append-only (`eventos` + `eventos_pasto_avaliacao`), usando `createGesture`/Dexie/TABLE_MAP e exibindo a ultima avaliacao em `PastoDetalhe`.

Limites preservados:
- ronda de pasto nao atualiza cadastro estatico de `pastos`;
- nao altera `lotes`;
- nao altera `pasto_ocupacoes`;
- nao gera agenda, alerta, recomendacao automatica, dashboard ou motor agronomico.

---

## 3. O que ainda nao esta consolidado

- estabilizacao ampla de testes fora dos recortes locais de hotspot;
- consolidacao da nova suite de integracao por fluxo (`tests/integration/flows/**`) como cobertura minima cross-flow;
- cleanup residual de shell/read-model nos pontos restantes;
- carencia ainda e metadata/compliance parcial, nao motor pleno de withholding;
- compliance sanitario esta parcialmente validado por overlays, views e regras sanitarias, mas nao e bloqueio operacional completo e universal;
- produto/lote/estoque ja possuem base estrutural tenant-scoped, contratos offline iniciais e UI operacional minima validada em smoke real local; ainda falta lapidar edicao de cadastros e relatorios de estoque;
- SISBOV/fiscal continuam fora do core sanitario atual;
- peso atual confiavel, carencia ativa operacional e pronto para venda/abate continuam bloqueados como decisoes automatizadas por falta de fonte composta/read model consolidado;
- camada real de marcadores/tags persistidos como fonte primaria, consulta em linguagem natural, IA gerando agenda, IA concluindo execucao e motor geral IATF permanecem nao implementados/bloqueados;
- validacao de UX com dados reais de beta interno apos a refatoracao visual SLC;
- maior consistencia cross-flow fina (agenda <-> registrar <-> protocolos) e ajustes residuais por tela.

Esses pontos impedem declarar SLC consolidado neste momento.

---

## 4. Proximo estagio (MVP -> SLC)

### Simple
- manter fluxos criticos previsiveis e com menos ambiguidade;
- remover residuos de shell pesado onde ainda houver.

### Lovable
- aumentar coesao visual e consistencia de feedback;
- reduzir friccao entre intencao e execucao.

### Complete
- fechar buracos percebidos nas rotinas centrais do recorte-alvo;
- consolidar confiabilidade para evolucao sem reabrir acoplamento estrutural.

---

## 5. Referencias de acompanhamento

- [README.md](../README.md)
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- [TECH_DEBT.md](./TECH_DEBT.md)
- [ROADMAP.md](./ROADMAP.md)
- [PROCESS.md](./PROCESS.md)
- [RebanhoSync_auditoria.md](./review/RebanhoSync_auditoria.md)
