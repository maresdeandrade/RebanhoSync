
---

# 2) `AGENTS.md`

```md
# REBANHOSYNC — ENTRYPOINT FOR CODEX

Estado atual:
- Beta interno
- MVP completo e operacional
- Prioridade: patches pequenos, locais e revisáveis
- Este arquivo é um dispatcher curto; detalhes de domínio ficam nos `AGENTS.md` locais e nas skills em `.agent/skills/`

## 1) Leitura inicial obrigatória

Leia nesta ordem:
1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/PROCESS.md`

Objetivo dessa leitura:
- entender o snapshot operacional atual
- identificar o `capability_id` ou `infra.*` alvo
- evitar abrir documentação histórica ou derivada sem necessidade

## 2) Leitura adicional apenas se a tarefa exigir

### Arquitetura / offline / sync
- `docs/ARCHITECTURE.md`
- `docs/OFFLINE.md`
- `docs/CONTRACTS.md`

### Banco / segurança / tenancy
- `docs/DB.md`
- `docs/RLS.md`

### Estado analítico / backlog / reconciliação
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/TECH_DEBT.md`
- `docs/ROADMAP.md`
- `docs/review/RECONCILIACAO_REPORT.md`

### Domínio / produto
- `docs/PRODUCT.md`
- `docs/SYSTEM.md`
- `docs/REFERENCE.md`

## 3) Não ler por padrão

Evite abrir sem necessidade explícita:
- `docs/archive/**`
- auditorias históricas
- relatórios temporários
- arquivos gerados (`dist/**`, `coverage/**`, caches)
- documentos derivados quando a tarefa é apenas de implementação local
- qualquer doc antigo que contradiga `CURRENT_STATE.md` ou `PROCESS.md`

## 4) Escopo padrão de trabalho

- Sempre fechar a tarefa por `capability_id` ou `infra.*`
- Tocar no máximo 1 capability principal por tarefa
- Evitar refatoração ampla sem pedido explícito
- Preferir diff mínimo sobre reescrita completa
- Não “reaprender” o repositório inteiro a cada tarefa
- Não abrir múltiplos domínios se a mudança for local
- Se a tarefa for ambígua, assumir o menor escopo seguro e explicitá-lo

## 5) AGENTS locais: quando escalar

Antes de abrir muitos arquivos, verificar se a pasta já possui `AGENTS.md` local.

### Escalar para:
- `src/lib/offline/AGENTS.md`
  - quando tocar Dexie, gestures, rollback, pull, sync worker, telemetry, `tableMap`
- `src/lib/sanitario/AGENTS.md`
  - quando tocar protocolos, `calendario_base`, catálogo oficial, overlay, compliance, produtos veterinários
- `src/lib/reproduction/AGENTS.md`
  - quando tocar cobertura/IA, diagnóstico, parto, pós-parto, cria inicial, episode linking
- `supabase/functions/sync-batch/AGENTS.md`
  - quando tocar validação autoritativa, status codes, blocked tables, payload versionado, reason codes
- `supabase/migrations/AGENTS.md`
  - quando tocar schema, RLS, RPCs, views, triggers, FKs compostas, catálogo global vs tenant-scoped

Regra:
- o AGENT local restringe e aprofunda
- o root define o enquadramento geral
- não duplicar regra longa no root e no local

## 6) Skills: quando usar

Consulte `.agent/skills/README.md` para o índice completo.

Use skills quando a tarefa for principalmente:
- architectural hardening -> `harden-module`
- PR preparation -> `prepare-pr`
- documentation reconciliation -> `reconcile-docs`
- sanitary operational flow -> `sanitario-registro-operacional`
- sanitary regulatory/compliance flow -> `sanitario-catalogo-regulatorio-compliance`
- animal registration / origin / destination -> `animal-cadastro-origem-destino`
- reproduction / parto / pós-parto / cria -> `reproducao-parto-posparto-cria`
- movement / transit / compliance -> `movimentacao-transito-conformidade`
- offline / sync / rollback -> `sync-offline-rollback`
- migrations / RLS / contracts -> `migrations-rls-contracts`
- derived doc reconciliation -> `docs-reconciliation`

## 7) Áreas críticas do produto

Tratar como zonas de maior risco:
- `src/lib/offline/**`
- `src/lib/sanitario/**`
- `src/lib/reproduction/**`
- `src/lib/animals/**` quando a tarefa tocar taxonomia / elegibilidade / apresentação derivada
- `src/lib/events/**` quando a tarefa tocar builders / validators / payloads
- `src/pages/Registrar/**`
- `src/pages/Agenda/**`
- `src/pages/ProtocolosSanitarios/**`
- `supabase/functions/sync-batch/**`
- `supabase/migrations/**`

## 8) Invariantes que não podem ser quebradas

### Produto / arquitetura
- Two Rails:
  - agenda = intenção futura mutável
  - eventos = fatos passados append-only
- correção de evento ocorre por contra-lançamento, nunca por update destrutivo de negócio
- não existe FK dura agenda ↔ evento; vínculo é lógico
- taxonomia é derivada de fatos; não persistir label derivado como fonte primária

### Offline / sync
- preservar idempotência
- preservar rollback determinístico por `before_snapshot`
- preservar metadata obrigatória de sync:
  - `fazenda_id`
  - `client_id`
  - `client_op_id`
  - `client_tx_id`
  - `client_recorded_at`
- não enviar `created_at` / `updated_at` como payload de escrita
- nomes remotos continuam sendo a interface de escrita; Dexie usa tradução via `tableMap`
- catálogo global offline não deve virar tabela tenant-scoped por acidente

### Segurança / tenancy
- `fazenda_id` é a fronteira de isolamento
- FKs compostas com `fazenda_id` quando aplicável
- `user_fazendas` não ganha escrita direta
- RLS / RBAC / RPCs `SECURITY DEFINER` devem ser preservados
- policies não devem introduzir bypass cross-tenant
- manter `search_path = public` e validação explícita nas RPCs privilegiadas

### Sanitário
- manter separação entre:
  1. base regulatória oficial
  2. overlay operacional do pack
  3. protocolos operacionais da fazenda
- não reduzir `calendario_base` a `intervalo_dias`
- não reintroduzir protocolo base hardcoded na UI
- `produtos_veterinarios` permanece referência estruturada do fluxo sanitário

### Reprodução
- preservar episode linking determinístico
- fatos event-driven não aceitam override manual arbitrário
- não quebrar fluxo parto -> pós-parto -> cria inicial

## 9) Forma de entrega

Retorne por padrão:
- diff mínimo
- até 3 riscos
- até 5 arquivos principais afetados
- testes/comandos realmente necessários
- sem reescrever arquivo inteiro sem necessidade
- sem refatoração ampla “por oportunidade” fora do escopo

## 10) Validação mínima

Sempre que a mudança tocar código:
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`

Quando a mudança tocar sync, migrations, RLS ou edge functions:
- revisar isolamento por `fazenda_id`
- revisar FKs compostas
- revisar invariantes append-only
- revisar reason codes / rollback / compatibilidade offline

## 11) Atualização documental

Atualizar docs derivados apenas quando houver mudança funcional real.

Ordem:
1. `docs/IMPLEMENTATION_STATUS.md`
2. `docs/TECH_DEBT.md`
3. `docs/ROADMAP.md`
4. `docs/review/RECONCILIACAO_REPORT.md`

Se a mudança for apenas:
- visual
- limpeza local
- organização de código sem impacto funcional
- refino interno sem alterar capability/gap/contrato

então não abrir docs derivados por padrão.

## 12) Quando abrir ADR

Abrir ADR se a mudança alterar:
- contrato do sync
- ordering / deduplicação / status codes
- modelo de dados canônico
- invariantes de RLS / RBAC / RPC
- arquitetura offline-first / Two Rails
- regra normativa que passa a orientar o produto

## 13) Codex execution

Before starting a task:
- read `README.md`, `docs/CURRENT_STATE.md`, `docs/PROCESS.md`
- if needed, run `powershell -File scripts/codex/bootstrap.ps1`

Do not edit by default:
- `docs/archive/**`
- `dist/**`
- `coverage/**`
- `*.tsbuildinfo`

Before editing restricted or generated paths explicitly:
- run `powershell -File scripts/codex/preflight.ps1 -Paths "<path1>","<path2>"`

After touching critical areas:
- run `powershell -File scripts/codex/validate.ps1 -TouchedPaths "<path1>","<path2>"`

## 14) Regras de higiene

- não versionar artefatos gerados
- não espalhar relatórios temporários na raiz
- preferir leitura inicial por `README.md` + `docs/CURRENT_STATE.md` + `docs/PROCESS.md`
- usar `docs/archive/` apenas como histórico, não como fonte operacional
- em caso de conflito, confiar primeiro em:
  1. código + migrations
  2. `docs/CURRENT_STATE.md`
  3. docs normativos
  4. docs derivados
  5. histórico

## 15) Anti-drift explícito

Não assumir como verdade operacional:
- qualquer referência antiga a versões/arquiteturas superadas do offline
- qualquer referência antiga a gaps residuais já fechados
- qualquer leitura antiga que contradiga o snapshot atual do projeto

Se encontrar divergência documental:
- reportar o drift
- seguir o snapshot atual + normativos + código/migrations
- só atualizar docs se a tarefa realmente incluir reconciliação documental
