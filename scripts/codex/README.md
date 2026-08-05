# scripts/codex

Scripts operacionais pequenos para agentes atuarem no RebanhoSync com contexto mínimo, escopo explícito e validação proporcional.

Eles complementam `AGENTS.md` e `.agents/rules/*`; não substituem contratos de domínio, migrations ou documentação ativa.

## Regras de uso

- Execute a partir da raiz do repositório.
- Para comandos, pnpm, Supabase, Graphify e validações, siga `.agents/rules/rtk.md`.
- Não execute `--apply`, reset, E2E remoto ou cleanup destrutivo sem alvo confirmado e autorização compatível.
- Não trate saída planejada como validação executada.
- Não versione credenciais, tokens, senhas ou fixtures temporárias.
- Agenda é intenção; Evento é fato; Protocolo é regra; `state_*` é estado atual/read model.

## Índice

| Script | Responsabilidade |
|---|---|
| `bootstrap.ps1` | Confirma o checkout e o bootstrap mínimo de `AGENTS.md`/rules. |
| `preflight.ps1` | Normaliza paths e bloqueia archive, artefatos gerados, `*.tsbuildinfo` e caminhos externos ao repositório. |
| `validate.ps1` | Executa o gate local previsto pelo repositório conforme os paths afetados. |
| `prepare-pr.ps1` | Gera corpo de PR somente com verification gate `READY` e evidências informadas. |
| `validate-supabase-baseline-functional.mjs` | Valida baseline Supabase, RLS, FKs, agenda sanitária e `sync-batch`. |
| `import-sanitario-protocols-v2.mjs` | Valida, planeja e aplica de forma controlada o payload canônico 12F10. |
| `validate-dry-cow-therapy-functional.mjs` | Valida o fluxo funcional de Terapia de Vaca Seca no Supabase local. |
| `prepare-dry-cow-ui-smoke.mjs` | Cria fixture local persistente para o smoke UI de Vaca Seca. |
| `run-dry-cow-ui-smoke-cdp.mjs` | Executa o smoke no app real e salva screenshot em `tmp/`. |

Os validadores `validate-sanitario-*-12f*.mjs` preservam gates históricos ainda ativos. Não os use como fonte normativa superior ao código, migrations e documentação vigente.

## Fluxo mínimo

1. Confirme o bootstrap:

   ```powershell
   powershell -File scripts/codex/bootstrap.ps1
   ```

2. Delimite os arquivos e rode o preflight:

   ```powershell
   powershell -File scripts/codex/preflight.ps1 -Paths "src/lib/sanitario","scripts/codex"
   ```

3. Implemente o menor patch seguro.
4. Execute validação proporcional conforme `.agents/rules/rtk.md`.
5. Revise alterações unstaged, staged e untracked:

   ```bash
   git status --short --untracked-files=all
   git diff --name-only
   git diff --stat
   git diff --cached --name-only
   git diff --cached --stat
   git diff --check
   ```

6. Use `prepare-pr.ps1` apenas após o verification gate classificar a entrega como `READY`.

## Bootstrap

`bootstrap.ps1` exige:

- `AGENTS.md`;
- `.agents/rules/CORE_RULES.md`;
- `.agents/rules/CONTEXT_LOADING.md`;
- `.agents/rules/no-broad-context.md`;
- `.agents/rules/rtk.md`.

Os demais documentos são referências sob demanda. O script não instrui leitura ampla do repositório.

## Preflight de paths

O preflight bloqueia:

- `docs/archive/**`;
- diretórios `dist` e `coverage`;
- `.git`, `.supabase`, `node_modules`, `graphify-out` e `tmp`;
- arquivos `*.tsbuildinfo`;
- paths que escapem da raiz por caminho absoluto ou `..`.
- a própria raiz (`.`), por ser escopo amplo demais.

Os paths não precisam existir, mas devem resolver dentro do repositório.

## Importador de Protocolos Sanitários v2

Fonte exclusiva:

`docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json`

### Validação sem banco

```bash
rtk node scripts/codex/import-sanitario-protocols-v2.mjs --validate
```

### Plano somente leitura

```bash
rtk node scripts/codex/import-sanitario-protocols-v2.mjs --dry-run
```

### Apply local controlado

```powershell
$env:ALLOW_SANITARIO_IMPORT="1"
$env:SANITARIO_IMPORT_CONFIRM="12F10.0-canonical-candidate"
rtk node scripts/codex/import-sanitario-protocols-v2.mjs --apply
```

O `--apply`:

- usa transação, lock exclusivo e timeouts;
- bloqueia atualização de protocolos aprovados, grupos já curados/operacionais e itens não-draft;
- mantém `agenda_allowed=false`, `approved_for_catalog=false` e `allows_agenda_auto=false`;
- rejeita members sem `class_id` real;
- confirma idempotência antes do commit.

Banco remoto exige adicionalmente `ALLOW_SANITARIO_REMOTE_IMPORT=1`, dry-run prévio e autorização explícita. A flag não substitui aprovação operacional.

## Smoke UI de Vaca Seca

Pré-requisitos: Supabase local ativo, app configurado e senha explícita. O preparador não usa senha default.

```powershell
$env:UI_SMOKE_EMAIL="dry-cow-ui@functional.local"
$env:UI_SMOKE_PASSWORD="<senha-local-com-12-ou-mais-caracteres>"
rtk node scripts/codex/prepare-dry-cow-ui-smoke.mjs
```

Se o e-mail já existir, o script bloqueia reutilização. Para reutilizar conscientemente um usuário local:

```powershell
$env:UI_SMOKE_REUSE_USER="1"
```

Copie `fazendaId` e `farmName` da saída:

```powershell
$env:UI_SMOKE_FARM_ID="<fazendaId>"
$env:UI_SMOKE_FARM_NAME="<farmName>"
$env:APP_URL="http://127.0.0.1:8080"
rtk node scripts/codex/run-dry-cow-ui-smoke-cdp.mjs
```

A fixture persiste no banco local para permitir o smoke. Remova-a de forma controlada ou execute o reset local previsto após concluir.

## Certificação temporária do staging sanitário v2

`.tmp-certify-sanitario-v2-staging.mjs` é um executor temporário para fixture remota descartável. Não deve ser promovido ou versionado enquanto mantiver esse papel.

Variáveis obrigatórias:

- `CERT_USER_EMAIL`;
- `CERT_USER_PASSWORD`;
- `VITE_SUPABASE_URL`;
- `VITE_SUPABASE_ANON_KEY`.

Variáveis opcionais:

- `CERT_PROJECT_REF` para o projeto explicitamente autorizado;
- `CERT_RUN_ID` e `CERT_CLIENT_ID` para rastreabilidade;
- `CERT_FIXTURE_IDS_JSON` para substituir os IDs não secretos da fixture.

O executor:

- recusa projeto diferente do `CERT_PROJECT_REF`;
- exige fixture sem Eventos, Agendas ou movimentos prévios;
- valida replay, sucesso parcial, conflito, fato append-only, estoque e carência;
- não apaga Eventos no final;
- emite `CERTIFICATION_EVIDENCE` e `DISPOSAL_MARKER` para descarte/reset externo controlado.

Não use a mesma fixture novamente sem reset; o teste altera saldo e persiste fatos append-only.

## Preparação de PR

Exemplo:

```powershell
& .\scripts\codex\prepare-pr.ps1 `
  -Title "fix(sanitario): preserva idempotencia no retry" `
  -Capability "Sanitario v2" `
  -Summary "Corrige o retry sem duplicar Evento ou baixa de estoque." `
  -Files @("src/lib/sanitario/example.ts","src/lib/sanitario/example.test.ts") `
  -VerificationStatus READY `
  -Validations @("rtk pnpm test -- src/lib/sanitario/example.test.ts — passou")
```

Use `-Risks`, `-Docs`, `-NotExecuted` e `-OutputPath` quando aplicável. Um arquivo existente só é substituído com `-Force`. O script bloqueia `NOT_READY` e não inventa comandos executados.

## Validação proporcional

- Documentação/scripts sem efeito funcional: sintaxe específica + `git diff --check`.
- Patch local: teste focado.
- Domínio crítico: testes do domínio + lint + build.
- Supabase/RLS/RPC/sync: validador funcional pertinente.
- Entrega ampla: lint + suíte + build.

Se uma validação não for executada, registre o comando e o motivo; não a apresente como aprovada.
