```md
# Repo Map — RebanhoSync

## Objetivo

Mapa técnico curto do repositório para orientar agentes e revisões sem leitura ampla.

---

## Áreas principais

```txt
src/
  ├── components/
  ├── hooks/
  ├── lib/
  └── pages/

supabase/
  ├── migrations/
  └── functions/

docs/
  ├── context/
  ├── technical/
  ├── domain/
  ├── product/
  ├── ux/
  ├── finance/
  ├── manuals/
  └── archive/

.agents/
  ├── rules/
  ├── skills/
  └── prompts/

scripts/
  └── codex/

```

---

## `src/pages/`

Telas e composição de UI.

### Riscos

* Regra crítica em componente;
* Acoplamento de UI com domínio;
* Fluxo visual alterando fonte de verdade.

---

## `src/components/`

Componentes reutilizáveis.

### Riscos

* Componente genérico assumir regra de domínio;
* Badge/tag visual virar decisão operacional.

---

## `src/hooks/`

Hooks de composição.

### Riscos

* Hook fazer IO/regra crítica fora da camada correta;
* Cache mascarar fonte de verdade.

---

## `src/lib/`

Domínio, infra, offline, helpers e regras puras.

### Áreas críticas

* `src/lib/offline/`
* `src/lib/sanitario/`
* `src/lib/reproduction/`
* `src/lib/animals/`
* `src/lib/events/`
* `src/lib/insights/`

---

## `src/lib/insights/`

Camada read-only/core puro.

### Não deve

* Fazer IO;
* Persistir;
* Chamar Supabase/Dexie;
* Gerar agenda;
* Gerar evento;
* Decidir carência/venda/abate;
* Criar regra crítica.

---

## `supabase/migrations/`

Migrations ativas.

> ⚠️ Fonte técnica primária para schema, RLS, RPC, constraints e baseline. Não usar migrations legadas como fonte ativa sem pedido explícito.

---

## `supabase/functions/sync-batch/`

Edge Function de sync.

### Riscos

* Bypass RLS;
* Aceitar payload cross-tenant;
* Retry duplicar efeitos;
* Falha parcial sem reconcile.

---

## `.agents/rules/`

Regras compactas para agentes.

### Usar para

* Carregamento de contexto;
* Execução de comandos;
* Formato de resposta;
* Evitar leitura ampla.

---

## `.agents/skills/`

Procedimentos especializados.

> ⚠️ Não abrir todas por padrão.

---

## `.agents/prompts/`

Prompts reutilizáveis para Codex, Antigravity e outros agentes.

> ⚠️ Usar prompt quando a tarefa precisa de formato, não de skill permanente.

---

## `docs/archive/`

Histórico.

> ⚠️ Não usar como fonte operacional atual.

```

```