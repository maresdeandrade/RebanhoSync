# Testing Gates — RebanhoSync

Atualizado em: 2026-11-21

## Evidência focal J04/Bloco 1 e preparação de integração

O [registro da integração](../review/evidence/BLOCK1_INTEGRATION_20261121.json) identifica baseline, hashes reutilizados, comandos e limites. O pacote inclui testes Vitest de Equipe/Convite/Perfil/notificações/onboarding/financeiro e escritores de metadata; testes PostgreSQL locais de destinatário, papéis, isolamento e flags; concorrência real; e Chromium focal com nova sessão e falhas de gravação.

Os scripts `tests/codex/block1-security.local.test.mjs` e `member-invites.local.test.mjs` usam fixtures transacionais com rollback na base local. `block1-concurrency.local.test.mjs` e `block1-browser.local.test.mjs` exigem a stack local descartável própria, configurada em `.work/block1/disposable`, API 54421/DB 54422; não apontar para a base das jornadas. Essa configuração local e cópias de migrations não integram o pacote Git. Antes de executar, provisione/inspecione uma stack descartável equivalente com migrations ativas e confirme os destinos; os scripts recusam portas inesperadas.

Os cinco harnesses usam `node:test` e estão explicitamente fora da descoberta do Vitest. O CI executa os dois transacionais e `member-invites-concurrency.local.test.mjs` com `node --test --test-concurrency=1`, exclusivamente na stack descartável preparada pelo job quando Supabase é necessário. Os dois harnesses com portas 54421/54422 permanecem opt-in local; sua evidência anterior não é uma execução remota do CI. Não remover as asserções nem importar esses arquivos no Vitest para contornar erro de executor.

O baseline funcional persiste fatos e só pode executar em backend descartável explicitamente identificado, com os parâmetros já exigidos pelo script. Nenhum desses testes autoriza reset/reaplicação do banco persistente ou escrita remota. Suíte global/build/E2E integral não são encerramento automático; repetir evidência afetada por conteúdo/baseline/ambiente alterado, mantendo as regras abaixo.

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

## Mudança em fluxo documentado

Mudança em fluxo operacional exige teste proporcional à invariante alterada. A seção **Testes como contrato** do [Mapa Oficial de Fluxos e Contratos](../architecture/OPERATIONAL_FLOWS.md#26-testes-como-contrato) é a referência canônica.

O gate deve relacionar explicitamente:

```txt
fluxo afetado
→ invariante
→ teste existente ou novo
→ resultado
```

Contagem agregada de testes, isoladamente, não comprova cobertura do fluxo.

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

## Patch exclusivamente documental

Executar:

```bash
git status --short --untracked-files=all
git diff --name-only
git diff --check
git diff --stat
```

Se existirem no `package.json`, executar também `lint:docs`, `docs:check` e `markdownlint`. Não criar script apenas para a validação.

Validar manualmente links relativos, títulos/âncoras, consistência do próximo incremento e ausência de alteração em código/schema.

Para mudanças documentais de estado, confirmar baseline, PR/merge, validações realmente executadas e distinção entre código versionado e deploy efetivo. Gate remoto, feature flag e rollout não podem ser inferidos a partir da presença de arquivos no repositório.

## Cleanup do Supabase local no CI

`supabase/config.toml` e `supabase/.gitignore` são arquivos rastreados. O cleanup descartável pode remover somente artefatos temporários e deve restaurar exclusivamente esses dois arquivos ao conteúdo do `HEAD` antes do gate de limpeza:

```bash
git restore --source=HEAD --worktree -- supabase/config.toml supabase/.gitignore
```

Não usar `git reset --hard`, `git restore .` ou cleanup amplo. O gate `Repository must remain clean` deve continuar detectando qualquer outra modificação inesperada.

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
powershell -File scripts/codex/validate.ps1 -Profile focused -TouchedPaths "<path1>","<path2>" -TestPaths "<teste-focado>"

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
