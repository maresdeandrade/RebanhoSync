# Divida Tecnica

> **Status:** Derivado (Rev D+)
> **Baseline:** `f78dbb4`
> **Ultima Atualizacao:** 2026-03-31
> **Derivado por:** Atualizacao manual a partir de `IMPLEMENTATION_STATUS.md` e do codigo atual
> **Fonte:** `IMPLEMENTATION_STATUS.md`, `src/`, `supabase/`

Lista consolidada dos gaps ainda abertos no repositorio.

## OPEN (Catalog)

> Estes itens participam do `gap_set` analitico e da derivacao para o roadmap.

### TD-011: Produtos sanitarios em texto livre

- **capability_id:** `sanitario.registro`
- **Dominio:** sanitario
- **Risco:** consistencia de dados e qualidade de relatorio
- **Status:** OPEN
- **Evidencia:** `eventos_sanitario.produto` segue livre; o fluxo de registro continua aceitando texto manual em `src/pages/Registrar.tsx`
- **Acao sugerida:** introduzir catalogo simples ou autocomplete com normalizacao

### TD-015: GMD e historico agregados no cliente

- **capability_id:** `pesagem.historico`
- **Dominio:** pesagem
- **Risco:** escalabilidade e latencia em rebanhos maiores
- **Status:** OPEN
- **Evidencia:** leitura de peso e GMD ainda depende de carga local do historico em `src/pages/AnimalDetalhe.tsx` e `src/pages/Dashboard.tsx`
- **Acao sugerida:** view agregada, coluna derivada ou precomputo no backend

### TD-019: Foreign keys faltantes em movimentacao

- **capability_id:** `movimentacao.registro`
- **Dominio:** movimentacao
- **Risco:** integridade referencial
- **Status:** OPEN
- **Evidencia:** referencias `from_lote_id` e `to_lote_id` continuam sem FK forte no schema
- **Acao sugerida:** adicionar FKs compostas e revisar migrations com rollback seguro

### TD-020: Foreign key faltante para `macho_id` na reproducao

- **capability_id:** `reproducao.registro`
- **Dominio:** reproducao
- **Risco:** integridade referencial
- **Status:** OPEN
- **Evidencia:** `eventos_reproducao.macho_id` ainda sem FK forte para `animais`
- **Acao sugerida:** adicionar FK composta tenant-safe e validar migrations

### OPEN (Infra/Out-of-catalog)

> Estes itens ficam fora do capability score, mas seguem relevantes para hardening da base.

### TD-003: DELETE de animais ainda sem restricao adequada por role

- **capability_id:** `infra.rbac_hardening`
- **Dominio:** platform
- **Risco:** perda indevida de dados
- **Status:** OPEN
- **Evidencia:** a policy de DELETE em `animais` ainda nao foi endurecida para `owner/manager`
- **Acao sugerida:** restringir DELETE e validar fluxo RBAC no backend

### TD-004: Indices compostos de performance ainda faltantes

- **capability_id:** `infra.indexes`
- **Dominio:** platform
- **Risco:** degradacao de performance em volume alto
- **Status:** OPEN
- **Evidencia:** consultas agregadas e dashboards ainda dependem de indices parciais/incompletos
- **Acao sugerida:** criar indices compostos e medir consultas principais

## CLOSED (Recentes)

- TD-001: limpeza de `queue_rejections`
- TD-006: UI de nutricao
- TD-008: anti-teleporte no frontend
- TD-014: validacao de peso no frontend

## Resumo

- OPEN Catalog: `TD-011`, `TD-015`, `TD-019`, `TD-020`
- OPEN Infra: `TD-003`, `TD-004`
- Total OPEN: `6`

## Veja Tambem

- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- [ROADMAP.md](./ROADMAP.md)
