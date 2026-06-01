# Sync Batch — Local Agent

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Escopo

```txt
supabase/functions/sync-batch/**
```

Use este arquivo para alterações na função remota de sincronização em lote.

Esta função é crítica para offline-first, idempotência, multi-tenant, RLS, sucesso parcial, rejeição, conflitos e reconciliação local-remota.

---

## Leitura mínima

1. `AGENTS.md` da raiz.
2. `.agents/rules/CORE_RULES.md`.
3. `.agents/rules/CONTEXT_LOADING.md`.
4. `docs/technical/OFFLINE_SYNC.md`.
5. `docs/technical/SUPABASE_RLS.md`.
6. `src/lib/offline/AGENTS.md`.

Ler apenas se necessário:

| Situação | Ler |
|---|---|
| Eventos/append-only | `src/lib/events/AGENTS.md`, `docs/technical/EVENTS_AGENDA_CONTRACT.md` |
| Agenda | `src/lib/agenda/AGENTS.md` |
| Sanitário | `src/lib/sanitario/AGENTS.md`, `docs/domain/SANITARIO.md` |
| Reprodução | `src/lib/reproduction/AGENTS.md`, `docs/domain/REPRODUCAO.md` |
| Migrations/schema | `supabase/migrations/AGENTS.md` |
| Status/lacunas | `docs/context/PROJECT_STATUS.md`, `docs/context/KNOWN_GAPS.md` |

---

## Modelo mental obrigatório

```txt
Cliente offline cria gesto/operação local.
Dexie aplica otimisticamente.
sync-batch valida e aplica no remoto.
Resposta remota permite reconciliar sucesso, sucesso parcial, rejeição e conflito.
Rollback local precisa ser determinístico.
```

O remoto não deve confiar cegamente no cliente.

---

## Foco deste diretório

- Envelope remoto de sync.
- Validação de operações.
- Idempotência por `client_op_id` / `client_tx_id`.
- Aplicação transacional ou parcialmente segura.
- Rejeições auditáveis.
- Status codes de sync.
- Proteção multi-tenant.
- Escrita em tabelas remotas.
- Regras de conflito.
- Retorno necessário para reconciliação local.

---

## Invariantes obrigatórias

- Preservar isolamento por `fazenda_id`.
- Preservar RLS e validações server-side.
- Preservar idempotência.
- Não aplicar duas vezes a mesma operação.
- Não aceitar `fazenda_id` fora do escopo do usuário.
- Não confiar em `created_at` / `updated_at` enviados pelo cliente como autoridade.
- Não quebrar `client_id`, `client_op_id`, `client_tx_id`, `client_recorded_at`.
- Não ocultar rejeição.
- Não transformar rejeição em sucesso silencioso.
- Não quebrar sucesso parcial.
- Não quebrar rollback local.
- Não quebrar ordem de aplicação quando ela for semântica.
- Não misturar tenant ou fazenda em operação composta.
- Não inserir evento histórico sem detail obrigatório quando aplicável.
- Não permitir operação sem auditoria mínima.

---

## Checagens antes de alterar

1. A mudança altera envelope, validação, aplicação ou resposta?
2. A operação continua idempotente?
3. Retry de rede continua seguro?
4. Sucesso parcial fica explícito?
5. Rejeição fica auditável e reconciliável?
6. Há risco de cross-tenant?
7. Há risco de bypass de RLS?
8. A ordem de aplicação importa?
9. O cliente Dexie espera outro shape de resposta?
10. O rollback local ainda consegue restaurar o estado?
11. Há impacto em evento, agenda, estoque, sanitário ou reprodução?
12. Há necessidade de migration antes do código?

---

## Evitar

- Alterar contrato remoto sem atualizar cliente offline.
- Criar fallback silencioso.
- Aceitar operação sem `fazenda_id` válido.
- Resolver conflito com sobrescrita implícita.
- Usar dado atual para reescrever snapshot histórico.
- Misturar validação de domínio complexa com parsing genérico sem teste.
- Criar nova resposta sem documentar impacto no cliente.
- Depender de ordem não determinística.
- Ignorar rejeição de uma operação em lote.
- Retornar sucesso global quando houve falha parcial.

---

## Entrega esperada

- Diff mínimo.
- Contrato remoto alterado explicitamente.
- Shape de request/response descrito.
- Impacto no cliente offline.
- Até 3 riscos.
- Testes focados.
- Estratégia de rollback/retry.
- Validação Supabase executada quando aplicável.

---

## Validação

```bash
pnpm test
pnpm run lint
pnpm run build
```

Validação funcional obrigatória se tocar contrato, RLS, RPC, schema ou aplicação remota:

```bash
node scripts/codex/validate-supabase-baseline-functional.mjs
```

Se houver teste específico da função:

```bash
pnpm test -- -t "sync-batch"
```

---

## Quando escalar

- Se precisar mudar schema, FK, índice, RLS ou RPC: consultar `supabase/migrations/AGENTS.md`.
- Se mudar envelope usado pelo cliente: consultar `src/lib/offline/AGENTS.md`.
- Se mudar semântica de evento: consultar `src/lib/events/AGENTS.md`.
- Se mudar regra de agenda: consultar `src/lib/agenda/AGENTS.md`.
- Se mudar domínio sanitário/reprodutivo: consultar o `AGENTS.md` local do domínio.
- Se alterar regra normativa de sync: avaliar ADR.