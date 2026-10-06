# Roadmap — RebanhoSync

Atualizado em: 2026-10-06
Fase atual: **Fase 24 — Release Hardening / Scale Readiness (F24.4 / F24.4F CLOSED / INTEGRATED; F24.5 IN_PROGRESS)**
Próxima frente: **F24.5B — Structured Diagnostics (NEXT / READY_TO_START); F24.5A READY_FOR_REVIEW**
Fase anterior: **Fase 22 — Eficiência Produtiva e Econômica (CLOSED)**

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
10. Fase 15 — KPIs/Relatórios — **concluída**.
11. Fase 16 — Financeiro Gerencial — **concluída**.
12. Fase 17 — Decisão Assistida — **concluída**.
13. Fase 18 — Rebaseline Visual 360° — **concluída**.
14. Fase 19 — Foundations + Shell + Branding — **concluída**.
15. Fase 20 — Jornadas UX Críticas — **concluída**.
16. Trilha D — UX/UI Rebaseline 2.0 (D0–D6) — **concluída e formalmente encerrada (PRs #122, #125–#128)**.
17. Fase 21 — Inteligência Operacional v2 — **concluída**.
18. Fase 22 — Eficiência Produtiva e Econômica — **concluída (F22A, F22B e F22C fechadas)**.
19. Fase 23 — Simulação Produtiva e Comercial — **concluída / CLOSED**.
20. Fase 24 — Release Hardening / Scale Readiness — **IN PROGRESS; F24.4A–F24.4F CLOSED / INTEGRATED; F24.5 IN_PROGRESS; F24.5A READY_FOR_REVIEW; F24.5B NEXT**.

`SANITARIO_V2_E2E_PLATFORM_BLOCKED = CLOSED` em 05/10/2026. Rollout e importação real permanecem não autorizados; isso não reabre a Fase 12 nem encerra F24.

## Fase 13 — resultado encerrado

Cobertura/IA, diagnóstico, PRENHA/VAZIA e DPP reconstruíveis, parto, aborto/perda, vínculo mãe–cria, correções append-only e Agenda neonatal v2 estão operacionais. O patch final eliminou a precedência residual de `taxonomy_facts` sobre a projeção reprodutiva canônica nas telas.

## Fase 14 — resultado encerrado

A Fase 14 — Compra/Venda Operacional foi encerrada no baseline autoritativo `main@7a1e7e5b3eef307b79428a87b5268c3c5d4fb078`. As operações comerciais individual e em lote foram integradas, o contrato kg/@ foi preservado, precificação e simulação comercial foram integradas, e a simulação permaneceu não factual. A Importação V2 foi integrada com preview, versionamento, chunks, idempotência e offline-first. Nenhuma nova fonte de verdade foi criada.

## Fase atual de desenvolvimento

F24.4/F24.4F estão [CLOSED / INTEGRATED](../review/F24_4F_INTEGRATED_CERTIFICATION.md)
pelo PR #181 em `main@3da8c89a5dd8c2d793d8d34af749a68c9c81f59a`.
F24.5 IN_PROGRESS: [F24.5A](../review/F24_5A_OBSERVABILITY_BASELINE.md)
READY_FOR_REVIEW, review APPROVED e pacote READY_FOR_COMMIT, ainda sem integração.
[F24.5B](../review/F24_5B_STRUCTURED_DIAGNOSTICS_PLAN.md) é NEXT / READY_TO_START
lógico; nenhum desenvolvimento de observabilidade foi iniciado neste closeout documental.

**HISTORICAL_CORRECT / SUPERSEDED — entrada F24.4F:** F24.4E está [CLOSED / INTEGRATED pelo PR #178 em 05/10/2026](../review/F24_4E_CONFLICT_RESOLUTION_CONTRACT.md#estado-operacional-atual)
no baseline `main@bc84040d17e704b30df4c5f34f9d20337d54a631`: guard Lote→Pasto corrigido,
deferments G2/G6/G7 preservados e F24.4F READY_TO_START no mesmo baseline.
Este rebaseline documental não inicia F24.4F nem executa deploy ou migration remota. A certificação do guard não
certifica CAS de lote/occupancy ou G3 global.

O fechamento E2 é restrito a Animal→Lote; não certifica Lote→Pasto, occupancy ou
correção de movimento. A entrega está integrada pelo PR #175 (`MERGED`)
no baseline atual `main@1456de00a8b19f555e99a3541394ec5cc97db797`, sem iniciar nova subfase.
O [plano ativo](../review/ACTIVE_PHASE_PLAN.md) mantém os demais itens não certificados.

```txt
Fase 23 — Simulação Produtiva e Comercial — CLOSED
→ F24.0 — Release Readiness Baseline & Gap Audit — CLOSED
→ F24.1 — Production Migration Delta & Provenance — TECHNICAL CLOSED / REPOSITORY CLOSEOUT
→ F24.2 — Offline/Sync/Auth/Ownership Hardening — CLOSED
→ F24.3 — Offline Prolongado + Reconnect + Recovery — CLOSED
→ F24.4A — Conflict Inventory / Characterization — CLOSED
→ F24.4B — Concurrent Event Writes — CLOSED
→ F24.4C — State Conflict Policy — CLOSED (PR #169; `3b7ac50ed878d8d8d4b88874ad98c9d98816149b`)
→ F24.4D — Cross-device Offline/Reconnect + Clock Authority — CLOSED (branch `feat/f24-4d-cross-device-clock-authority`; `faddf64`)
→ F24.4E — Conflict Resolution Contract — CLOSED / INTEGRATED (PR #178)
  E1 — animais CAS/tombstone — INTEGRATED (PR #173)
  E2 — Animal→Lote — CLOSED / INTEGRATED (PR #175); G3 Animal→Lote — RESOLVED
→ F24.4F — Integrated Certification — CLOSED / INTEGRATED (PR #181)
→ F24.4 — Multi-device + Conflitos — CLOSED / INTEGRATED
→ F24.5 — Observabilidade — IN_PROGRESS
  F24.5A — Inventory / Observability Baseline — READY_FOR_REVIEW (review APPROVED)
  F24.5B — Structured Diagnostics — NEXT / READY_TO_START (abertura lógica)
→ F24.6 — Performance / Escala — NOT_STARTED
→ F24.7 — Sanitário v2 — NOT_STARTED (blocker stale CLOSED em 05/10/2026; certificação completa pendente)
→ F24.8 — Production Readiness — BLOCKED_BY_PREREQUISITES
```

A Fase 21 encerrou com duas verticais distintas e explicáveis sobre read models existentes, sem persistência de recomendação nem ação factual. A Fase 22 está concluída e formalmente encerrada (**CLOSED**): F22A.1–F22A.3 implementam peso/GMD qualificado e F22A adotada canonicamente na Home (sem ranking, sem uso operacional); F22B.1/F22B.2 implementam coverage e resultado observado qualificado adotados com ressalva de não demonstração de lucro completo; a F22C está fechada com histórico animal→lote, composição animal→pasto, duração, agregação e performance observada factual adotados com coverage e não-autorização explícitos nos consumidores compatíveis.

A Fase 19 implementou foundations tipográficas e semânticas, branding reutilizável, primitives estruturais e shell/navegação responsivos sobre o contrato da F18. Home, Animais, AnimalDetalhe, Registrar e Agenda foram revalidados sem migração ampla em 390, 768, 1024 e 1440 px, light/dark; nenhum P0 novo foi confirmado e o P0 do Registrar permanece resolvido.

A Fase 20 migrou as cinco jornadas críticas para os padrões compartilhados, com validação autenticada completa em quatro viewports e dois temas. Selectors, filtros, bulk, writers, Evento, Agenda, `state_*`, persistência e sync permaneceram inalterados; P0 novo = 0. Dívidas não bloqueantes seguem destinadas às fases de produto correspondentes.

## Roadmap 18–24 — limites

- **Fase 18 — Rebaseline Visual 360°:** auditoria e inventário visual, Design System documental e matriz de migração P0–P3.
- **Fase 19 — Foundations + Shell + Branding:** foundations visuais, shell da aplicação e identidade de marca.
- **Fase 20 — Jornadas UX Críticas:** Home, Animais, AnimalDetalhe, Registrar e Agenda.
- **Trilha D — UX/UI Rebaseline 2.0 (D0–D6):** consolidação definitiva dos tokens semânticos, shell, componentes canônicos e redesign dirigido das 9 superfícies prioritárias (PRs #122, #125, #126, #127 e #128). A iniciativa visual está formalmente encerrada e o foco retorna às trilhas funcionais/técnicas; melhorias posteriores de UX devem ser tratadas como demandas novas.
- **Fase 21 — Inteligência Operacional v2:** evolução da inteligência operacional reutilizando `MetricResult` e `DecisionRecommendation`.
- **Fase 22 — Eficiência Produtiva e Econômica:** produtividade e economia (CLOSED); GMD observado com confiabilidade não classificada e uso operacional não autorizado; resultado econômico observado com lucro completo bloqueado; ocupação qualificada histórica adotada.
- **Fase 23 — Simulação Produtiva e Comercial:** simulações com premissas explícitas; projeção não é fato e simulação não é autorização comercial (CLOSED).
- **Fase 24 — Release Hardening / Scale Readiness:** F24.2 e F24.3 encerradas; multi-device/conflitos, observabilidade, performance, certificação sanitária completa e production readiness seguem em F24.4–F24.8, conforme o [closeout F24.3](../review/F24_3_CLOSEOUT_AND_NEXT_PHASE_PLAN.md). `REAL_PROCESS_KILL = NOT_PROVEN` permanece dívida E2E sem reabrir a F24.3.

Hardening proporcional permanece obrigatório em cada fase. A Fase 24 concentra o hardening sistêmico final para escala. Fases encerradas só reabrem diante de regressão concreta.

## Risco de rollout

`SANITARIO_V2_E2E_PLATFORM_BLOCKED = CLOSED` em 05/10/2026 após PT409, PostgREST 14.18 e E2E remoto stale de `replace_agenda_animals`. Historicamente, `40001` não retornava pelo transporte antes do timeout. Ver [evidência canônica](../context/PROJECT_STATUS.md#recertificação-remota-stale-sanitário-v2--05102026).

Gate remoto `OFF`, flag `false`, rollout `NOT_AUTHORIZED` e importação real não autorizada permanecem preservados. As demais RPCs e a regressão completa não foram recertificadas; F24 segue em andamento.

## Fases anteriores

Fases 1 a 12 e a Fase 11.5 permanecem concluídas conforme seus relatórios e evidências. A ausência de autorização de rollout sanitário permanece registrada separadamente e não altera essa sequência de desenvolvimento.

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
| 21 | Inteligência Operacional v2 | **Concluída**; V1, V2 e consolidação integradas |
| 22 | Eficiência Produtiva e Econômica | **Gates F22A.4 e F22B.3 fechados; F22C fechada com histórico, duração, agregação e performance observada implementados**; lucro completo permanece bloqueado e novo incremento exige capacidade de produto explicitamente autorizada |
| 23 | Simulação Produtiva e Comercial | Premissas explícitas e separação entre projeção, fato e autorização |
| 24 | Release Hardening / Scale Readiness | **F24.4 / F24.4F closed / integrated; PR #181 MERGED; F24.5 in progress; F24.5A READY_FOR_REVIEW; F24.5B NEXT; produção não provisionada** |
