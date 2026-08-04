# RTK — Execução de comandos no RebanhoSync

Use estas diretrizes sempre que a tarefa envolver comandos, testes, Graphify, pnpm, WSL/Windows ou validação local.

---

## Princípios

* Preferir comandos reproduzíveis, mínimos e proporcionais ao risco.
* Usar `rtk` para comandos do projeto quando disponível.
* Confirmar scripts em `package.json` ou no caminho citado; não inventar comandos.
* Não declarar sucesso sem saída confirmatória.
* Distinguir falha nova, warning preexistente e validação não executada.

Se `rtk` não estiver disponível ou não suportar o comando necessário, registrar a limitação e usar apenas a alternativa já prevista pelo repositório/ambiente.

---

## Estado inicial do repositório

Antes de alterar ou validar:

```bash
git status --short --untracked-files=all
```

Inspecionar separadamente alterações unstaged e staged:

```bash
git diff --name-only
git diff --stat
git diff --cached --name-only
git diff --cached --stat
```

`git diff` comum não mostra arquivos untracked nem substitui a inspeção do conteúdo desses arquivos.

Para revisão textual do patch:

```bash
git diff
git diff --cached
git diff --check
```

---

## pnpm e Corepack

Confirmar o contrato do projeto antes de assumir versão ou script:

```bash
node -p "require('./package.json').packageManager || 'sem packageManager'"
pnpm --version
corepack --version
```

Se `package.json` não definir `packageManager`, não assumir versão única do pnpm.

Com `rtk` disponível:

```bash
rtk pnpm test
rtk pnpm run lint
rtk pnpm run build
```

Teste específico:

```bash
rtk pnpm test -- caminho/do/teste.test.ts
```

Vitest por nome:

```bash
rtk pnpm test -- -t "nome do teste"
```

---

## Validação proporcional

### Documentação, prompt ou skill sem alteração funcional

```bash
git status --short --untracked-files=all
git diff --check
```

Adicionar validador específico existente quando houver. Não executar lint, testes ou build de produto sem justificativa funcional.

### Patch local

```bash
rtk pnpm test -- caminho/do/teste.test.ts
```

### UI / componente

```bash
rtk pnpm test -- caminho/do/componente.test.tsx
rtk pnpm run lint
```

### Domínio crítico

```bash
rtk pnpm test -- caminho/do/dominio
rtk pnpm run lint
rtk pnpm run build
```

### Entrega ampla

```bash
rtk pnpm run lint
rtk pnpm test
rtk pnpm run build
```

### Supabase / RLS / RPC / migration / sync-batch

Quando o script existir e o escopo tocar esses contratos:

```bash
rtk node scripts/codex/validate-supabase-baseline-functional.mjs
```

---

## Scripts Codex

Confirmar a existência antes de executar:

```powershell
powershell -File scripts/codex/preflight.ps1 -Paths "<path1>","<path2>"
powershell -File scripts/codex/validate.ps1 -TouchedPaths "<path1>","<path2>"
```

Executar no ambiente previsto pelo repositório. Não adaptar ou inventar parâmetros sem ler o script ou sua documentação.

---

## Graphify

Usar somente nos casos definidos em `.agents/rules/GRAPHIFY_USAGE.md`.

Se `rtk`, Graphify e o contrato correspondente estiverem disponíveis:

```bash
rtk graphify query "<pergunta>"
rtk graphify path "<arquivo-ou-conceito-A>" "<arquivo-ou-conceito-B>"
rtk graphify explain "<conceito>"
```

Atualizar o grafo apenas após mudança estrutural relevante:

```bash
rtk graphify update .
```

Graphify não é obrigatório para copy, patch visual pequeno, teste isolado ou arquivo-alvo já conhecido.

---

## Relato de validação

```txt
Validações executadas:
- comando: [comando exato]
- resultado: [passou/falhou + resumo objetivo]
- observação: [warning ou limitação relevante]

Validações não executadas:
- comando: [comando esperado]
- motivo: [razão objetiva]
```

---

## Segurança

* Não executar comando destrutivo sem escopo explícito e alvo confirmado.
* Não alterar migration, seed, RLS, RPC ou teste fora do escopo.
* Não usar `--force`, `reset`, `clean` ou `rebase` sem autorização explícita.
* Não mascarar falhas nem alterar teste apenas para fazê-lo passar.
* Não tratar warning antigo como erro novo sem evidência.
* Não afirmar que arquivos untracked foram revisados apenas porque `git diff` está limpo.
