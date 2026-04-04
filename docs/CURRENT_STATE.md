# Estado Atual do Repositorio

> **Status:** Derivado (Snapshot Operacional)
> **Fonte de Verdade:** `src/`, `supabase/`, `package.json`
> **Ultima Atualizacao:** 2026-04-01

## Resumo

O repositorio esta em um ponto de **MVP operacional em consolidacao**, agora com o ciclo reprodutivo e o pos-parto muito mais aderentes ao uso de campo. A base tecnica principal segue funcional: aplicacao React, banco local Dexie, sync offline-first, schema Supabase com RLS, automacao de build/test/lint e um conjunto relevante de testes automatizados.

Nos ultimos ciclos, o produto foi reorientado para uma proposta mais aderente ao pequeno e medio produtor, com foco em simplicidade operacional, onboarding inicial, importacao de dados, relatorios simples e um modulo reprodutivo dedicado por matriz, parto e pos-parto.

## Camadas ja consolidadas

- Home orientada a operacao diaria.
- Onboarding inicial da fazenda.
- Importacao CSV para animais, lotes e pastos.
- Registro rapido de manejos principais em `Registrar`.
- Dashboard reprodutivo dedicado.
- Ficha reprodutiva por matriz.
- Pos-parto neonatal para crias recem-geradas.
- Ficha do animal com vinculos mae/cria e curva de peso.
- Lista de animais agrupando matriz e cria na mesma leitura.
- Badges visuais por estagio de vida do animal usando icone base + modificadores.
- Regra de elegibilidade reprodutiva alinhada com categoria: somente novilhas e vacas entram no fluxo.
- Relatorios operacionais com exportacao/impressao.
- Telemetria local de piloto e dashboard de uso.
- Modo de experiencia por fazenda (`essencial` vs `completo`).

## Estado tecnico

- `pnpm run lint`: verde
- `pnpm test`: verde
- `pnpm run build`: verde
- `pnpm run test:e2e`: cobre onboarding, importacoes e relatorios

## Destaques recentes de produto

- `parto` gera as crias localmente e redireciona para uma etapa dedicada de pos-parto.
- O pos-parto permite confirmar identificacao final, lote inicial e primeira pesagem neonatal em um gesto atomico.
- A superficie de reproducao passou a respeitar a classificacao do rebanho, evitando uso do fluxo em bezerras.
- A navegacao do rebanho ficou mais legivel para operacao diaria com agrupamento familiar e simbolismo visual por fase.

## Lacunas mais importantes

- Hardening restante de integridade/RLS documentado em `TECH_DEBT.md`.
- Telemetria ainda local-first, sem observabilidade remota estruturada.
- O pacote automatizado `test:e2e` ainda nao cobre o fluxo novo de pos-parto neonatal.
- Bundle ainda com aviso conhecido de `caniuse-lite` desatualizado no build.

## Leitura recomendada para retomada

1. `README.md`
2. `ARCHITECTURE.md`
3. `OFFLINE.md`
4. `STACK.md`
5. `ROUTES.md`
6. `TECH_DEBT.md`
