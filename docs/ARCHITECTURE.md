# Arquitetura Operacional (Two Rails)

> **Status:** Normativo
> **Fonte de Verdade:** Codigo fonte e migrations
> **Ultima Atualizacao:** 2026-05-09

Documento normativo enxuto para semantica operacional transversal e invariantes de execucao. Complementa `docs/SYSTEM.md`.

---

## 1. Modelo Two Rails

- **Rail 1 (Agenda / `agenda_itens`)**: intencao futura mutavel.
- **Rail 2 (Eventos / `eventos` + `eventos_*`)**: fato executado protegido contra update destrutivo de negocio.
- Agenda e Evento nao se confundem.
- Eventos possuem protecao contra update destrutivo de negocio via trigger/função, com excecoes tecnicas controladas como metadados, `deleted_at`, `updated_at` e `server_received_at`.
- Correcao historica por `corrige_evento_id` esta parcialmente validada: o campo existe, mas o fluxo completo de correcao nao foi confirmado.

Regra de acao:
- `Registrar` / `Executar` -> escrevem no trilho de eventos.
- `Encerrar` / `Cancelar` -> atualizam pendencia no trilho de agenda.
- `Aplicar protocolo` -> recalcula/materializa agenda; nao cria evento diretamente.
- Agenda concluida sem evento vinculado nao deve ser tratada como execucao factual.
- Necessidade futura deve partir de agenda materializada valida quando o dominio tiver agenda confirmada; esta regra esta mais fortemente validada para sanitario e cria/pos-parto.

---

## 2. Motor Sanitario e Boundary TS/SQL

Invariantes atuais do dominio sanitario:

- SQL/Supabase e o motor lider atual de materializacao e recompute da agenda sanitaria, via `sanitario_recompute_agenda_core`.
- Ha RPC/funcoes de recompute sanitario por animal, mas o disparo automatico por alteracao de dados do animal nao foi confirmado no codigo inspecionado; o recompute por protocolo/config foi mais claramente validado.
- TypeScript mantem contratos de dominio, adapters, suporte offline/local e golden/parity tests; nao deve ser tratado como fonte alternativa silenciosa de materializacao.
- Calendario emitido pelo TS para SQL usa vocabulario reconhecido pelo SQL; leitura continua aceitando payload legado PT-BR.
- Dedup sanitario usa contrato canonico estruturado em TS e SQL, protegido por `buildSanitaryDedupKey` e pela funcao SQL canonica correspondente.
- Sequenciamento sanitario estabiliza Raiva D1/D2/anual: D2 e etapa unica dependente; reforco anual e a etapa recorrente.
- Taxonomia sanitaria (`ProtocolKind`, `MaterializationMode`, `ComplianceKind`) e passiva e retrocompativel; nao decide materializacao por si so.

Boundary `Registrar` <-> sanitario:

- `Registrar` orquestra estado visual, navegacao, feedback e composicao do fluxo.
- `src/lib/sanitario/models/**` concentra payload, preflight, pacote do Registrar e taxonomia passiva.
- `src/lib/sanitario/infrastructure/**` concentra boundary RPC/fallback de execucao sanitaria.
- SQL/RPC fecha agenda sanitaria de forma transacional e recalcula agenda operacional.
- Compliance sanitario esta parcialmente validado por overlays, views e regras sanitarias, mas nao deve ser tratado como bloqueio operacional completo e universal sem nova validacao.
- `sanitario_casos` e o contexto mutavel por animal para acompanhamento longitudinal de suspeitas notificaveis e manejo clinico. Ele nao substitui eventos: cada registro operacional continua em `eventos`/`eventos_*`, com vinculo opcional por `eventos.sanitario_caso_id`.
- Casos sanitarios sao tenant-scoped por `fazenda_id`, protegidos por RLS de membership, sincronizados offline como `state_sanitario_casos` e devem preservar FK composta com `animais` e `eventos` quando houver vinculo.
- O fluxo operacional do `Registrar` pode vincular manejo sanitario a um caso clinico existente ou abrir um caso clinico no mesmo gesto do evento, mantendo `1 acao -> 1 createGesture`.

Contratos disponiveis para consumo:

- `resolveRegistrarSanitaryPackage`
- `buildSanitaryExecutionPayload`
- `validateSanitaryExecutionPreflight`
- `executeSanitaryCompletion`
- `buildSanitaryDedupKey`
- adapters de calendario TS/SQL

---

## 3. Taxonomia Semantica Consolidada

CTAs oficiais do fluxo operacional:

- `Registrar` (fluxo completo com formulario)
- `Executar` (acao direta com evento imediato)
- `Encerrar` (fecha pendencia na agenda)
- `Cancelar` (cancela pendencia na agenda)
- `Aplicar protocolo` (materializa agenda por regra)
- `Seguir pos-parto` / `Seguir rotina da cria` (continuidade guiada de reproducao)
- `Voltar para agenda` (navegacao contextual)

Termos proibidos:
- `Concluir direto`
- `Abrir proxima acao`
- `Abrir registro detalhado`
- `Executar direto`

---

## 4. Idempotencia e Concorrencia de Execucao

Invariante operacional:

- `1 acao -> 1 createGesture`.

Regras de implementacao:

- handlers de acao direta devem impedir reentrada (clique duplo/submissao repetida);
- protecoes de concorrencia devem bloquear execucoes paralelas redundantes;
- fluxo critico deve preservar `1 acao -> 1 resultado -> 1 navegacao`.

---

## 5. Protecao de Regressao

- `tests/smoke/semantic_terms_guard.smoke.test.ts` e a regra oficial para bloquear retorno de termos semanticos proibidos.
- O gate de qualidade deve manter smoke ativo para validar previsibilidade dos fluxos centrais.

---

## 6. Baseline Supabase de Desenvolvimento

A baseline canonica atual de desenvolvimento e `supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql`.

Estado validado:

- `supabase db reset` passou em rodada dupla.
- `supabase/seed.sql` repopula catalogos sanitarios minimos de forma idempotente.
- `supabase/migrations_legacy_pre_baseline/` contem as migrations antigas preservadas como backup documental.
- Shims de compatibilidade pos-squash foram removidos da pasta ativa; testes de contrato leem a baseline canonica ou fixtures canonicas de dominio.
- RLS funcional passou para `owner`, `manager`, `cowboy` e usuario sem vinculo.
- FKs compostas impediram vinculo cross-farm.
- Agenda sanitaria executada via `sanitario_complete_agenda_with_event` gerou `eventos` e `eventos_sanitario` com vinculo de origem preservado.
- `sync-batch` foi validado com handler real. Caveat: no ambiente local, o gateway da CLI rodou com `functions serve --no-verify-jwt`; dentro do handler, `auth.getUser(jwt)` e o cliente user-scoped ainda exerceram autenticacao e RLS.

Validador funcional:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Riscos remanescentes:

- validar o caminho completo do gateway JWT sem `--no-verify-jwt`;
- manter claro que o seed sanitario e minimo/tecnico, nao normativo;
- acompanhar timeouts intermitentes em testes UI longos.
