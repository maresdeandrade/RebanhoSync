# Roadmap do Produto

> **Status:** Derivado (Rev D+)
> **Baseline:** `f78dbb4`
> **Ultima Atualizacao:** 2026-03-31
> **Derivado por:** Atualizacao manual derivada de `TECH_DEBT.md OPEN`
> **Fonte:** `TECH_DEBT.md`, `IMPLEMENTATION_STATUS.md`

Este roadmap foi reorientado para o estado atual do repositorio: base funcional, produto mais simples para pequeno e medio produtor e backlog concentrado em hardening e consistencia.

## Principio

O core operacional ja existe. O roadmap atual nao e de expansao ampla de escopo; ele e de consolidacao da base e eliminacao dos gaps abertos.

## Milestone 1: Hardening de integridade e seguranca

**Objetivo:** remover os riscos mais diretos de integridade e permissao.

### Escopo

- TD-003 (`infra.rbac_hardening`)
- TD-019 (`movimentacao.registro`)
- TD-020 (`reproducao.registro`)

### Entregaveis

- endurecer DELETE por role em `animais`
- adicionar FKs em movimentacao
- adicionar FK de `macho_id` em reproducao
- validar essas mudancas nos fluxos operacionais e RBAC

## Milestone 2: Consistencia de dados de operacao

**Objetivo:** reduzir ruido e divergencia na captura de dados do campo.

### Escopo

- TD-011 (`sanitario.registro`)

### Entregaveis

- autocomplete ou catalogo simples de produtos sanitarios
- reducao de typos e duplicidades sem quebrar o fluxo rapido de registro

## Milestone 3: Escala de leitura e agregacao

**Objetivo:** melhorar a performance das leituras analiticas e historicas.

### Escopo

- TD-015 (`pesagem.historico`)
- TD-004 (`infra.indexes`)

### Entregaveis

- estrategia de GMD/historico sem agregacao pesada no cliente
- indices compostos para consultas de dashboard, historico e relatorios
- benchmarks em base volumosa

## Derivacao

| TD | capability_id | Track | Milestone |
| --- | --- | --- | --- |
| TD-003 | `infra.rbac_hardening` | Infra | Milestone 1 |
| TD-004 | `infra.indexes` | Infra | Milestone 3 |
| TD-011 | `sanitario.registro` | Catalog | Milestone 2 |
| TD-015 | `pesagem.historico` | Catalog | Milestone 3 |
| TD-019 | `movimentacao.registro` | Catalog | Milestone 1 |
| TD-020 | `reproducao.registro` | Catalog | Milestone 1 |

## Resultado esperado

Ao final dessas tres frentes, o repositorio fica mais coerente com o momento do produto: um MVP operacional confiavel, com menos risco de integridade, menos ruido de captura e melhor comportamento em escala.

## Veja Tambem

- [TECH_DEBT.md](./TECH_DEBT.md)
- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
