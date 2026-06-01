```markdown
# Technical Docs — RebanhoSync

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