# Roadmap — RebanhoSync

Atualizado em: 2026-07-30
Fase atual: **Fase 12 — ativa**
Próximo incremento: **3.8 — Push/pull de histórico sanitário externo/documental**

## Objetivo

Definir a sequência macro de desenvolvimento. O plano detalhado da fase corrente está em [ACTIVE_PHASE_PLAN.md](../review/ACTIVE_PHASE_PLAN.md), e o estado técnico está em [CURRENT_PHASE_HANDOFF.md](../review/CURRENT_PHASE_HANDOFF.md).

## Princípios

- estabilizar antes de expandir;
- preservar offline-first, RLS, multi-tenant e `fazenda_id`;
- manter Agenda, Evento, `state_*`, Protocolo e Conformidade semanticamente separados;
- não automatizar decisão crítica sem fonte técnica explícita;
- não iniciar a Fase 13 antes do fechamento formal da Fase 12.

## Fase 12 — estado vigente

1. Validação real da Conformidade Sanitária v2 — **concluída**.
2. Documentação curta do Sanitário v2 local — **concluída**.
3. Sync remoto sanitário v2 — **em andamento**.
   1. Diagnóstico schema local/remoto — **concluído**.
   2. Migrations necessárias — **concluído**.
   3. RLS/multi-tenant/fazenda — **concluído**.
   4. Agenda sanitária — **implementada; E2E parcial**.
   5. `agenda_animais` — **implementada; E2E parcial**.
   6. Evento sanitário — **implementado; E2E pendente**.
   7. Detalhe sanitário — **implementado; E2E pendente**.
   8. Histórico externo/documental — **próximo incremento**.
   9. Movimento de estoque sanitário — **pendente**.
   10. Retry/replay/idempotência — **implementado**.
   11. Sucesso parcial — **local validado; remoto pendente**.
   12. Conflito multi-dispositivo — **plataforma bloqueada**.
   13. Recalcular Conformidade após pull — **pendente**.
4. Produto sanitário técnico e fonte por campo.
5. Correção append-only sanitária.
6. Carência operacional derivada.
7. Fechamento formal da Fase 12.
8. Fase 13 — Reprodução Operacional v1.
9. Fase 14 — Compra/Venda Operacional.
10. Fase 15 — KPIs/Relatórios.
11. Fase 16 — Financeiro Gerencial.
12. Fase 17 — Decisão Assistida.
13. Fase 18 — Beta/Hardening.

O item 3 não está integralmente concluído. A Fase 12 permanece ativa.

## Próximo incremento funcional

O item 3.8 sincronizará histórico sanitário de entrada `external_declared` e `external_documented`, preservando origem e evidência.

Guardrails:

- comprovação crítica por `external_documented` exige referência documental;
- fila compartilhada, UUID, idempotência e isolamento por `fazenda_id`;
- pull não destrutivo;
- replay, conflito e sucesso parcial explícitos;
- recálculo conservador da Conformidade após pull;
- nenhuma criação de Agenda ou Evento executado;
- nenhum movimento de estoque, cálculo de carência ou liberação operacional;
- gate remoto desligado, feature flag local `false` e rollout não autorizado.

## Sequência após 3.8

```txt
3.9 Movimento de estoque sanitário
→ 3.13 recálculo explícito da Conformidade após pull
→ reexecução dos E2Es remotos quando a plataforma estiver estável
→ 4 Produto técnico e fonte por campo
→ 5 Correção append-only
→ 6 Carência operacional
→ 7 Fechamento da Fase 12
```

## Risco de rollout

`SANITARIO_V2_E2E_PLATFORM_BLOCKED` bloqueia o rollout do Sync Sanitário v2. O PostgreSQL produz o conflito esperado `SQLSTATE 40001 / SANITARIO_AGENDA_REVISION_CONFLICT`, mas a resposta não retorna pelo caminho Edge Function/PostgREST/gateway antes do timeout.

Não há evidência atual de defeito no SQL ou na regra de domínio. Não aumentar timeout nem alterar RPC sem nova evidência. O desenvolvimento pode continuar sob gates desligados.

## Fases anteriores

Fases 1 a 11 e a Fase 11.5 permanecem concluídas conforme seus relatórios e evidências históricas. Esses documentos preservam a cronologia, mas não substituem o plano ativo da Fase 12.

## Sequência futura

| Fase | Escopo | Condição de início |
|---|---|---|
| 13 | Reprodução Operacional v1 | Fase 12 formalmente encerrada |
| 14 | Compra/Venda Operacional | Fontes sanitárias operacionais estabilizadas |
| 15 | KPIs/Relatórios | Fontes, períodos e limitações explícitos |
| 16 | Financeiro Gerencial | Ledger e critérios gerenciais explícitos |
| 17 | Decisão Assistida | Dados confiáveis e limites de não autorização |
| 18 | Beta/Hardening | Gates técnicos e operacionais atendidos |
