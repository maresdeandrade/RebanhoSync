# REBANHOSYNC - ENTRYPOINT RAPIDO PARA AGENTES

Objetivo deste arquivo: reduzir prompt futuro. Use isto como dispatcher curto; detalhes versionados ficam em `docs/AGENT_CONTEXT.md`, docs locais e skills.

Estado atual:
- Beta interno.
- MVP completo e operacional.
- Fase: consolidacao SLC, com prioridade em patches pequenos, locais e revisaveis.
- Mudancas devem ser enquadradas por `capability_id` ou `infra.*`.

## 1) Leitura inicial obrigatoria

Leia nesta ordem antes de agir:
1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/PROCESS.md`
4. `docs/AGENT_CONTEXT.md`

Objetivo:
- alinhar snapshot operacional atual;
- delimitar escopo;
- evitar leitura historica desnecessaria;
- nao reinventar invariantes ja documentadas.

Se o ambiente precisar de orientacao rapida:

```powershell
powershell -File scripts/codex/bootstrap.ps1
```

## 2) Fontes de verdade

Ordem de confianca em caso de conflito:
1. codigo + migrations ativas;
2. `docs/CURRENT_STATE.md`;
3. docs normativos;
4. docs derivados;
5. historico.

Fontes atuais principais:
- `README.md`: snapshot executivo e comandos principais.
- `docs/CURRENT_STATE.md`: estado operacional vivo.
- `docs/PROCESS.md`: processo normativo capability-centric.
- `docs/ARCHITECTURE.md`: Two Rails, boundary sanitario, idempotencia e baseline Supabase.
- `docs/AGENT_CONTEXT.md`: contexto ampliado para agentes.
- `docs/PRODUCT.md`, `docs/SYSTEM.md`, `docs/REFERENCE.md`: dominio/produto.
- `docs/IMPLEMENTATION_STATUS.md`, `docs/TECH_DEBT.md`, `docs/ROADMAP.md`, `docs/review/RECONCILIACAO_REPORT.md`: derivados, apenas quando houver delta real.

Observacao: `docs/OFFLINE.md`, `docs/CONTRACTS.md`, `docs/DB.md` e `docs/RLS.md` nao estavam presentes na raiz de `docs/` na ultima inspecao; versoes em `docs/archive/**` sao historicas.

## 3) Nao usar como fonte operacional

Evite abrir por padrao:
- `docs/archive/**`;
- auditorias historicas;
- relatorios temporarios;
- arquivos gerados (`dist/**`, `coverage/**`, caches, `*.tsbuildinfo`);
- dependencias instaladas (`node_modules/**`, `.kilo/node_modules/**`).

## 4) Baseline Supabase atual

Estado real inspecionado:
- baseline canonica ativa: `supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql`;
- pasta ativa de migrations contem a baseline e `supabase/migrations/AGENTS.md`;
- migrations antigas preservadas em `supabase/migrations_legacy_pre_baseline/`;
- shims pos-squash removidos da pasta ativa;
- seed tecnico/minimo/idempotente: `supabase/seed.sql`;
- seed sanitario nao e fonte normativa oficial.

Validador funcional real:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Caveat documentado: o validador pode servir `sync-batch` local com `supabase functions serve --no-verify-jwt` por limitacao de CLI/runtime antiga, mas o handler ainda valida `auth.getUser(jwt)` e usa cliente user-scoped com RLS.

## 5) Regras absolutas

- Nao colocar regra de negocio forte em componente React.
- Nao usar UI como unica fronteira de autorizacao.
- Nao expor `service_role` no client.
- Nao alterar migrations sem tarefa explicita.
- Nao alterar `supabase/seed.sql` sem tarefa explicita.
- Nao modificar RLS/policies/RPCs sem auditoria especifica.
- Preservar `fazenda_id` como fronteira de isolamento.
- Preservar compatibilidade com dados legados.
- Preservar separacao entre dominio, infraestrutura e apresentacao.
- Preferir mudancas pequenas, reversiveis e testaveis.
- Nao refatorar por conveniencia.

## 6) Invariantes arquiteturais

- Two Rails: `agenda_itens` e intencao futura mutavel; `eventos` e fatos passados append-only.
- Correcao historica ocorre por contra-lancamento, nunca update destrutivo de negocio.
- `Registrar` e `Executar` registram evento.
- `Encerrar` e `Cancelar` atuam na agenda.
- `Aplicar protocolo` materializa/recalcula agenda e nao gera evento diretamente.
- Idempotencia operacional: `1 acao -> 1 createGesture`.
- Offline-first: preservar gestures, rollback deterministico, metadata de sync, retries e compatibilidade de fila.
- Sanitario: base oficial, overlay/config por fazenda e protocolo operacional nao devem virar uma unica fonte misturada.
- Reproducao: preservar linking deterministico `parto -> pos-parto -> cria`.

Pipeline desejada em hotspots:
1. Normalize
2. Select / Policy
3. Payload
4. Plan
5. Effects
6. Reconcile

## 7) Contexto local

Antes de abrir muitos arquivos, procure `AGENTS.md` local no caminho afetado.

Escalar quando aplicavel:
- `src/pages/AGENTS.md`
- `src/pages/Registrar/AGENTS.md`
- `src/pages/Agenda/AGENTS.md`
- `src/pages/ProtocolosSanitarios/AGENTS.md`
- `src/lib/offline/AGENTS.md`
- `src/lib/sanitario/AGENTS.md`
- `src/lib/reproduction/AGENTS.md`
- `supabase/functions/sync-batch/AGENTS.md`
- `supabase/migrations/AGENTS.md`

Skills locais:
- indice real: `.agents/skills/README.md`
- use skill especializada para offline/sync, sanitario, reproducao, migrations/RLS, hardening, prepare-pr ou reconciliacao documental.

## 8) Alteracao segura

Antes de editar:
- declarar escopo permitido e proibido;
- listar arquivos provaveis;
- checar `git status --short`;
- rodar preflight se houver risco de path restrito:

```powershell
powershell -File scripts/codex/preflight.ps1 -Paths "<path1>","<path2>"
```

Durante a tarefa:
- atacar no maximo 1 capability principal;
- manter diff minimo;
- nao editar docs derivados sem mudanca funcional real;
- nao usar `docs/archive/**` como autoridade;
- se algo nao for encontrado, registrar: `nao encontrado - locais inspecionados: ...`;
- se um comando for inferido, registrar: `inferido - confirmar antes de usar`.

Depois de tocar area critica:

```powershell
powershell -File scripts/codex/validate.ps1 -TouchedPaths "<path1>","<path2>"
```

Areas criticas:
- `src/lib/offline/**`
- `src/lib/sanitario/**`
- `src/lib/reproduction/**`
- `src/lib/animals/**`
- `src/lib/events/**`
- `src/pages/Registrar/**`
- `src/pages/Agenda/**`
- `src/pages/ProtocolosSanitarios/**`
- `supabase/functions/sync-batch/**`
- `supabase/migrations/**`

## 9) Comandos de validacao reais

Do `package.json`:

```bash
pnpm run lint
pnpm test
pnpm run build
pnpm run test:unit
pnpm run test:integration
pnpm run test:hotspots
pnpm run test:smoke
pnpm run quality:gate
pnpm run test:e2e
pnpm run gates
pnpm run audit:data
```

Scripts Codex reais:

```powershell
powershell -File scripts/codex/bootstrap.ps1
powershell -File scripts/codex/preflight.ps1 -Paths "<path1>","<path2>"
powershell -File scripts/codex/validate.ps1 -TouchedPaths "<path1>","<path2>"
powershell -File scripts/codex/prepare-pr.ps1
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Nao ha script `typecheck` em `package.json` na ultima inspecao.

## 10) Formato padrao de resposta

Responder por padrao:
1. resumo executivo;
2. arquivos criados/alterados;
3. conteudo principal adicionado;
4. baseline Supabase impactada ou confirmada;
5. comandos de validacao executados;
6. confirmacao de escopo;
7. riscos ou pendencias, no maximo 3.

Para tarefas de codigo, incluir ate 5 arquivos principais afetados e testes/comandos realmente necessarios.

## 11) Checklist antes de finalizar

- Li `README.md`, `docs/CURRENT_STATE.md`, `docs/PROCESS.md` e `docs/AGENT_CONTEXT.md`.
- Verifiquei contexto local/skill quando a area exigiu.
- Confirmei que o diff toca apenas o escopo permitido.
- Nao usei `docs/archive/**` como fonte normativa.
- Nao alterei migrations/seed/RLS sem pedido explicito.
- Rodei validacoes aplicaveis ou declarei motivo para nao rodar.
- Executei `git diff --name-only` e `git diff --stat`.
- Listei incertezas com locais inspecionados.
