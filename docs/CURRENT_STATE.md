# Current State (Snapshot Operacional)

> **Status:** Snapshot vivo
> **Ultima atualizacao:** 2026-04-29
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
- saneamento sanitario P0-P6.3b concluido no recorte atual: SQL/Supabase permanece motor lider de materializacao/recompute; TypeScript preserva contratos, adapters, golden tests e suporte offline.
- calendario sanitario TS->SQL alinhado; dedup sanitario canonico estruturado em TS/SQL; agenda sanitaria canonica agora bloqueia geracao indevida por catalogo global e exige gates explicitos por janela, risco, configuracao, ativacao operacional ou especie canonica transicional.
- taxonomia sanitaria passiva introduzida (`ProtocolKind`, `MaterializationMode`, `ComplianceKind`) sem mudanca de comportamento.
- `src/lib/sanitario/**` reorganizado por responsabilidade e boundary `Registrar` <-> sanitario documentado.
- Shims de migrations pos-squash removidos da pasta ativa; testes de contrato leem a baseline canonica ou fixtures canonicas.

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

Residual dominante:
- leitura/preparacao de dados ainda concentrada no shell (nao composicao macro).

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

Contrato atual de agenda sanitaria pos-P6.3b:
- P6.1 consolidou o catalogo sanitario conservador: o seed e tecnico/idempotente, separa catalogo oficial, tecnicos recomendados, notificaveis e produtos, mas nao e fonte normativa completa.
- P6.2.1 materializa brucelose PNCEBT apenas para femeas ativas, com nascimento conhecido, janela etaria 90-240 dias, `gera_agenda=true`, dedup canonico por janela e bloqueio de backfill expirado.
- P6.2.2a/P6.2.2b impedem reabertura de brucelose concluida: primeiro por agenda concluida com evento sanitario valido e depois por `payload.sanitary_completion` espelhado em `eventos` e persistido canonicamente em `eventos_sanitario`.
- P6.2.3 permite raiva dos herbivoros somente por protocolo operacional ativo, item `gera_agenda=true`, `family_code='raiva_herbivoros'`, `fazenda_sanidade_config.zona_raiva_risco` medio/alto e ativacao explicita no payload; nao ha vacinacao universal.
- P6.2.4 permite agenda tecnica recomendada somente por protocolo operacional da fazenda, item `gera_agenda=true` e ativacao explicita no payload; `controle_parasitario` exige `pressao_helmintos` medio/alto e `controle_carrapato` exige `pressao_carrapato` medio/alto.
- P6.3a adicionou `animais.especie` como campo canonico nullable minimo (`bovino` | `bubalino` | `null`), sem backfill obrigatorio e sem tornar especie obrigatoria.
- P6.3b aplica gate sanitario transicional por especie na `sanitario_recompute_agenda_core`: `especie=null` continua elegivel temporariamente; brucelose e raiva permitem `bovino`, `bubalino` e `null`; tecnicos recomendados respeitam alvo explicito de especie quando existir e, sem alvo explicito, permitem as especies canonicas e `null`.
- PNEFA/aftosa, IN50/doencas notificaveis, GTA, suspeitas, checklists e biosseguranca continuam fora da agenda automatica.

---

## 2.1 Invariantes operacionais consolidados

- idempotencia de execucao: `1 acao -> 1 createGesture`;
- guards de reentrada/concorrencia ativos nos fluxos operacionais criticos para evitar dupla execucao;
- regressao semantica travada por `tests/smoke/semantic_terms_guard.smoke.test.ts`.

---

## 2.2 Baseline Supabase validada

Estado real validado em 2026-04-29:

- `supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql` e a baseline canonica atual de desenvolvimento.
- `supabase/seed.sql` repopula catalogos sanitarios canonicos conservadores e idempotentes: somente brucelose PNCEBT entra como agenda automatica; raiva, PNEFA/aftosa, notificaveis, GTA, biosseguranca e tecnicos recomendados nao geram agenda por seed.
- `supabase/migrations_legacy_pre_baseline/` preserva a cadeia antiga como backup documental.
- Shims de compatibilidade pos-squash foram removidos da pasta ativa de migrations; testes de contrato passaram a ler a baseline canonica ou fixtures canonicas de dominio.
- `supabase db reset` passou em rodada dupla; seed idempotente passou.
- RLS funcional passou para `owner`, `manager`, `cowboy` e usuario sem vinculo.
- FK composta bloqueou cruzamento entre fazendas.
- Fluxo minimo agenda sanitaria -> `eventos` -> `eventos_sanitario` passou via RPC.
- `sync-batch` foi validado com handler real; o gateway local rodou com `functions serve --no-verify-jwt`, mas `auth.getUser(jwt)` e RLS foram exercitados dentro do handler.
- Validador funcional: `node scripts/codex/validate-supabase-baseline-functional.mjs`.

Limites explicitamente mantidos:
- nao ha implementacao nova de sequencia D1/D2/anual de raiva neste recorte P6;
- `animais.especie` existe como campo canonico nullable minimo (`bovino`/`bubalino`/`null`) e atua como gate sanitario transicional, sem backfill obrigatorio e sem obrigatoriedade de preenchimento;
- nao ha indice JSONB para `payload.sanitary_completion`;
- o seed sanitario permanece conservador e nao e catalogo normativo completo.

Riscos remanescentes:
- validar caminho completo do gateway JWT local sem `--no-verify-jwt`;
- manter o seed sanitario como catalogo tecnico conservador, nao fonte normativa completa;
- sanear legado com `animais.especie is null` e decidir futuramente se `null` deve bloquear agenda sanitaria ou exigir preenchimento antes de aplicar protocolo;
- acompanhar historico de timeout intermitente em testes UI longos.

---

## 3. O que ainda nao esta consolidado

- estabilizacao ampla de testes fora dos recortes locais de hotspot;
- consolidacao da nova suite de integracao por fluxo (`tests/integration/flows/**`) como cobertura minima cross-flow;
- cleanup residual de shell/read-model nos pontos restantes;
- carencia ainda e metadata/compliance parcial, nao motor pleno de withholding;
- produto/lote/estoque ainda nao formam rastreabilidade sanitaria completa;
- SISBOV/fiscal continuam fora do core sanitario atual;
- acabamento de UX para reduzir ambiguidade e carga cognitiva;
- maior consistencia cross-flow (agenda <-> registrar <-> protocolos).

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
