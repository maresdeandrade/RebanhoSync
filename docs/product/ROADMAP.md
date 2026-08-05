# Roadmap — RebanhoSync

Atualizado em: 2026-08-05
Fase atual: **Fase 13 — Reprodução Operacional v1**
Fase anterior: **Fase 12 — desenvolvimento técnico concluído; rollout sanitário bloqueado**

## Objetivo

Definir a sequência macro de desenvolvimento. O plano detalhado da fase corrente está em [ACTIVE_PHASE_PLAN.md](../review/ACTIVE_PHASE_PLAN.md), e o estado técnico está em [CURRENT_PHASE_HANDOFF.md](../review/CURRENT_PHASE_HANDOFF.md).

## Princípios

- estabilizar antes de expandir;
- preservar offline-first, RLS, multi-tenant e `fazenda_id`;
- manter Agenda, Evento, `state_*`, Protocolo e Conformidade semanticamente separados;
- não automatizar decisão crítica sem fonte técnica explícita;
- não iniciar a Fase 13 antes do fechamento formal da Fase 12.

## Fase 12 — resultado encerrado

1. Validação real da Conformidade Sanitária v2 — **concluída**.
2. Documentação curta do Sanitário v2 local — **concluída**.
3. Sync remoto sanitário v2 — **desenvolvimento técnico concluído e certificado funcionalmente**.
4. Produto sanitário técnico e fonte por campo — **concluído**.
5. Correção append-only sanitária — **concluída**.
6. Carência operacional derivada — **concluída**.
7. Fechamento formal da Fase 12 — **concluído**.
8. Fase 13 — Reprodução Operacional v1.
9. Fase 14 — Compra/Venda Operacional.
10. Fase 15 — KPIs/Relatórios.
11. Fase 16 — Financeiro Gerencial.
12. Fase 17 — Decisão Assistida.
13. Fase 18 — Beta/Hardening.

O rollout do Sync Sanitário v2 permanece não autorizado por `SANITARIO_V2_E2E_PLATFORM_BLOCKED`. Isso não reabre o desenvolvimento técnico da Fase 12.

## Próxima fase de desenvolvimento

```txt
Fase 13 — Reprodução Operacional v1
→ Fase 14 — Compra/Venda Operacional
```

A Fase 13 inicia sem habilitar gate, feature flag ou rollout do Sync Sanitário v2.

## Risco de rollout

`SANITARIO_V2_E2E_PLATFORM_BLOCKED` bloqueia o rollout do Sync Sanitário v2. O PostgreSQL produz o conflito esperado `SQLSTATE 40001 / SANITARIO_AGENDA_REVISION_CONFLICT`, mas a resposta não retorna pelo caminho Edge Function/PostgREST/gateway antes do timeout.

Não há evidência atual de defeito no SQL ou na regra de domínio. Não aumentar timeout nem alterar RPC sem nova evidência. O desenvolvimento pode continuar sob gates desligados.

## Fases anteriores

Fases 1 a 12 e a Fase 11.5 permanecem concluídas conforme seus relatórios e evidências. O bloqueio de rollout sanitário permanece registrado separadamente e não altera essa sequência de desenvolvimento.

## Sequência futura

| Fase | Escopo | Condição de início |
|---|---|---|
| 13 | Reprodução Operacional v1 | Fase 12 formalmente encerrada |
| 14 | Compra/Venda Operacional | Fontes sanitárias operacionais estabilizadas |
| 15 | KPIs/Relatórios | Fontes, períodos e limitações explícitos |
| 16 | Financeiro Gerencial | Ledger e critérios gerenciais explícitos |
| 17 | Decisão Assistida | Dados confiáveis e limites de não autorização |
| 18 | Beta/Hardening | Gates técnicos e operacionais atendidos |
