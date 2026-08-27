# Roadmap — RebanhoSync

Atualizado em: 2026-08-24
Fase atual: **Fase 21 — Inteligência Operacional v2 (marcador avançado; implementação não iniciada)**
Fase anterior: **Fase 20 — Jornadas UX Críticas (concluída)**

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
12. Fase 17 — Decisão Assistida — **concluída**.
13. Fase 18 — Rebaseline Visual 360° — **concluída**.
14. Fase 19 — Foundations + Shell + Branding — **concluída**.
15. Fase 20 — Jornadas UX Críticas — **concluída**.
16. Fase 21 — Inteligência Operacional v2.
17. Fase 22 — Eficiência Produtiva e Econômica.
18. Fase 23 — Simulação Produtiva e Comercial.
19. Fase 24 — Release Hardening / Scale Readiness.

O rollout do Sync Sanitário v2 permanece não autorizado por `SANITARIO_V2_E2E_PLATFORM_BLOCKED`. Isso não reabre o desenvolvimento técnico da Fase 12.

## Fase 13 — resultado encerrado

Cobertura/IA, diagnóstico, PRENHA/VAZIA e DPP reconstruíveis, parto, aborto/perda, vínculo mãe–cria, correções append-only e Agenda neonatal v2 estão operacionais. O patch final eliminou a precedência residual de `taxonomy_facts` sobre a projeção reprodutiva canônica nas telas.

## Fase 14 — resultado encerrado

A Fase 14 — Compra/Venda Operacional foi encerrada no baseline autoritativo `main@7a1e7e5b3eef307b79428a87b5268c3c5d4fb078`. As operações comerciais individual e em lote foram integradas, o contrato kg/@ foi preservado, precificação e simulação comercial foram integradas, e a simulação permaneceu não factual. A Importação V2 foi integrada com preview, versionamento, chunks, idempotência e offline-first. Nenhuma nova fonte de verdade foi criada.

## Próxima fase de desenvolvimento

```txt
Fase 20 — Jornadas UX Críticas — concluída
→ Fase 21 — Inteligência Operacional v2 — implementação não iniciada
```

A Fase 19 implementou foundations tipográficas e semânticas, branding reutilizável, primitives estruturais e shell/navegação responsivos sobre o contrato da F18. Home, Animais, AnimalDetalhe, Registrar e Agenda foram revalidados sem migração ampla em 390, 768, 1024 e 1440 px, light/dark; nenhum P0 novo foi confirmado e o P0 do Registrar permanece resolvido.

A Fase 20 migrou as cinco jornadas críticas para os padrões compartilhados, com validação autenticada completa em quatro viewports e dois temas. Selectors, filtros, bulk, writers, Evento, Agenda, `state_*`, persistência e sync permaneceram inalterados; P0 novo = 0. Dívidas não bloqueantes seguem destinadas às fases de produto correspondentes.

## Roadmap 18–24 — limites

- **Fase 18 — Rebaseline Visual 360°:** auditoria e inventário visual, Design System documental e matriz de migração P0–P3.
- **Fase 19 — Foundations + Shell + Branding:** foundations visuais, shell da aplicação e identidade de marca.
- **Fase 20 — Jornadas UX Críticas:** Home, Animais, AnimalDetalhe, Registrar e Agenda.
- **Fase 21 — Inteligência Operacional v2:** evolução da inteligência operacional reutilizando `MetricResult` e `DecisionRecommendation`.
- **Fase 22 — Eficiência Produtiva e Econômica:** produtividade e economia; peso observado não equivale automaticamente a peso atual confiável, e o item 22C de lote/pasto depende de histórico de movimentação confiável (pré-requisito de pull padrão resolvido na Trilha B com `AUTOMATED_CONVERGENCE_VERIFIED`; validação remota E2E é gate de entrada da F22C).
- **Fase 23 — Simulação Produtiva e Comercial:** simulações com premissas explícitas; projeção não é fato e simulação não é autorização comercial.
- **Fase 24 — Release Hardening / Scale Readiness:** offline prolongado, multi-device, RLS, recovery, observabilidade, performance, migrations/upgrades e release gates.

Hardening proporcional permanece obrigatório em cada fase. A Fase 24 concentra o hardening sistêmico final para escala. Fases encerradas só reabrem diante de regressão concreta.

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
| 17 | Decisão Assistida | **Concluída e integrada** em `main@797f84d3aa49f424bf0b6ca013e416c61f24c41e` |
| 18 | Rebaseline Visual 360° | **Concluída**; Design System e matriz P0–P3 produzidos, P0 responsivo encerrado |
| 19 | Foundations + Shell + Branding | **Concluída**; foundations e shell revalidados em light/dark e mobile/desktop |
| 20 | Jornadas UX Críticas | **Concluída**; cinco jornadas migradas e validadas |
| 21 | Inteligência Operacional v2 | Fase atual; implementação não iniciada; reutilizar `MetricResult` e `DecisionRecommendation` |
| 22 | Eficiência Produtiva e Econômica | Exigir fontes confiáveis para peso e validação remota E2E de movimentação |
| 23 | Simulação Produtiva e Comercial | Premissas explícitas e separação entre projeção, fato e autorização |
| 24 | Release Hardening / Scale Readiness | Hardening sistêmico final para escala |
