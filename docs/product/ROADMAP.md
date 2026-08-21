# Roadmap — RebanhoSync

Atualizado em: 2026-08-20
Fase atual: **Fase 17 — Decisão Assistida (preparada para abertura, não iniciada)**
Fase anterior: **Fase 16 — Financeiro Gerencial (integrada via PR #94)**

## Objetivo

Definir a sequência macro de desenvolvimento. O plano detalhado da fase corrente está em [ACTIVE_PHASE_PLAN.md](../review/ACTIVE_PHASE_PLAN.md), e o estado técnico está em [CURRENT_PHASE_HANDOFF.md](../review/CURRENT_PHASE_HANDOFF.md).

## Princípios

- estabilizar antes de expandir;
- preservar offline-first, RLS, multi-tenant e `fazenda_id`;
- manter Agenda, Evento, `state_*`, Protocolo e Conformidade semanticamente separados;
- não automatizar decisão crítica sem fonte técnica explícita;
- não iniciar uma fase antes do fechamento formal da anterior.

## Fase 12 — resultado encerrado

1. Validação real da Conformidade Sanitária v2 — **concluída**.
2. Documentação curta do Sanitário v2 local — **concluída**.
3. Sync remoto sanitário v2 — **desenvolvimento técnico concluído e certificado funcionalmente**.
4. Produto sanitário técnico e fonte por campo — **concluído**.
5. Correção append-only sanitária — **concluída**.
6. Carência operacional derivada — **concluída**.
7. Fechamento formal da Fase 12 — **concluído**.
8. Fase 13 — Reprodução Operacional v1 — **concluída**.
9. Fase 14 — Compra/Venda Operacional — **concluída**.
10. Fase 15 — KPIs/Relatórios.
11. Fase 16 — Financeiro Gerencial.
12. Fase 17 — Decisão Assistida.
13. Fase 18 — Beta/Hardening.

O rollout do Sync Sanitário v2 permanece não autorizado por `SANITARIO_V2_E2E_PLATFORM_BLOCKED`. Isso não reabre o desenvolvimento técnico da Fase 12.

## Fase 13 — resultado encerrado

Cobertura/IA, diagnóstico, PRENHA/VAZIA e DPP reconstruíveis, parto, aborto/perda, vínculo mãe–cria, correções append-only e Agenda neonatal v2 estão operacionais. O patch final eliminou a precedência residual de `taxonomy_facts` sobre a projeção reprodutiva canônica nas telas.

## Fase 14 — resultado encerrado

A Fase 14 — Compra/Venda Operacional foi encerrada no baseline autoritativo `main@7a1e7e5b3eef307b79428a87b5268c3c5d4fb078`. As operações comerciais individual e em lote foram integradas, o contrato kg/@ foi preservado, precificação e simulação comercial foram integradas, e a simulação permaneceu não factual. A Importação V2 foi integrada com preview, versionamento, chunks, idempotência e offline-first. Nenhuma nova fonte de verdade foi criada.

## Próxima fase de desenvolvimento

```txt
Fase 16 — Financeiro Gerencial — integrada
→ Fase 17 — Decisão Assistida — preparada para abertura
```

A Fase 16 — Financeiro Gerencial foi integralmente concluída e integrada à branch principal (merge commit `f20146505a04c0eab03c0685f2bdef7763bae221`). A implementação incluiu o hardening offline de transações e categorias financeiras, hardening semântico de valores, classificação canônica para prevenção de dupla contagem, separação de caixa/competência/previsão/vencido, estorno append-only auditável e identidades determinísticas para categorias baseadas em SHA-256. A Fase 17 — Decisão Assistida não foi iniciada.

## Risco de rollout

`SANITARIO_V2_E2E_PLATFORM_BLOCKED` bloqueia o rollout do Sync Sanitário v2. O PostgreSQL produz o conflito esperado `SQLSTATE 40001 / SANITARIO_AGENDA_REVISION_CONFLICT`, mas a resposta não retorna pelo caminho Edge Function/PostgREST/gateway antes do timeout.

Não há evidência atual de defeito no SQL ou na regra de domínio. Não aumentar timeout nem alterar RPC sem nova evidência. O desenvolvimento pode continuar sob gates desligados.

## Fases anteriores

Fases 1 a 12 e a Fase 11.5 permanecem concluídas conforme seus relatórios e evidências. O bloqueio de rollout sanitário permanece registrado separadamente e não altera essa sequência de desenvolvimento.

## Sequência futura

| Fase | Escopo | Condição de início |
|---|---|---|
| 13 | Reprodução Operacional v1 | Concluída |
| 14 | Compra/Venda Operacional | **Concluída** em `main@7a1e7e5b3eef307b79428a87b5268c3c5d4fb078` |
| 15 | KPIs/Relatórios | **Concluída** |
| 16 | Financeiro Gerencial | **Integrada via PR #94** |
| 17 | Decisão Assistida | Preparada para abertura, não iniciada |
| 18 | Beta/Hardening | Gates técnicos e operacionais atendidos |
