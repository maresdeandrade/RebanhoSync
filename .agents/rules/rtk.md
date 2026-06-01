```markdown
# RTK — Execução de comandos no RebanhoSync

Use este arquivo quando a tarefa envolver comandos locais, validação, testes, Graphify, pnpm ou ambiente WSL/Windows.

---

## Princípio

Preferir comandos reproduzíveis, mínimos e proporcionais ao escopo.  
Não inventar script. Conferir `package.json` quando houver dúvida.

---

## Uso de `rtk`

Quando disponível, usar `rtk` para executar comandos do projeto em ambiente controlado.

### Exemplos:
```bash
rtk pnpm test
rtk pnpm run lint
rtk pnpm run build

```

### Para teste específico:

```bash
rtk pnpm test -- caminho/do/teste.test.ts

```

### Para Vitest por nome:

```bash
rtk pnpm test -- -t "nome do teste"

```

---

## Corepack / pnpm

Se aparecer aviso de Corepack baixando versão diferente de `pnpm`, verificar antes:

```bash
node -p "require('./package.json').packageManager || 'sem packageManager'"
pnpm --version
corepack --version

```

> ⚠️ **Aviso:** Se o `package.json` não define `packageManager`, não assumir versão única de pnpm.

---

## Validação Proporcional

### Patch local

```bash
rtk pnpm test -- caminho/do/teste.test.ts

```

### UI / Componente

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

### Supabase / RLS / sync-batch

```bash
rtk node scripts/codex/validate-supabase-baseline-functional.mjs

```

*Nota: Usar somente se a tarefa tocar Supabase, RLS, RPC, migration, sync-batch ou baseline.*

---

## Scripts Codex

Se disponíveis no ambiente de execução:

```powershell
powershell -File scripts/codex/preflight.ps1 -Paths "<path1>","<path2>"
powershell -File scripts/codex/validate.ps1 -TouchedPaths "<path1>","<path2>"

```

> ⚠️ **Restrição:** Não usar se o script correspondente não existir.

---

## Graphify

Se `graphify-out/` existir e a tarefa for transversal:

```bash
graphify query "<pergunta>"
graphify path "<arquivo-ou-conceito-A>" "<arquivo-ou-conceito-B>"
graphify explain "<conceito>"

```

Após mudança estrutural relevante, atualize o grafo:

```bash
graphify update .

```

### Não obrigatório para:

* Alterações de *copy* ou texto;
* Ajuste visual pequeno;
* Teste unitário isolado;
* Patch em arquivo com escopo já conhecido.

---

## Antes de Validar

Verificar o estado atual do repositório local:

```bash
git status --short --untracked-files=all

```

Para analisar as modificações e o diff:

```bash
git diff --name-only
git diff --stat

```

*Nota: Arquivos novos não aparecem em `git diff` comum se estiverem untracked. Use sempre o `git status`.*

---

## Relato de Validação

Registrar e estruturar os resultados sempre sob o seguinte formato:

```txt
Validações executadas:
- comando:
- resultado:
- observação:

Validações não executadas:
- comando:
- motivo:

```

---

## Regras de Segurança

* Não rodar nenhum comando destrutivo sem tarefa explicitamente definida.
* Não alterar migrations, seed, RLS, RPC ou testes fora do escopo delimitado.
* Não forçar a execução usando `--force`, `reset`, `clean` ou `rebase` sem pedido explícito.
* Não mascarar ou ignorar falhas de testes.
* Não tratar *warning* legado/antigo como erro novo sem evidência técnica direta.

```

```