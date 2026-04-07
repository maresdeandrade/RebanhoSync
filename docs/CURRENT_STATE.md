# Estado Atual do Repositorio

> **Status:** Derivado (Snapshot Operacional)
> **Fonte de Verdade:** `src/`, `supabase/`, `package.json`
> **Ultima Atualizacao:** 2026-04-07

## Resumo

O repositorio esta em **beta interno** — MVP completo e operacional. A base técnica principal está funcional e testada: aplicação React19, banco local Dexie v8, sync offline-first com rollback, schema Supabase com RLS endurecida, taxonomia canônica bovina, automação de build/test/lint e conjunto relevante de testes automatizados.

Todos os TDs da lista original foram fechados via migrations de março/2026. Não há bloqueadores para uso interno controlado.

## Camadas Consolidadas

- Home orientada a operação diária.
- Onboarding inicial da fazenda.
- Importação CSV para animais, lotes e pastos.
- Registro rápido de manejos principais em `Registrar`.
- Dashboard reprodutivo dedicado.
- Ficha reprodutiva por matriz.
- Pós-parto neonatal para crias recém-geradas.
- Cria inicial pós-parto com identificação final e pesagem neonatal.
- Transições do rebanho com histórico consolidado.
- Ficha do animal com vínculos mãe/cria e curva de peso.
- Lista de animais agrupando matriz e cria na mesma leitura.
- Badges visuais por estágio de vida com ícone base + modificadores.
- Regra de elegibilidade reprodutiva por categoria.
- Relatórios operacionais com exportação/impressão.
- Telemetria local de piloto (store `metrics_events`, Dexie v8).
- Modo de experiência por fazenda (`essencial` vs `completo`).
- Taxonomia canônica bovina (3 eixos, contrato v1, SQL view, teste de paridade).
- RBAC del animais restrito a owner/manager (TD-003 CLOSED).
- FKs compostas em movimentação e reprodução (TD-019, TD-020 CLOSED).
- View `vw_animal_gmd` para cálculo de GMD server-side (TD-015 CLOSED).
- Catálogo `produtos_veterinarios` com seed básico (TD-011 CLOSED parcialmente).

## Estado Técnico

- `pnpm run lint`: verde
- `pnpm test`: verde
- `pnpm run build`: verde
- `pnpm run test:e2e`: cobre onboarding, importações e relatórios
- Unitários: 25+ arquivos de teste em `src/lib/` e `src/pages/`

## Lacunas Residuais

- Telemetria ainda local-first (TD-021); sem observabilidade remota estruturada.
- `produtos_veterinarios` criado no banco mas autocomplete em `Registrar.tsx` não confirmado (TD-022).
- Fluxo pós-parto e cria inicial sem cobertura no pacote `test:e2e` (TD-023).
- Aviso conhecido de `caniuse-lite` desatualizado no build (cosmético).

## Leitura Recomendada para Retomada

1. `README.md`
2. `ARCHITECTURE.md`
3. `OFFLINE.md`
4. `STACK.md`
5. `ROUTES.md`
6. `TECH_DEBT.md`
