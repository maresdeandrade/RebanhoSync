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
* **Skills:** Em implementação, usar uma skill principal e no máximo uma skill de apoio quando houver interseção técnica concreta. Skills de lifecycle executadas em fases posteriores não contam como segunda skill principal.
* **Arquivo histórico:** `docs/archive/**` não é fonte operacional de verdade.

## Precedência factual

Para determinar o que o produto realmente faz ou qual contrato está ativo:

1. código + migrations ativas;
2. `docs/context/PROJECT_STATUS.md`;
3. documentos normativos ativos;
4. documentos derivados;
5. histórico em `docs/archive/**`;
6. definições procedimentais de skills e prompts.

## Precedência procedimental

Subordinada à hierarquia de instruções do runtime:

1. autorização e escopo da tarefa atual;
2. `AGENTS.md` aplicável;
3. rules obrigatórias;
4. skill principal da fase;
5. no máximo uma skill de apoio explicitamente justificada;
6. prompt ou template.

Nenhuma skill ou prompt pode relaxar regra de segurança, ampliar autorização, autorizar operação destrutiva ou sobrescrever rule obrigatória. Em conflito procedimental, prevalece a camada anterior desta lista.
