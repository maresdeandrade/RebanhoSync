# Roadmap do Produto

> **Status:** Derivado (Rev D+)
> **Baseline:** `b69d35f`
> **Ultima Atualizacao:** 2026-04-07
> **Derivado por:** Auditoria técnica — estado pós-fechamento de todos os TDs originais
> **Fonte:** `TECH_DEBT.md`, `IMPLEMENTATION_STATUS.md`

---

## Contexto

Todos os milestones do roadmap anterior (M0, M1, M2) foram concluídos via migrations de março/2026. O capability score analítico está em 19/19 = 100%. O projeto está em fase de **beta interno**.

O roadmap atual cobre a próxima fase: consolidação de observabilidade, UX de catálogos e cobertura de testes dos fluxos mais recentes.

---

## Milestone 3: Observabilidade e Instrumentação Remota

**Objetivo:** tornar visíveis os erros de sync e o comportamento do produto em campo.

**Derivado de:** TD-021

### Escopo

- Avaliar e implementar Edge Function de coleta de `metrics_events`
- Ou integrar com Supabase Analytics / logs
- Dashboard de sync health por fazenda (rejeições, gestos pendentes, taxa de erro)

### Entregáveis

- [ ] Definir estratégia de telemetria remota (Edge Function vs Analytics)
- [ ] Implementar upload periódico ou webhook de erros críticos
- [ ] Dashboard simples para visualização de health de sync

---

## Milestone 4: UX do Catálogo de Produtos Veterinários

**Objetivo:** fechar a lacuna entre o catálogo de `produtos_veterinarios` criado no DB e a experiência do usuário.

**Derivado de:** TD-022

### Escopo

- Integrar `produtos_veterinarios` como autocomplete no formulário sanitário de `Registrar.tsx`
- Garantir que o catálogo é carregável offline (pull via sync ou seed local)

### Entregáveis

- [ ] Verificar estratégia de acesso: Supabase direto (somente online) ou pull para Dexie
- [ ] Implementar autocomplete de produto em `Registrar.tsx` (sanitário)
- [ ] Testar fluxo offline-fallback: o usuário pode registrar sem conexão?

---

## Milestone 5: Cobertura E2E do Fluxo Reprodutivo Completo

**Objetivo:** garantir cobertura automática do fluxo parto → pós-parto → cria.

**Derivado de:** TD-023

### Escopo

- Criar testes guiados para `AnimalPosParto.tsx` e `AnimalCriaInicial.tsx`
- Cobrir: registro de identificação final, lote inicial, pesagem neonatal, gesto atômico

### Entregáveis

- [ ] `src/pages/__tests__/AnimalPosParto.e2e.test.tsx`
- [ ] `src/pages/__tests__/AnimalCriaInicial.e2e.test.tsx`
- [ ] Atualizar `package.json:test:e2e` com os novos testes

---

## Derivação

| TD | capability_id | Track | Milestone |
| --- | --- | --- | --- |
| TD-021 | `infra.observabilidade` | Infra | Milestone 3 |
| TD-022 | `sanitario.registro` | Catalog | Milestone 4 |
| TD-023 | `reproducao.registro` | Tests | Milestone 5 |

---

## Histórico de Milestones Concluídos

| Milestone | Escopo | Status |
| --- | --- | --- |
| M0 | DLQ auto-purge (TD-001) | ✅ Concluído |
| M1 | RBAC hardening (TD-003), FKs (TD-019, TD-020), catálogo (TD-011), peso (TD-014) | ✅ Concluído |
| M2 | Índices (TD-004), GMD view (TD-015) | ✅ Concluído |

---

## Veja Também

- [TECH_DEBT.md](./TECH_DEBT.md)
- [E2E_MVP.md](./E2E_MVP.md)
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
