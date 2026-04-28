# scripts/codex

Guia operacional para agentes de IA no RebanhoSync. Esta pasta concentra scripts pequenos que ajudam a iniciar, limitar, validar e preparar entregas sem criar prompts longos.

## Proposito

- Dar bootstrap de contexto minimo.
- Validar se paths proibidos nao serao editados.
- Rodar o gate padrao de validacao para areas criticas.
- Preparar resumo de PR.
- Validar funcionalmente a baseline Supabase atual.

Nao criar scripts novos sem tarefa explicita.

## Scripts existentes

```powershell
powershell -File scripts/codex/bootstrap.ps1
powershell -File scripts/codex/preflight.ps1 -Paths "<path1>","<path2>"
powershell -File scripts/codex/validate.ps1 -TouchedPaths "<path1>","<path2>"
powershell -File scripts/codex/prepare-pr.ps1
```

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Resumo:
- `bootstrap.ps1`: confirma docs obrigatorios e lista invariantes/comandos basicos.
- `preflight.ps1`: bloqueia paths como `docs/archive/**`, `dist/**`, `coverage/**` e `*.tsbuildinfo`.
- `validate.ps1`: roda `pnpm run lint`, `pnpm test` e `pnpm run build`; tambem imprime lembretes se path critico foi tocado.
- `prepare-pr.ps1`: imprime estrutura de titulo, contexto, arquivos, riscos, docs e validacao.
- `validate-supabase-baseline-functional.mjs`: valida baseline Supabase funcional com banco local, RLS, FK composta, agenda sanitaria e `sync-batch`.

## Baseline Supabase documentada

Estado real inspecionado:
- baseline canonica ativa: `supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql`;
- migrations antigas preservadas em `supabase/migrations_legacy_pre_baseline/`;
- pasta ativa de migrations sem shims pos-squash;
- seed tecnico/minimo/idempotente: `supabase/seed.sql`;
- seed sanitario nao e fonte normativa oficial.

Validador:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Observacao: o validador pode usar `supabase functions serve --no-verify-jwt` como fallback local para CLI/runtime antiga. O handler ainda executa `auth.getUser(jwt)` e operacoes user-scoped com RLS.

## Fluxo recomendado

1. Ler `AGENTS.md`.
2. Ler `docs/AGENT_CONTEXT.md`.
3. Usar `docs/tasks/TEMPLATE_CODEX_TASK.md` para estruturar a tarefa.
4. Rodar bootstrap se precisar confirmar contexto:

```powershell
powershell -File scripts/codex/bootstrap.ps1
```

5. Delimitar escopo permitido/proibido.
6. Rodar `preflight.ps1` antes de path restrito/gerado.
7. Implementar patch minimo.
8. Validar com comandos reais.
9. Revisar:

```bash
git diff --name-only
git diff --stat
```

## Prompts curtos

Antes, prompt longo:

```text
Voce precisa entender todo o RebanhoSync, ler os documentos, descobrir estado atual,
verificar Supabase, descobrir comandos, respeitar arquitetura, auditar convites,
nao mexer em migrations, nao mexer em seed, entregar riscos e testes...
```

Depois, prompt curto:

```text
Siga AGENTS.md e docs/AGENT_CONTEXT.md.
Use docs/tasks/TEMPLATE_CODEX_TASK.md.

Tarefa:
Auditar fluxo de convites de usuarios.

Escopo permitido:
- auth
- access control
- invitations

Escopo proibido:
- migrations
- seed
- sanitario

Entregue:
- fluxo real
- riscos
- arquivos afetados
- testes recomendados
```

## Comandos uteis

Scripts reais do `package.json`:

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

Nao encontrado em `package.json`:
- `typecheck`.

## Como validar escopo

Antes de editar:

```bash
git status --short
rg "termo|funcao|capability" <paths-limitados>
```

Antes de finalizar:

```bash
git diff --name-only
git diff --stat
```

Confirmar explicitamente quando aplicavel:
- nao alterei codigo de produto;
- nao alterei migrations;
- nao alterei seed;
- nao alterei RLS/policies/RPCs;
- nao alterei dependencias ou configs de build/lint/test.

## Como revisar diffs

Verificar:
- arquivos alterados pertencem ao escopo permitido;
- diffs sao pequenos e revisaveis;
- nenhum arquivo gerado entrou no patch;
- docs derivados so mudaram com delta funcional real;
- comandos documentados existem no repo;
- qualquer comando inferido foi marcado como `inferido - confirmar antes de usar`.

## Como lidar com validadores

Para docs-only:
- `pnpm run lint` e `pnpm run build` costumam ser suficientes quando o tempo permitir.
- `validate.ps1` e mais amplo porque tambem roda `pnpm test`; use quando a tarefa tocar area critica ou quando a entrega exigir gate completo.

Para codigo de produto:

```powershell
powershell -File scripts/codex/validate.ps1 -TouchedPaths "<path1>","<path2>"
```

Para Supabase baseline:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Se nao rodar um comando, registrar:

```text
nao executado - motivo: ...
```

## Regras arquiteturais para agentes

- Nao colocar regra de negocio em componente React.
- Nao usar UI como fronteira unica de autorizacao.
- Preservar separacao entre dominio, infraestrutura e apresentacao.
- Nao alterar migrations sem tarefa explicita.
- Nao alterar seed sem tarefa explicita.
- Nao modificar RLS sem auditoria especifica.
- Nao expor `service_role` no client.
- Manter compatibilidade com dados legados.
- Preferir mudancas pequenas, reversiveis e testaveis.
