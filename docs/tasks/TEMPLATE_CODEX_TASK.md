# Template Codex Task

Use este template para transformar prompts longos em tarefas curtas, revisaveis e alinhadas ao RebanhoSync.

## Contexto obrigatorio

Siga:
- `AGENTS.md`
- `docs/AGENT_CONTEXT.md`
- `docs/CURRENT_STATE.md`
- `docs/PROCESS.md`

Se houver contexto local, leia o `AGENTS.md` mais proximo da area afetada.

Capability ou trilho `infra.*`:
- `<capability_id ou infra.*>`

## Objetivo

Descreva o resultado esperado em 1 a 3 frases:

```text
<objetivo da tarefa>
```

## Escopo permitido

- `<area 1>`
- `<area 2>`
- `<area 3>`

## Escopo proibido

- `<area proibida 1>`
- `<area proibida 2>`
- migrations, salvo se explicitamente permitido;
- seed, salvo se explicitamente permitido;
- RLS/policies/RPCs, salvo se explicitamente permitido;
- refatoracao ampla sem pedido explicito;
- arquivos gerados.

## Arquivos provaveis

- `<path provavel 1>`
- `<path provavel 2>`
- `<path provavel 3>`

Se um arquivo nao existir, registrar:

```text
nao encontrado - locais inspecionados: ...
```

## Inspecao obrigatoria

Antes de editar:
- ler `README.md`, `docs/CURRENT_STATE.md`, `docs/PROCESS.md`, `docs/AGENT_CONTEXT.md`;
- checar `package.json` para scripts reais;
- checar contexto local (`AGENTS.md`) se tocar hotspot;
- rodar busca limitada com `rg`;
- verificar `git status --short`;
- se tocar path restrito/gerado, rodar:

```powershell
powershell -File scripts/codex/preflight.ps1 -Paths "<path1>","<path2>"
```

## Criterios de aceite

- O escopo permitido foi respeitado.
- O escopo proibido nao foi alterado.
- O comportamento esperado foi implementado ou a auditoria foi concluida.
- Invariantes arquiteturais foram preservadas.
- Riscos e incertezas foram declarados.
- Validacoes aplicaveis foram executadas ou justificadas.
- `git diff --name-only` e `git diff --stat` foram revisados antes da resposta.

## Comandos de validacao

Use apenas comandos existentes no repo.

Padrao para codigo:

```bash
pnpm run lint
pnpm test
pnpm run build
```

Produto/fluxos criticos, quando aplicavel:

```bash
pnpm run quality:gate
```

Docs-only, quando aplicavel:

```bash
pnpm run lint
pnpm run build
```

Area critica:

```powershell
powershell -File scripts/codex/validate.ps1 -TouchedPaths "<path1>","<path2>"
```

Baseline Supabase:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Se nao executar algo:

```text
nao executado - motivo: ...
```

## Formato de resposta

Responder:
1. Resumo executivo.
2. Arquivos criados/alterados.
3. Conteudo principal adicionado ou fluxo real encontrado.
4. Baseline Supabase impactada ou confirmada.
5. Comandos de validacao executados.
6. Confirmacao de escopo.
7. Riscos ou pendencias.

Para auditoria, incluir:
- fluxo real;
- riscos;
- arquivos afetados;
- testes recomendados.

## Checklist final

- Li os docs obrigatorios.
- Usei skill/contexto local quando necessario.
- Nao alterei migrations sem permissao.
- Nao alterei seed sem permissao.
- Nao alterei RLS sem auditoria especifica.
- Nao usei UI como fronteira unica de autorizacao.
- Preservei separacao dominio/infra/apresentacao.
- Rodei validacoes aplicaveis ou expliquei por que nao.
- Revisei `git diff --name-only`.
- Revisei `git diff --stat`.

## Exemplo de prompt curto

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
