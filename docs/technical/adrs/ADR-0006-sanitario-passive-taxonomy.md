# ADR-0006: Taxonomia Sanitaria Passiva

> **Status:** Accepted
> **Data:** 2026-04-27
> **Contexto:** Saneamento sanitario P1
> **Autores:** Codex + revisao tecnica

## Contexto

O dominio sanitario usava campos legados como `tipo`, `categoria`, `area`, `gera_agenda` e metadados variados para expressar protocolo, materializacao, compliance e requisitos regulatorio-documentais.

## Decisao

Introduzir taxonomia sanitaria passiva e retrocompativel:

- `ProtocolKind`
- `MaterializationMode`
- `ComplianceKind`

Os mappers em `src/lib/sanitario/models/taxonomy.ts` normalizam leitura e classificacao, mas nao alteram regra de negocio, payload persistido, dedup, calendario ou materializacao.

## Alternativas consideradas

- Criar taxonomia persistida imediatamente: descartado por exigir migration/contrato novo.
- Remover campos legados: descartado por quebrar compatibilidade.
- Deixar sem taxonomia: descartado por manter ambiguidade semantica.

## Consequencias

- Campos legados continuam aceitos.
- Ambiguidades caem em fallback seguro (`outro`, `none`) quando o codigo atual nao sustenta classificacao mais forte.
- Novas regras de materializacao nao devem ser inferidas apenas da taxonomia passiva.

## Evidencias e referencias

- `src/lib/sanitario/models/domain.ts`
- `src/lib/sanitario/models/taxonomy.ts`
- `src/lib/sanitario/__tests__/taxonomy.test.ts`
- `docs/ARCHITECTURE.md`

## Plano de rollout

- Usar a taxonomia para leitura e organizacao gradual.
- So promover taxonomia para contrato persistido com ADR/migration/testes especificos.
