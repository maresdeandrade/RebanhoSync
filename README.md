# RebanhoSync

Plataforma **offline-first** para gestão pecuária de corte. Multi-tenant por fazenda, RBAC (`owner | manager | cowboy`), sincronização transacional por gestos e backend Supabase com RLS hardened.

> **Estado atual:** Beta interno — MVP completo e operacional.  
> **Fase atual:** Transicao de MVP funcional para SLC (Simple, Lovable, Complete) em consolidacao.  
> Todos os 8 domínios operacionais já estão implementados. Qualidade local verde (`lint`, `test`, `build`).

---

## Estado atual

O produto já está funcional para uso interno controlado, com escopo principal implementado e fluxos operacionais consolidados.

A frente atual de engenharia não é de expansão de escopo funcional, e sim de **consolidacao operacional** apos o hardening estrutural principal dos hotspots de UI criticos.

Prioridade do momento:
- preservar comportamento atual
- reduzir friccao de uso nos fluxos centrais
- aumentar consistencia visual e de feedback
- manter a refatoracao visual orientada a acao: execucao primeiro, gestao/telemetria depois
- estabilizar confiabilidade e regressao nos fluxos de producao
- remover residuos estruturais pontuais sem reabrir monolitos

---

## Semantica Operacional Consolidada

- `Registrar`: abre fluxo completo (formulario) e registra evento ao salvar.
- `Executar`: registra evento imediato (acao direta).
- `Encerrar`: fecha pendencia na agenda sem gerar evento.
- `Aplicar protocolo`: recalcula/materializa agenda e nao gera evento.
- `Seguir pos-parto` / `Seguir rotina da cria`: continuidade guiada de reproducao.
- Termos ambiguos legados sao proibidos em copy de UI: `Concluir direto`, `Abrir proxima acao`, `Abrir registro detalhado`, `Executar direto`.

Regra de regressao semantica:
- `tests/smoke/semantic_terms_guard.smoke.test.ts` bloqueia merge quando termos proibidos reaparecem.

---

## Invariantes de Execucao (Idempotencia)

- `1 acao -> 1 createGesture`.
- Handlers de acao devem ter guarda de reentrada/concorrencia para evitar clique duplo e corrida.
- Fluxos centrais devem preservar `1 acao -> 1 resultado -> 1 navegacao`.

---

## Escopo implementado

- Gestão de animais, lotes, pastos, contrapartes e categorias zootécnicas.
- Registro de eventos: sanitário, pesagem, nutrição, movimentação, reprodução, financeiro e avaliações/rondas de pasto.
- Agenda operacional com protocolos, deduplicação automática e recálculo sanitário liderado por SQL/RPC; recompute por protocolo/config está validado com mais clareza do que disparo automático por mutação de animal.
- Motor sanitário com materialização/recompute liderados por SQL/Supabase, contratos TS protegidos por golden tests, calendário TS->SQL alinhado e dedup canônico estruturado.
- Boundary sanitário do Registrar encerrado no recorte estrutural atual: `src/pages/Registrar/**` não importa `@/lib/sanitario/engine/*`; labels visuais passam por facade em `src/lib/sanitario/models/calendarDisplay.ts`.
- Onboarding guiado da fazenda e importação CSV de animais, lotes e pastos.
- Manejo de pastagens com ficha técnica agronômica, ocupações materializadas e ronda de pasto como fato histórico append-only.
- Módulo reprodutivo completo: cobertura/IA → diagnóstico → parto → pós-parto → cria inicial.
- Ficha do animal com vínculos mãe/cria, curva de peso e timeline de eventos.
- Lista de animais agrupando matriz e cria com badge visual por estágio de vida.
- Refatoração visual SLC aplicada em duas passagens: Home tática, Registrar orientado por intenção, Animais card-first, Lotes/Pastos/Reprodução/Relatórios mais objetivos, seleção de fazenda contextual, filtros compactos e status técnicos rebaixados.
- Transições do rebanho com histórico consolidado.
- Dashboard reprodutivo dedicado e relatórios operacionais com exportação.
- Telemetria de piloto com buffer local em `metrics_events` e flush remoto periódico.
- Taxonomia canônica bovina: 3 eixos derivados em TypeScript, contrato v1 e fixtures canônicas de regressão.
- Central Operacional passiva na Home, consumindo `src/lib/insights/` via adapter/hook read-only em `src/features/operationalInsights/`.
- Módulo de inventário de insumos com tela `/insumos`, entrada inicial/complementar, ajuste auditável, consumo manual vinculado a evento, edição inline, relatórios com CSV/impressão e estoque mínimo/ponto de ressuprimento.
- Terapia de Vaca Seca com elegibilidade mínima, evento manual estruturado, payload `dry_cow_therapy`, recompute SQL condicionado, ativação explícita em protocolo da fazenda, dedup e anti-agenda-zumbi.
- Sistema de convites e gestão de membros.
- Catálogo global de produtos veterinários com seed básico.

---

## Baseline Supabase de desenvolvimento

- A baseline canônica atual de desenvolvimento é `supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql`.
- `supabase/seed.sql` repopula os catálogos sanitários mínimos: protocolos oficiais, itens oficiais, doenças notificáveis e produtos veterinários.
- `supabase/migrations_legacy_pre_baseline/` preserva as migrations antigas como backup documental.
- Shims de compatibilidade pós-squash foram removidos da pasta ativa; testes de contrato agora leem a baseline canônica ou fixtures canônicas de domínio.
- Validação funcional pós-baseline: `node scripts/codex/validate-supabase-baseline-functional.mjs`.
- O handler real de `sync-batch` foi validado localmente; por limitação do gateway local da CLI, a chamada rodou com `functions serve --no-verify-jwt`, mas o handler ainda executou `auth.getUser(jwt)` e operações user-scoped com RLS.

Riscos remanescentes conhecidos: validar o caminho completo do gateway JWT sem `--no-verify-jwt`, manter claro que o seed sanitário é mínimo/técnico e não normativo, e acompanhar timeouts intermitentes já observados em testes UI longos.

Contrato documental recente:
- `docs/review/RebanhoSync_auditoria.md` consolida o contrato validado de fontes de verdade: Agenda é intenção, Evento é fato, `state_*` é estado atual/read model, Protocolo é regra e marcadores/sinais de insights são apenas auxiliares visuais, não fontes primárias.
- `src/lib/insights/` existe como core puro/read-only de composição operacional, sem IO, Supabase, Dexie, UI, persistência ou relógio interno; a primeira integração passiva consome esse core por `src/features/operationalInsights/` e pela Home.
- Permanecem bloqueados como decisão automatizada: peso atual confiável, carência ativa operacional, pronto para venda/abate, `commercialReadiness.ts` conclusivo, tags/marcadores persistidos como fonte primária, consulta em linguagem natural, IA gerando agenda, IA concluindo execução e motor geral IATF.

---

## Arquitetura operacional em foco

A frente atual de hardening usa a seguinte pipeline como alvo de separação de responsabilidades:

1. **Normalize**
2. **Select / Policy**
3. **Payload**
4. **Plan**
5. **Effects**
6. **Reconcile**

A intenção não é redesenhar o sistema do zero, e sim tornar explícito, por fluxo, o que pertence a:
- saneamento e defaults
- regra de negócio / elegibilidade
- montagem de payload
- plano de mutação
- efeitos / integração
- rollback, idempotência e reconciliação

---

## Hotspots prioritários

A frente atual de hardening estrutural principal em UI foi concluida para:
- `src/pages/Registrar/**`
- `src/pages/Agenda/**`

Frentes prioritarias atuais:

- carencia/rastreabilidade sanitaria como frente pequena e separada
- residuos estruturais locais de `Registrar`/`Agenda` sem reabrir fronteiras ja fechadas
- ajustes incrementais de UX operacional agora devem partir do padrão visual SLC ja aplicado, com validacao em dados reais de beta interno

A ordem atual é:
1. manter guardrails documentais locais e validacao minima continua
2. tratar carencia/rastreabilidade sem misturar com estoque/SISBOV/fiscal
3. validar e lapidar a UX operacional dos fluxos centrais ja compactados
4. estabilizar cobertura de regressao dos fluxos criticos

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite 6 |
| UI | Tailwind CSS + shadcn/ui + Radix UI |
| Formulários | React Hook Form + Zod |
| Dados remotos | Supabase JS + TanStack React Query |
| Offline | Dexie.js + dexie-react-hooks |
| Backend | Supabase (Auth, Postgres, RLS, Edge Functions) |
| Testes | Vitest + Testing Library + fake-indexeddb |
| Deploy | Vercel (frontend) + Supabase (backend) |

> **Nota:** o projeto usa Dexie.js como biblioteca e atualmente opera com schema/store local evoluído, incluindo `metrics_events` para telemetria de piloto.

---

## Scripts principais

```bash
pnpm install
pnpm dev          # servidor local (Vite)
pnpm run lint     # ESLint
pnpm test         # Vitest (unitários + integração)
pnpm run test:unit      # recorte unitário local
pnpm run test:integration # fluxos de integração em tests/integration/**
pnpm run test:hotspots  # subset local de hotspots criticos de UI
pnpm run test:smoke     # smoke critico minimo (tests/smoke/**)
pnpm run quality:gate   # lint + hotspots + integration + smoke
pnpm run build    # build de produção
pnpm run test:e2e       # fluxos guiados: onboarding, importação, relatórios
pnpm run gates          # gates documentais do pacote Antigravity
pnpm run audit:data     # auditoria de contratos de dados
```
