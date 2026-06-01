```markdown
# RebanhoSync — Core Rules

* **Offline-first:** Dexie/local primeiro; Supabase/Postgres remoto.
* **Segurança e Isolamento:** Preservar RLS, multi-tenant e isolamento por fazenda.
* **Agenda:** Intenção/tarefa futura; não é histórico.
* **Evento:** Fato executado; histórico vem de eventos + detail tables.
* **`state_*`:** Estado atual/read model.
* **Protocolo:** Regra/configuração; não execução.
* **Tags, sinais e insights:** Auxiliares; nunca fonte primária nem regra crítica.
* **Métricas:** Carência, peso confiável, venda/abate e aptidão operacional exigem fonte técnica explícita.
* **Arquitetura:** Não misturar UI com regra de negócio.
* **Estratégia:** Preferir patch pequeno, reversível, idempotente e testável.

```