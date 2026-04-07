# Divida Tecnica

> **Status:** Derivado (Rev D+)
> **Baseline:** `f78dbb4`
> **Ultima Atualizacao:** 2026-03-31
> **Derivado por:** Atualizacao manual a partir de `IMPLEMENTATION_STATUS.md` e do codigo atual
> **Fonte:** `IMPLEMENTATION_STATUS.md`, `src/`, `supabase/`

Lista consolidada dos gaps ainda abertos no repositorio.

## OPEN (Catalog)

<<<<<<< HEAD
> Estes itens participam do `gap_set` analitico e da derivacao para o roadmap.
=======
## CLOSED (Catalog)
>>>>>>> 622305ac3129954abf36b809730ef8929a0263b5

### TD-011: Produtos sanitarios em texto livre

- **capability_id:** `sanitario.registro`
<<<<<<< HEAD
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
=======
- **Domínio:** sanitario
- **Risco:** Consistência (Typos, duplicatas)
- **Status:** ✅ **CLOSED**
- **Evidência:** `eventos_sanitario.produto` é TEXT sem normalização.
- **Ação:** (Opcional/Nice-to-Have) Criar catálogo básico `produtos_veterinarios`.
- **Critério de Aceite:**
  - [ ] UI sugere produtos comuns (autocomplete).
  - [ ] Relatórios não quebram por typos.
  - **Fluxo E2E:** Hardening de Eventos (Fluxo 6)

#### TD-019: Foreign Keys Faltantes (Movimentação)

- **capability_id:** `movimentacao.registro`
- **Domínio:** movimentacao
- **Risco:** Integridade Referencial
- **Status:** ✅ **CLOSED**
- **Evidência:** `eventos_movimentacao` (from/to_lote_id) sem FOREIGN KEY.
- **Ação:** Adicionar FKs `eventos_movimentacao(from_lote_id) → lotes(id)` e `to_lote_id`.
- **Critério de Aceite:**
  - [ ] FK constraints impedem referências inválidas.
  - [ ] Migrations reversíveis (rollback seguro).
  - **Fluxo E2E:** Operacional (Fluxo 7)

#### TD-020: Foreign Key macho_id Faltante (Reprodução)

- **capability_id:** `reproducao.registro`
- **Domínio:** reproducao
- **Risco:** Integridade Referencial
- **Status:** ✅ **CLOSED**
- **Evidência:** `eventos_reproducao.macho_id` sem FOREIGN KEY para `animais`.
- **Ação:** Adicionar FK `eventos_reproducao(macho_id) → animais(id)`.
- **Critério de Aceite:**
  - [ ] FK constraint impede referências inválidas.
  - [ ] Migrations reversíveis.
  - **Fluxo E2E:** Operacional (Fluxo 7)

---

### 🟡 P2 (Melhoria - 1 item)

#### TD-015: Cálculo de GMD em Memória

- **capability_id:** `pesagem.historico`
- **Domínio:** pesagem
- **Risco:** Scalability
- **Status:** ✅ **CLOSED**
- **Evidência:** Dashboard carrega todo histórico para calcular ganho médio.
- **Ação:** Materializar GMD no evento ou criar View agregada.
- **Critério de Aceite:**
  - [ ] Dashboard carrega em < 2s com 5000 animais.
  - **Fluxo E2E:** Operacional (Fluxo 7)
>>>>>>> 622305ac3129954abf36b809730ef8929a0263b5

### TD-019: Foreign keys faltantes em movimentacao

<<<<<<< HEAD
- **capability_id:** `movimentacao.registro`
- **Dominio:** movimentacao
- **Risco:** integridade referencial
- **Status:** OPEN
- **Evidencia:** referencias `from_lote_id` e `to_lote_id` continuam sem FK forte no schema
- **Acao sugerida:** adicionar FKs compostas e revisar migrations com rollback seguro
=======
## CLOSED (Infra/Out-of-catalog)
>>>>>>> 622305ac3129954abf36b809730ef8929a0263b5

### TD-020: Foreign key faltante para `macho_id` na reproducao

- **capability_id:** `reproducao.registro`
- **Dominio:** reproducao
- **Risco:** integridade referencial
- **Status:** OPEN
- **Evidencia:** `eventos_reproducao.macho_id` ainda sem FK forte para `animais`
- **Acao sugerida:** adicionar FK composta tenant-safe e validar migrations

### OPEN (Infra/Out-of-catalog)

<<<<<<< HEAD
> Estes itens ficam fora do capability score, mas seguem relevantes para hardening da base.
=======
- **capability_id:** `infra.rbac_hardening` _(NEW Proposed — fora do Catalog)_
- **Domínio:** platform
- **Risco:** Integridade de Dados (Cowboy pode deletar animais)
- **Status:** ✅ **CLOSED**
- **Evidência:** Policy `DELETE` em `animais` não filtra por role.
- **Ação:** Adicionar `WHERE role IN ('owner', 'manager')` na policy DELETE.
- **Critério de Aceite:**
  - [ ] Cowboy recebe erro 403 ao tentar DELETE animal.
  - [ ] Owner/Manager conseguem DELETE normalmente.
  - **Fluxo E2E:** RBAC (Fluxo 1)
>>>>>>> 622305ac3129954abf36b809730ef8929a0263b5

### TD-003: DELETE de animais ainda sem restricao adequada por role

- **capability_id:** `infra.rbac_hardening`
- **Dominio:** platform
- **Risco:** perda indevida de dados
- **Status:** OPEN
- **Evidencia:** a policy de DELETE em `animais` ainda nao foi endurecida para `owner/manager`
- **Acao sugerida:** restringir DELETE e validar fluxo RBAC no backend

### TD-004: Indices compostos de performance ainda faltantes

<<<<<<< HEAD
- **capability_id:** `infra.indexes`
- **Dominio:** platform
- **Risco:** degradacao de performance em volume alto
- **Status:** OPEN
- **Evidencia:** consultas agregadas e dashboards ainda dependem de indices parciais/incompletos
- **Acao sugerida:** criar indices compostos e medir consultas principais
=======
- **capability_id:** `infra.indexes` _(NEW Proposed — fora do Catalog)_
- **Domínio:** platform
- **Risco:** Scalability
- **Status:** ✅ **CLOSED**
- **Evidência:** Queries de dashboard sem índices compostos.
- **Ação:** Criar índices `(fazenda_id, occurred_at)`, `(animal_id, occurred_at)`.
- **Critério de Aceite:**
  - [ ] Dashboard carrega em < 2s com 5000 animais.
  - **Fluxo E2E:** Operacional (Fluxo 7)
>>>>>>> 622305ac3129954abf36b809730ef8929a0263b5

## CLOSED (Recentes)

- TD-001: limpeza de `queue_rejections`
- TD-006: UI de nutricao
- TD-008: anti-teleporte no frontend
- TD-014: validacao de peso no frontend

## CLOSED (Outros)

- TD-021: Telemetria remota estruturada e observabilidade básica (sync_batch health, sync_backlog) implementada via Edge Function (`telemetry-ingest`) no background flush.

## Resumo

- OPEN Catalog: `TD-011`, `TD-015`, `TD-019`, `TD-020`
- OPEN Infra: `TD-003`, `TD-004`
- Total OPEN: `6`

## Veja Tambem

- [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- [ROADMAP.md](./ROADMAP.md)
