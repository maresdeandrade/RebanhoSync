# RebanhoSync

Plataforma **offline-first** para gestão pecuária de corte. Multi-tenant por fazenda, RBAC (`owner | manager | cowboy`), sincronização transacional por gestos e backend Supabase com RLS hardened.

> **Estado atual:** Beta interno — MVP completo e operacional.  
> **Fase atual:** Transicao de MVP funcional para SLC (Simple, Lovable, Complete) em consolidacao.  
> Todos os 7 domínios operacionais já estão implementados. Qualidade local verde (`lint`, `test`, `build`).

---

## Estado atual

O produto já está funcional para uso interno controlado, com escopo principal implementado e fluxos operacionais consolidados.

A frente atual de engenharia não é de expansão de escopo funcional, e sim de **consolidacao operacional** apos o hardening estrutural principal dos hotspots de UI criticos.

Prioridade do momento:
- preservar comportamento atual
- reduzir friccao de uso nos fluxos centrais
- aumentar consistencia visual e de feedback
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
- Registro de eventos: sanitário, pesagem, nutrição, movimentação, reprodução e financeiro.
- Agenda operacional com protocolos, deduplicação automática e recálculo por trigger.
- Onboarding guiado da fazenda e importação CSV de animais, lotes e pastos.
- Módulo reprodutivo completo: cobertura/IA → diagnóstico → parto → pós-parto → cria inicial.
- Ficha do animal com vínculos mãe/cria, curva de peso e timeline de eventos.
- Lista de animais agrupando matriz e cria com badge visual por estágio de vida.
- Transições do rebanho com histórico consolidado.
- Dashboard reprodutivo dedicado e relatórios operacionais com exportação.
- Telemetria de piloto com buffer local em `metrics_events` e flush remoto periódico.
- Taxonomia canônica bovina: 3 eixos derivados, contrato v1 e view SQL de apoio.
- Sistema de convites e gestão de membros.
- Catálogo global de produtos veterinários com seed básico.

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

- `src/lib/offline/syncWorker.ts`
- `src/pages/ProtocolosSanitarios/**`
- residuos estruturais locais de `Registrar`/`Agenda` (sem reabrir fronteiras ja fechadas)

A ordem atual é:
1. concluir hardening do `syncWorker` com diff local e validável
2. reduzir acoplamentos remanescentes em `ProtocolosSanitarios` sem mudança funcional
3. consolidar UX operacional de fluxos centrais para reduzir carga cognitiva
4. estabilizar cobertura de regressao dos fluxos criticos
5. manter guardrails documentais locais e validação mínima contínua

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
