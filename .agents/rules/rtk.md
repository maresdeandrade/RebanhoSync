# RTK — Execução e Validação no RebanhoSync

## Princípio

`rtk` é um wrapper opcional.

Quando estiver disponível e suportar o comando:

```bash
rtk <comando>
```

Quando não estiver disponível, executar diretamente o comando nativo previsto pelo projeto:

```bash
pnpm ...
node ...
graphify ...
git ...
```

**A ausência de `rtk` não bloqueia comandos disponíveis diretamente no ambiente.**

Nunca inventar comandos ou declarar sucesso sem saída confirmatória.

---

## Estado inicial

Antes de alterar código:

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --cached --name-only
```

Quando necessário:

```bash
git diff
git diff --cached
git diff --check
```

`git diff` não inclui arquivos untracked.

---

## pnpm

Confirmar primeiro:

```bash
node -p "require('./package.json').packageManager || 'sem packageManager'"
pnpm --version
corepack --version
```

### Com `rtk`

```bash
rtk pnpm test
rtk pnpm run lint
rtk pnpm run build
```

### Sem `rtk`

```bash
pnpm test
pnpm run lint
pnpm run build
```

Teste específico:

```bash
pnpm test -- caminho/do/teste.test.ts
```

Teste por nome:

```bash
pnpm test -- -t "nome do teste"
```

Usar o mesmo fallback direto quando `rtk` não estiver disponível.

---

## Validação proporcional

### Documentação / prompt / skill

```bash
git status --short --untracked-files=all
git diff --check
```

### Patch localizado

```bash
pnpm test -- caminho/do/teste.test.ts
```

### UI / componente

```bash
pnpm test -- caminho/do/componente.test.tsx
pnpm run lint
```

### Domínio crítico

```bash
pnpm test -- caminho/do/dominio
pnpm run lint
pnpm run build
```

### Entrega ampla

```bash
pnpm run lint
pnpm test
pnpm run build
```

Executar apenas validações proporcionais ao risco e ao escopo.

---

## Supabase / RLS / RPC / sync

Somente quando o arquivo existir e o escopo tocar esses contratos:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Não inventar scripts.

---

## Scripts Codex

Confirmar existência e parâmetros antes da execução.

Exemplos previstos:

```powershell
powershell -File scripts/codex/preflight.ps1 -Paths "<path1>","<path2>"
```

```powershell
powershell -File scripts/codex/validate.ps1 -Profile focused -TouchedPaths "<path1>","<path2>" -TestPaths "<teste>"
```

Não adaptar parâmetros sem ler o script ou documentação correspondente.

---

## Graphify

Seguir:

```text
.agents/rules/GRAPHIFY_USAGE.md
```

### Com `rtk`

Se `rtk` estiver disponível e suportar Graphify:

```bash
rtk graphify query "<pergunta>"
rtk graphify explain "<conceito>"
rtk graphify path "<A>" "<B>"
rtk graphify update .
```

### Sem `rtk`

```bash
graphify query "<pergunta>"
graphify explain "<conceito>"
graphify path "<A>" "<B>"
graphify update .
```

A ausência de `rtk` não significa indisponibilidade do Graphify.

---

## Relato de validação

Usar:

```text
Validações executadas:
- comando: <comando>
- resultado: passou/falhou
- observação: <warning ou limitação relevante>

Validações não executadas:
- comando: <comando esperado>
- motivo: <razão objetiva>
```

Separar:

* falha nova;
* warning preexistente;
* validação não executada.

---

## Segurança

* Não executar comandos destrutivos sem autorização.
* Não usar `--force`, `reset`, `clean` ou `rebase` sem autorização explícita.
* Não alterar migration, seed, RLS, RPC ou testes fora do escopo.
* Não modificar testes apenas para fazê-los passar.
* Não considerar arquivos untracked revisados apenas porque `git diff` está limpo.
* Não mascarar falhas.
