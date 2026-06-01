```md
# Testing Gates — RebanhoSync

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Objetivo

Padronizar validações técnicas proporcionais ao risco da mudança.

---

## Regra central

Não rodar tudo sempre.  
Rodar validação proporcional ao escopo.

Sempre registrar:

- comando executado;
- resultado;
- comando não executado;
- motivo.

---

## Antes de validar

Verificar estado do repositório:

```bash
git status --short --untracked-files=all

```

Verificar diff rastreado:

```bash
git diff --name-only
git diff --stat

```

> ⚠️ **Atenção:** arquivos novos não aparecem em git diff comum se estiverem untracked.

---

## Patch local

Quando alteração é pequena e isolada:

```bash
rtk pnpm test -- caminho/do/teste.test.ts

```

> ⚠️ Se não houver teste específico, justificar.

---

## UI/componente

```bash
rtk pnpm test -- caminho/do/componente.test.tsx
rtk pnpm run lint

```

Se alteração visual for ampla:

```bash
rtk pnpm run build

```

---

## Domínio crítico

Use para sanitário, reprodução, animais, eventos, compra/venda, lote/pasto ou movimentação:

```bash
rtk pnpm test -- caminho/do/dominio
rtk pnpm run lint
rtk pnpm run build

```

---

## Sync/offline

Quando tocar Dexie, gestures, fila, rollback, retry, reconcile ou sync:

```bash
rtk pnpm run lint
rtk pnpm test
rtk pnpm run build

```

Se tocar sync-batch ou contrato remoto:

```bash
rtk node scripts/codex/validate-supabase-baseline-functional.mjs

```

---

## Supabase/RLS/migrations/RPC

Obrigatório validar baseline funcional quando tocar:

* migrations;
* RLS;
* policies;
* RPCs;
* functions;
* triggers;
* sync-batch;
* FK composta;
* isolamento por fazenda.

```bash
rtk node scripts/codex/validate-supabase-baseline-functional.mjs

```

Também rodar:

```bash
rtk pnpm run lint
rtk pnpm test
rtk pnpm run build

```

---

## Entrega ampla

```bash
rtk pnpm run lint
rtk pnpm test
rtk pnpm run build

```

---

## Scripts Codex

Se disponíveis:

```powershell
powershell -File scripts/codex/preflight.ps1 -Paths "<path1>","<path2>"
powershell -File scripts/codex/validate.ps1 -TouchedPaths "<path1>","<path2>"

```

> ⚠️ Não usar se o script não existir.

---

## Corepack/pnpm

Se aparecer aviso de Corepack baixando versão diferente de pnpm:

```bash
node -p "require('./package.json').packageManager || 'sem packageManager'"
pnpm --version
corepack --version

```

> ⚠️ Se package.json não define packageManager, não assumir versão única de pnpm.

---

## Não fazer

* Não mascarar falha de teste.
* Não tratar warning antigo como erro novo sem evidência.
* Não dizer “tudo passou” sem saída real.
* Não ignorar arquivo untracked.
* Não usar `--force`, reset, clean ou rebase sem pedido explícito.
* Não inventar script.

---

## Formato de relato

### Validações executadas

* **comando:**
* **resultado:**
* **observação:**

### Validações não executadas

* **comando:**
* **motivo:**

```

```