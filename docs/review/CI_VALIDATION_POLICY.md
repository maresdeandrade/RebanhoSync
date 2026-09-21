# CI Validation Policy — RebanhoSync

Status: ACTIVE

## 1. Objetivo

Definir validação proporcional ao risco das alterações do RebanhoSync.

O objetivo é preservar:

- confiabilidade;
- offline-first;
- isolamento entre fazendas;
- RLS;
- idempotência;
- auditabilidade;
- compatibilidade local-remota;

sem executar infraestrutura e regressão completa quando a alteração não pode
materialmente afetar essas áreas.

A política se aplica às Pull Requests direcionadas para `main`.

---

## 2. Princípio

A validação deve ser proporcional ao impacto potencial da mudança.

Regra:

```text
alteração pequena
→ validação diretamente relacionada

alteração funcional
→ validação ampliada da aplicação

alteração de domínio, persistência, sync ou infraestrutura
→ validação completa com Supabase descartável

```

Não executar regressão completa apenas por rotina.

Não reduzir validação quando houver risco transversal real.

## 3. Níveis

### FAST

Aplicável a alterações exclusivamente documentais ou de governança textual.

Exemplos:

* `docs/**`
* `*.md`
* `AGENTS.md`

Validações mínimas:

* `pnpm install --frozen-lockfile`
* `pnpm run gates:docs`
* `git diff --check`
* `repository clean`

Não exige:

* Supabase local
* db reset
* fixtures
* vitest completo
* build

### APPLICATION

Aplicável a alterações executáveis sem evidência direta de impacto na persistência ou infraestrutura crítica.

Exemplos:

* `src/**`
* `tests/**`
* `public/**`
* `vite.config.*`
* `vitest.config.*`
* `tsconfig*.json`
* `eslint.config.*`
* `scripts/**`

Validações:

* lint
* fallow audit
* vitest
* build
* gates:docs
* git diff --check
* repository clean

Não exige Supabase descartável quando nenhuma área crítica foi alterada.

### FULL / SUPABASE

Aplicável quando a alteração pode afetar:

* sincronização;
* persistência local/remota;
* autenticação;
* RLS;
* banco;
* migrations;
* RPC;
* Edge Functions;
* contratos de domínio críticos;
* configuração transversal;
* ambiente de execução;
* dependências;
* infraestrutura de CI.

Áreas atualmente classificadas como críticas:

* `supabase/**`
* `src/lib/offline/**`
* `src/lib/auth/**`
* `src/hooks/useAuth.*`
* `src/lib/events/**`
* `src/lib/comercial/**`
* `src/lib/sanitario/**`
* `src/lib/reproduction/**`
* `src/lib/finance/**`
* `src/lib/supabase.ts`
* `src/lib/env.ts`
* `scripts/ci/**`
* `.github/workflows/**`
* `.env.example`
* `package.json`
* `pnpm-lock.yaml`

Validações:

* Supabase CLI
* Supabase descartável
* supabase db reset
* fixture de concorrência comercial
* lint
* fallow audit
* vitest completo
* build
* gates:docs
* git diff --check
* repository clean

## 4. Regras de escalonamento

A classificação é sempre conservadora.

O workflow registra duas classificações independentes:

* `PR_SCOPE`: risco total da PR contra a base (`DOCS`, `APP` ou `FULL`);
* `DELTA_SCOPE`: risco introduzido pelo último `synchronize`
  (`DOCS_ONLY`, `TEST_ONLY`, `APP`, `FULL` ou `UNKNOWN`).

`before` e `after` só são usados no evento `pull_request/synchronize`, depois
de validar que ambos existem como commits locais e que `after` corresponde ao
head atual da PR. Qualquer referência ausente ou inconsistente produz
`DELTA_SCOPE=UNKNOWN`.

`UNKNOWN` nunca reduz validação: executa o nível indicado por `PR_SCOPE`.
Um delta `TEST_ONLY` pode selecionar testes diretamente alterados e diretórios
de teste relacionados; se não houver alvo seguro, a suíte global é o fallback.

Se uma PR contém arquivos de níveis diferentes:

```text
FAST + APPLICATION
→ APPLICATION

APPLICATION + FULL
→ FULL

FAST + FULL
→ FULL

```

A presença de uma alteração crítica prevalece sobre alterações de menor risco.

## 5. Alterações desconhecidas

Arquivos não reconhecidos como exclusivamente documentais devem ser tratados,
no mínimo, como APPLICATION.

A classificação não deve assumir baixo risco quando o impacto não puder ser
determinado.

## 6. Fechamento de fase e release

Mesmo quando os commits individuais foram validados proporcionalmente, o
fechamento de uma fase pode exigir uma bateria completa.

Exemplos:

* release candidate
* fechamento de fase de sync
* fechamento de migration
* mudança estrutural de RLS
* mudança transversal de autenticação
* mudança de storage
* mudança de contrato offline-remoto

A regressão completa nesse contexto é deliberada e não deve ser confundida com
a validação de cada patch intermediário.

## 7. Supabase

O Supabase descartável existe para validar comportamento que realmente depende
da infraestrutura local.

Não deve ser iniciado por PR exclusivamente documental.

Quando necessário, o fluxo deve continuar sendo:

```bash
supabase init --force
supabase start
supabase db reset --yes
export test environment
prepare fixtures
execute tests
supabase stop --no-backup

```

O cleanup deve executar mesmo quando testes falharem.

## 8. Credenciais

O frontend utiliza somente credenciais públicas apropriadas para cliente:

* `VITE_SUPABASE_URL`
* `VITE_SUPABASE_PUBLISHABLE_KEY`
* `VITE_SUPABASE_FUNCTIONS_URL`

Não expor no bundle Vite:

* service_role
* secret key
* database password
* JWT secret

Credenciais privilegiadas utilizadas exclusivamente pelo CI devem permanecer
fora de variáveis `VITE_*`.

## 9. Segurança

A redução de tempo do CI não pode eliminar validações necessárias de:

* RLS
* farm isolation
* multi-tenant isolation
* RPC
* auth
* migrations
* sync
* idempotency
* replay
* recovery
* concurrency
* partial failure

Mudanças nessas áreas pertencem ao nível FULL / SUPABASE.

## 10. Evidência

Nenhum agente ou desenvolvedor deve declarar:

* PASS
* validated
* ready
* closed

sem resultado efetivamente observado.

Testes pulados por classificação de risco não contam como executados.

O relatório deve diferenciar:

* executado e aprovado
* não aplicável
* não executado

## 11. Branch protection

O workflow:

`antigravity-validate`

deve continuar sendo disparado em toda Pull Request para `main`.

A classificação ocorre internamente no workflow.

Evitar usar filtros `on.pull_request.paths` para eliminar completamente o
workflow em PRs de baixo risco quando o check fizer parte da branch protection.

O check obrigatório deve existir em todas as PRs.

PRs com `PR_SCOPE=FULL` continuam marcadas com
`full_final_required=true`, mesmo quando o último delta é apenas de testes. A
certificação final é o mesmo check `Required validation`, disparado por
`merge_group/checks_requested` e sempre executado no nível FULL sobre o SHA do
merge group.

Para tornar essa certificação obrigatória antes do merge, a configuração remota
de `main` deve:

* manter `Required validation` como status check obrigatório;
* habilitar merge queue e exigir que a PR passe por ela.

O workflow não altera essa configuração remota. Sem merge queue obrigatória, o
check incremental continua útil, mas o gate FULL final não é imposto pelo
GitHub.

## 12. Regra de manutenção

A matriz de classificação deve ser revisada quando surgirem novas áreas
arquiteturais.

Adicionar uma área nova de persistência, sync, autenticação ou infraestrutura
sem atualizar esta política e o workflow é uma lacuna de governança.

Qualquer alteração da classificação deve preservar o princípio:

```text
risco maior
→ validação maior

risco menor
→ validação proporcional

incerteza
→ escalar, não reduzir

```
