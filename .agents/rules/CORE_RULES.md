# RebanhoSync — Core Rules

* **Offline-first:** Dexie/local primeiro; Supabase/Postgres remoto.
* **Segurança e isolamento:** Preservar RLS, multi-tenant e isolamento por `fazenda_id`.
* **Agenda:** Intenção/tarefa futura; não é histórico.
* **Evento:** Fato executado; histórico vem de eventos e tabelas de detalhe.
* **`state_*`:** Estado atual/read model; não deve competir com o histórico factual.
* **Protocolo:** Regra/configuração; não execução.
* **Tags, sinais e insights:** Auxiliares; nunca fonte primária nem regra crítica.
* **Métricas:** Carência, peso confiável, venda/abate e aptidão operacional exigem fonte técnica explícita.
* **Arquitetura:** Não misturar UI com regra de negócio nem criar fonte de verdade paralela.
* **Sync:** Preservar idempotência, retry/replay, sucesso parcial, rollback e reconciliação.
* **Auditoria:** Distinguir fato confirmado, inferência e recomendação; não declarar validação não executada.
* **Estratégia:** Preferir patch pequeno, reversível e testável.
* **Skills:** Usar no máximo uma skill principal; segunda skill somente quando houver interseção real de domínio crítico.
* **Arquivo histórico:** `docs/archive/**` não é fonte operacional de verdade.

Em conflito, seguir: código + migrations ativas → `docs/context/PROJECT_STATUS.md` → documentos normativos ativos → documentos derivados → histórico/archive → definições da skill.
