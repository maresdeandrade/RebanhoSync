# scripts/codex

Scripts operacionais do RebanhoSync. O catálogo geral e a classificação de lifecycle ficam em `scripts/README.md`.

## Bootstrap e preflight

```powershell
powershell -File scripts/codex/bootstrap.ps1
powershell -File scripts/codex/preflight.ps1 -Paths "<path1>","<path2>"
```

O bootstrap exige `AGENTS.md`, rules obrigatórias e `.agents/skills/README.md`. O preflight não concede autorização; apenas rejeita paths amplos, externos, arquivados ou gerados.

## Validação proporcional

O chamador escolhe o perfil; o script não infere risco automaticamente.

```powershell
# Patch localizado
powershell -File scripts/codex/validate.ps1 -Profile focused `
  -TouchedPaths "src/area" `
  -TestPaths "src/area/example.test.ts"

# Mudança compartilhada
powershell -File scripts/codex/validate.ps1 -Profile standard `
  -TouchedPaths "src/area" `
  -TestPaths "src/area" `
  -LintPaths "src/area/example.ts" `
  -IncludeBuild

# Fechamento amplo explicitamente autorizado
powershell -File scripts/codex/validate.ps1 -Profile full -ConfirmFull
```

`focused` executa `git diff --check` e somente testes/lint informados. `standard` exige pelo menos uma validação explícita. `full` executa lint, suíte e build e exige `-ConfirmFull`.

## Baseline Supabase

`validate-supabase-baseline-functional.mjs` é autoritativo para RLS, FKs, fluxo sanitário básico e `sync-batch`. Ele persiste fatos e, por isso, bloqueia execução sem:

```powershell
$env:REBANHOSYNC_DISPOSABLE_LOCAL_DB="1"
rtk node scripts/codex/validate-supabase-baseline-functional.mjs
```

O script emite `FIXTURE_MARKER` com IDs criados. O descarte do ambiente ocorre externamente e somente sob autorização explícita; o script não executa limpeza destrutiva.

## Smoke UI de Vaca Seca

O preparador sempre cria identidade exclusiva e um manifesto de cleanup em `tmp/`:

```powershell
$env:UI_SMOKE_EMAIL="dry-cow-ui-<run>@functional.local"
$env:UI_SMOKE_PASSWORD="<senha-local-com-12-ou-mais-caracteres>"
rtk node scripts/codex/prepare-dry-cow-ui-smoke.mjs
```

Use o `manifestPath` retornado:

```powershell
$env:UI_SMOKE_FIXTURE_MANIFEST="tmp/dry-cow-ui-smoke-<run>.json"
$env:UI_SMOKE_PASSWORD="<mesma-senha>"
$env:APP_URL="http://127.0.0.1:8080"
rtk node scripts/codex/run-dry-cow-ui-smoke-cdp.mjs
```

O runner restaura a configuração, executa cleanup dirigido, confirma zero resíduos conhecidos e remove o screenshot. Para preservar a captura conscientemente, usar `UI_SMOKE_KEEP_SCREENSHOT=1`. Se o runner não iniciar, executar:

```bash
rtk node scripts/codex/prepare-dry-cow-ui-smoke.mjs --cleanup tmp/dry-cow-ui-smoke-<run>.json
```

## Importador sanitário 12F10

Ferramenta excepcional, não gate:

```bash
rtk node scripts/codex/import-sanitario-protocols-v2.mjs --validate
rtk node scripts/codex/import-sanitario-protocols-v2.mjs --dry-run
```

`--apply` mantém dupla confirmação e proteção adicional para alvo remoto. Uma flag nunca substitui autorização operacional da tarefa atual.

## Validadores históricos mantidos restritos

Não há equivalência integral comprovada para as coberturas abaixo; por isso nenhum arquivo foi removido.

| Script | Cobertura exclusiva preservada | Gate permanente equivalente | Classificação |
|---|---|---|---|
| `validate-sanitario-sync-v2-expand.mjs` | UUID/ACL/fail-closed; agenda e closure atômicas; concorrência; correção append-only; RLS cross-farm; baixa idempotente; ledger executor | Baseline cobre apenas parte de RLS/idempotência | `MANTER_RESTRITO` |
| `test-rpc-duplicidade.mjs` | Mesmo Evento canônico para replay da operação e retry por nova operação, com único detalhe | Sem equivalência integral comprovada | `MANTER_RESTRITO` |
| `validate-sanitario-adapter-payloads-12f5.mjs` | Integridade dos artefatos adapter 12F4/12F5, campos proibidos e import desabilitado | Sem equivalente permanente | `MANTER_RESTRITO` |
| `validate-sanitario-adapter-payloads-12f8.mjs` | Adaptação por ProductClassGroup, migration 12F7 e rejeições remanescentes | Sem equivalente permanente | `MANTER_RESTRITO` |
| `validate-sanitario-complete-payloads-12f9.mjs` | Completude e coerência dos JSON 12F9, incluindo `execute_import=false` | Importador 12F10 não comprova integralmente os artefatos 12F9 | `MANTER_RESTRITO` |

Esses scripts não fazem parte de bootstrap, `gates:docs`, `audit:agents` ou validação padrão.

## Preparação de PR

`prepare-pr.ps1` aceita somente verification gate `READY`. Output permanece no repositório por padrão; caminho externo e sobrescrita exigem confirmações independentes e inequívocas.
