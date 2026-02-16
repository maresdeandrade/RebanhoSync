# Dívida Técnica (Tech Debt)

> **Status:** Derivado (Inventário Reconciliado)
> **Fonte de Verdade:** `IMPLEMENTATION_STATUS.md`, Análises de Eventos (`docs/analysis/*`), Código
> **Última Atualização:** 2026-02-16
> **Última Reconciliação:** 2026-02-16 (commit 5709923)

Lista consolidada de débitos técnicos OPEN, gaps de funcionalidade e riscos do projeto RebanhoSync. Itens marcados como DONE são mantidos por histórico.

---

## 🟥 Prioridade P0 (Crítico - Bloqueia Uso ou Risco Alto)

### TD-001: Limpeza de Queue Rejections (Offline)

- **Domínio:** Offline / Infra
- **Risco:** Storage/Performance (Crescimento infinito no Dexie)
- **Status:** 🔴 **OPEN** (P0)
- **Evidência:** `src/lib/offline/syncWorker.ts` não possui rotina de expurgo.
- **Ação:** Implementar Job ou UI para limpar rejeições antigas (> 7 dias).
- **Critério de Aceite:**
  - [ ] Ao abrir o app, rejeições com `created_at < now - 7 days` devem ser removidas do Dexie.
  - [ ] Usuário deve ter botão "Limpar Lista" na tela de Sync Debug.

### TD-006: UI de Nutrição Inexistente

- **Domínio:** Nutrição
- **Risco:** Usabilidade (Feature inacessível)
- **Status:** 🔴 **OPEN** (P0)
- **Evidência:** `eventos_nutricao` existe no DB, mas não há form em `/registrar`.
- **Ação:** Criar formulário de registro de nutrição.
- **Critério de Aceite:**
  - [ ] Rota `/registrar` exibe opção "Nutrição".
  - [ ] App persiste `eventos` + `eventos_nutricao`.
  - [ ] Sync envia dados corretamente.

### TD-007: UI de Reprodução Inexistente ~~(RESOLVIDO)~~

- **Domínio:** Reprodução
- **Risco:** Usabilidade (Feature inacessível)
- **Status:** ✅ **DONE** (2026-02-16)
- **Evidência Implementação:**
  - `src/components/events/ReproductionForm.tsx` (Component dedicado)
  - `src/pages/Registrar.tsx:L1461-1469` (Integração)
  - `src/pages/Registrar.tsx:L729-782` (Event builder)
  - `src/lib/reproduction/*` (Módulo completo: linking.ts, status.ts, categorias.ts)
  - `migrations/0035_reproducao_hardening_v1.sql` (Validações server-side)
  - `src/pages/ReproductionDashboard.tsx` (Dashboard)
- **Ação Original:** Criar formulário de registro (Cobertura/Diagnóstico/Parto).
- **Critério de Aceite:**
  - [x] Rota `/registrar` exibe opções reprodutivas.
  - [x] Registro de Parto cria vínculo mãe/filho (via episode linking).
  - [x] Tipos implementados: cobertura, IA, diagnostico, parto.
  - [x] Validações de linking e status computation.

### TD-008: Validação de Movimentação (Anti-Teleporte Local)

- **Domínio:** Movimentação
- **Risco:** Integridade de Dados
- **Status:** 🔴 **OPEN** (P0)
- **Evidência:** `sync-batch` valida, mas UI permite selecionar lote origem == destino.
- **Ação:** Bloquear no Frontend seleção de destino igual à origem.
- **Critério de Aceite:**
  - [ ] Select de destino remove/desabilita o lote de origem.
  - [ ] Tentativa de submissão com origem==destino falha antes do envio.

---

## 🟧 Prioridade P1 (Importante - Afeta Qualidade/Ops)

### TD-003: Hard Delete de Animais por Cowboy

- **Domínio:** Segurança / RBAC
- **Risco:** Perda de Dados
- **Status:** 🟠 **OPEN** (P1)
- **Evidência:** RLS atual permite DELETE em `animais` para role `cowboy`.
- **Ação:** Atualizar Policy SQL para restringir DELETE a `owner` e `manager`.
- **Critério de Aceite:**
  - [ ] Usuário `cowboy` recebe 403/Risco ao tentar deletar animal via SQL ou App.
  - [ ] Usuário `owner` consegue deletar.

### TD-011: Produto Sanitário como Texto Livre

- **Domínio:** Sanitário
- **Risco:** Relatórios inconsistentes
- **Status:** 🟠 **OPEN** (P1)
- **Evidência:** `eventos_sanitario.produto` é `TEXT`.
- **Ação:** Criar catálogo `produtos_veterinarios` e usar FK ou Autocomplete estrito.
- **Critério de Aceite:**
  - [ ] Tabela `produtos_veterinarios` criada.
  - [ ] UI de registro exige seleção de produto válido.

### TD-014: Validação Frontend de Pesagem

- **Domínio:** Pesagem
- **Risco:** UX / Erro de Banco
- **Status:** 🟠 **OPEN** (P1)
- **Evidência:** Frontend converte vazio para 0 ou NaN, banco rejeita `CHECK (peso > 0)`.
- **Ação:** Validar input > 0 antes do submit.
- **Critério de Aceite:**
  - [ ] Campo de peso exibe erro se valor <= 0.
  - [ ] Botão salvar bloqueado se houver erros.

### TD-019: FKs de Movimentação Faltantes

- **Domínio:** Integridade DB
- **Risco:** Integridade Referencial
- **Status:** 🟠 **OPEN** (P1)
- **Evidência:** `from_lote_id` e `to_lote_id` sem FK explicita para `lotes`.
- **Ação:** Adicionar Foreign Keys nas colunas de lote em `eventos_movimentacao`.
- **Critério de Aceite:**
  - [ ] Migração SQL aplicada sem erros.
  - [ ] Insert com lote inexistente falha com erro de FK.

### TD-020: FK de Reprodutor (Macho) Faltante

- **Domínio:** Reprodução
- **Risco:** Integridade
- **Status:** 🟠 **OPEN** (P1)
- **Evidência:** `eventos_reproducao.macho_id` sem FK.
- **Ação:** Adicionar FK para `animais(id)`.
- **Critério de Aceite:**
  - [ ] Insert com `macho_id` inexistente falha.

---

## 🟨 Prioridade P2 (Melhoria - Performance/UX)

### TD-015: Cálculo de GMD em Memória

- **Domínio:** Performance / Dashboard
- **Risco:** Lentidão em rebanhos grandes
- **Status:** 🟡 **OPEN** (P2)
- **Evidência:** Dashboard carrega todo histórico para calcular ganho médio.
- **Ação:** Materializar GMD no evento ou criar View agregada.
- **Critério de Aceite:**
  - [ ] Dashboard carrega em < 2s com 5000 animais.

### TD-004: Índices de Performance Faltantes

- **Domínio:** DB Performance
- **Risco:** Scalability
- **Status:** 🟡 **OPEN** (P2)
- **Evidência:** Queries de dashboard sem índices compostos.
- **Ação:** Criar índices `(fazenda_id, occurred_at)`, `(animal_id, occurred_at)`.
- **Critério de Aceite:**
  - [ ] `explain analyze` mostra uso de Index Scan nas queries principais.

---

## 🟩 Recentemente Resolvido (Mantido por Histórico)

### TD-007: UI de Reprodução ✅

Ver seção P0 acima para detalhes completos. Resolvido em fevereiro/2026 com implementação completa de formulário, linking de episódios, status computation e dashboard.

---

## 🗺️ Inputs para ROADMAP (Épicos Sugeridos)

Estes itens devem ser considerados para planejamento futuro em `ROADMAP.md`. Baseado em TECH_DEBT **OPEN**.

- **E-020: Gestão de Catálogo de Produtos** (Resolver TD-011)
  - Cadastro centralizado de vacinas e medicamentos.
  - ~Substituir campo produto TEXT por FK~
- **E-021: Módulo de Nutrição Completo** (Resolver TD-006)
  - UI de registro (formulário em Registrar.tsx)
  - Relatórios de consumo e custo
  - Schema já existe (migrations/0001, Dexie store, buildEventGesture)
- **E-022: Segurança Hardening V2** (Resolver TD-003, TD-019, TD-020)
  - Revisão completa de FKs (movimentação, reprodução)
  - Políticas de Delete restritas a owner
- **E-023: Painel de Auditoria e Correção** (Resolver TD-001)
  - UI para Managers visualizarem logs de sync
  - Limpeza automática de queue_rejections (>7 dias)
  - Correção manual de dados rejeitados
- **E-024: Performance Hardening** (Resolver TD-004, TD-015)
  - Índices compostos otimizados
  - Views materializadas para GMD e relatórios
