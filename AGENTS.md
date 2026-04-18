# REBANHOSYNC — ENTRYPOINT FOR CODEX

Estado atual:
- Beta interno
- MVP completo e operacional
- Prioridade: patches pequenos, locais e revisaveis
- Este arquivo e um dispatcher; detalhes ficam em contextos locais e skills

## 1) Leitura inicial obrigatoria

Leia nesta ordem:
1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/PROCESS.md`

Objetivo:
- alinhar snapshot operacional atual
- delimitar escopo por `capability_id` ou `infra.*`
- evitar leitura historica desnecessaria

## 2) Leitura adicional apenas se a tarefa exigir

Arquitetura/offline/sync:
- `docs/ARCHITECTURE.md`
- `docs/OFFLINE.md`
- `docs/CONTRACTS.md`

Banco/seguranca/tenancy:
- `docs/DB.md`
- `docs/RLS.md`

Estado derivado/backlog:
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/TECH_DEBT.md`
- `docs/ROADMAP.md`
- `docs/review/RECONCILIACAO_REPORT.md`

Dominio/produto:
- `docs/PRODUCT.md`
- `docs/SYSTEM.md`
- `docs/REFERENCE.md`

## 3) Nao ler por padrao

Evite abrir sem necessidade explicita:
- `docs/archive/**`
- auditorias historicas
- relatorios temporarios
- arquivos gerados (`dist/**`, `coverage/**`, caches)

## 4) Escopo padrao de trabalho

- Atacar no maximo 1 capability principal por tarefa
- Preferir diff minimo sobre reescrita completa
- Evitar refatoracao ampla sem pedido explicito
- Se ambiguo, assumir menor escopo seguro e explicitar

## 5) Contexto local: quando escalar

Antes de abrir muitos arquivos, verificar `AGENTS.md` local.

Escalar para:
- `src/pages/AGENTS.md` (dispatcher local de telas e hotspots de pagina)
- `src/pages/Registrar/AGENTS.md` (restricoes locais do hotspot Registrar)
- `src/pages/Agenda/AGENTS.md` (restricoes locais do hotspot Agenda)
- `src/pages/ProtocolosSanitarios/AGENTS.md` (restricoes locais do hotspot de protocolos)
- `src/lib/offline/AGENTS.md` (Dexie, gestures, rollback, pull, sync worker, telemetry, `tableMap`)
- `src/lib/sanitario/AGENTS.md` (catalogo/protocolos/calendario/overlay/compliance/produtos)
- `src/lib/reproduction/AGENTS.md` (cobertura/IA/diagnostico/parto/pos-parto/cria)
- `supabase/functions/sync-batch/AGENTS.md` (validacao autoritativa/status codes/reason codes)
- `supabase/migrations/AGENTS.md` (schema/RLS/RPC/views/triggers/FKs compostas)
- `src/pages/Registrar/README.md` (hotspot de pagina e recortes locais)
- `src/pages/Agenda/README.md` (hotspot de agenda e recortes locais)
- `src/pages/ProtocolosSanitarios/README.md` (hotspot sanitario de pagina)

Regra:
- o contexto local aprofunda
- o root enquadra e limita

## 6) Skills

Consulte `.agent/skills/README.md` e use skill quando o problema for majoritariamente especializado (offline/sync, sanitario, reproducao, migrations/RLS, hardening, reconcile docs, etc).

## 7) Areas criticas

Tratar como risco alto:
- `src/lib/offline/**`
- `src/lib/sanitario/**`
- `src/lib/reproduction/**`
- `src/lib/animals/**` (taxonomia/elegibilidade/apresentacao derivada)
- `src/lib/events/**` (builders/validators/payloads)
- `src/pages/Registrar/**`
- `src/pages/Agenda/**`
- `src/pages/ProtocolosSanitarios/**`
- `supabase/functions/sync-batch/**`
- `supabase/migrations/**`

## 8) Invariantes globais (resumo)

- Two Rails: agenda (intencao futura mutavel) x eventos (fatos passados append-only)
- Correcao de evento por contra-lancamento, nunca update destrutivo de negocio
- Preservar idempotencia, rollback deterministico e metadata obrigatoria de sync
- `fazenda_id` e fronteira de isolamento; nao introduzir bypass cross-tenant
- Preservar separacao sanitaria (base oficial x overlay x protocolo operacional)
- Preservar linking reprodutivo deterministico (parto -> pos-parto -> cria)

## 9) Forma de entrega

Retornar por padrao:
- diff minimo
- ate 3 riscos
- ate 5 arquivos principais afetados
- testes/comandos realmente necessarios

## 10) Validacao minima

Sempre que tocar codigo:
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`

Se tocar sync/migrations/RLS/edge:
- revisar isolamento por `fazenda_id`
- revisar FKs compostas
- revisar invariantes append-only
- revisar reason codes/rollback/compatibilidade offline

## 11) Atualizacao documental

Atualizar docs derivados somente com mudanca funcional real:
1. `docs/IMPLEMENTATION_STATUS.md`
2. `docs/TECH_DEBT.md`
3. `docs/ROADMAP.md`
4. `docs/review/RECONCILIACAO_REPORT.md`

## 12) Codex execution

Antes da tarefa:
- ler `README.md`, `docs/CURRENT_STATE.md`, `docs/PROCESS.md`
- se necessario: `powershell -File scripts/codex/bootstrap.ps1`

Nao editar por padrao:
- `docs/archive/**`
- `dist/**`
- `coverage/**`
- `*.tsbuildinfo`

Antes de editar path restrito/gerado explicitamente:
- `powershell -File scripts/codex/preflight.ps1 -Paths "<path1>","<path2>"`

Apos tocar area critica:
- `powershell -File scripts/codex/validate.ps1 -TouchedPaths "<path1>","<path2>"`

## 13) Higiene

- nao versionar artefatos gerados
- manter raiz previsivel (sem relatorios/transientes soltos)
- priorizar contexto atual (`README` + `CURRENT_STATE` + `PROCESS`)
- em conflito documental: codigo/migrations > `CURRENT_STATE` > normativos > derivados > historico
