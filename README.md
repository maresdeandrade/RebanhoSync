# RebanhoSync

Plataforma **offline-first** para gestão pecuária de corte. Multi-tenant por fazenda, RBAC (`owner | manager | cowboy`), sincronização transacional por gestos e backend Supabase com RLS hardened.

> **Estado atual:** Beta interno — MVP completo e operacional.  
> **Foco atual:** Hardening arquitetural operacional.  
> Todos os 7 domínios operacionais já estão implementados. Qualidade local verde (`lint`, `test`, `build`).

---

## Estado atual

O produto já está funcional para uso interno controlado, com escopo principal implementado e fluxos operacionais consolidados.

A frente atual de engenharia não é de expansão de escopo funcional, e sim de **restauração de fronteiras arquiteturais** em hotspots relevantes do fluxo operacional, para tornar o sistema mais previsível, testável e sustentável.

Prioridade do momento:
- preservar comportamento atual
- reduzir acoplamento entre UI, domínio, infraestrutura e reconciliação
- tornar explícita a separação entre etapas da pipeline operacional

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

A frente inicial de refatoração está concentrada em:

- `src/pages/Registrar.tsx`
- `src/lib/offline/syncWorker.ts`

A ordem inicial é:
1. atualizar docs-base
2. registrar baseline/comportamento preservado
3. refatorar piloto do `Registrar`
4. refatorar piloto do `syncWorker`
5. adicionar guardrails de processo

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
pnpm run build    # build de produção