```markdown
# Technical Docs — RebanhoSync

Atualizado em: 2026-07-30

Documentação técnica normativa do RebanhoSync.

Esta pasta concentra contratos técnicos ativos.  
Não usar este diretório para auditorias antigas, prompts, relatórios históricos ou handoffs substituídos.

---

## Arquivos

| Arquivo | Uso |
|---|---|
| `ARCHITECTURE.md` | Arquitetura operacional, camadas, fronteiras e responsabilidades. |
| `OFFLINE_SYNC.md` | Offline-first, Dexie, gestures, fila, rollback, retry e reconcile. |
| `SUPABASE_RLS.md` | Supabase, RLS, policies, RPCs, tenant isolation e `fazenda_id`. |
| `EVENTS_AGENDA_CONTRACT.md` | Contrato entre Agenda, Eventos, `state_*`, Protocolos e sinais. |
| `TESTING_GATES.md` | Validações locais, testes, lint, build e baseline Supabase. |
| `REPO_MAP.md` | Mapa curto das áreas técnicas do repositório. |

## Decisões arquiteturais

| ADR | Status | Tema |
|---|---|---|
| [ADR-0001](./adrs/ADR-0001-taxonomia-canonica-bovina.md) | Accepted | Taxonomia canônica bovina |
| [ADR-0002](./adrs/ADR-0002-catalogo-produtos-veterinarios-global.md) | Accepted | Catálogo global de produtos veterinários |
| [ADR-0003](./adrs/ADR-0003-sanitario-sql-materialization-leader.md) | Accepted | Materialização sanitária liderada por SQL |
| [ADR-0004](./adrs/ADR-0004-sanitario-canonical-dedup.md) | Accepted | Deduplicação sanitária canônica |
| [ADR-0005](./adrs/ADR-0005-registrar-sanitario-boundary.md) | Accepted | Fronteira sanitária do Registrar |
| [ADR-0006](./adrs/ADR-0006-sanitario-passive-taxonomy.md) | Accepted | Taxonomia sanitária passiva |
| [ADR-0007](./adrs/ADR-0007-sync-remoto-sanitario-v2-integrado.md) | Accepted; implementação parcial | Sync Remoto Sanitário v2 integrado |

O status de implementação do ADR-0007 é resumido no próprio ADR e detalhado no [handoff atual](../review/CURRENT_PHASE_HANDOFF.md).

---

## Fonte de Verdade

Em caso de conflito, seguir a ordem de precedência:
1. Código + migrations ativas.
2. `docs/context/PROJECT_STATUS.md`.
3. Documentos normativos ativos.
4. Documentos derivados.
5. Histórico em `docs/archive/**`.

---

## Regras de Manutenção

* Não usar `docs/archive/**` como fonte operacional de verdade.
* Não duplicar contratos já definidos em `docs/context/SOURCE_OF_TRUTH.md`.
* Não transformar este diretório em repositório de relatórios de auditoria.
* Manter os arquivos de documentação curtos, acionáveis e fáceis de atualizar.
* Atualizar a documentação apenas quando houver delta técnico e funcional real.

```
