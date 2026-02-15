# Dívida Técnica (Tech Debt)

> **Status:** Derivado (Inventário)
> **Fonte de Verdade:** Análises de Eventos (`docs/analysis/*`), `ARCHITECTURE.md`
> **Última Atualização:** 2026-02-15

Lista consolidada de débitos técnicos, gaps de funcionalidade e riscos do projeto RebanhoSync.

---

## 🟥 Prioridade P0 (Crítico - Bloqueia Uso ou Risco Alto)

### TD-001: Limpeza de Queue Rejections (Offline)

- **Domínio:** Offline / Infra
- **Risco:** Storage/Performance (Crescimento infinito no Dexie)
- **Evidência:** `src/lib/offline/syncWorker.ts` não possui rotina de expurgo.
- **Ação:** Implementar Job ou UI para limpar rejeições antigas (> 7 dias).
- **Critério de Aceite:**
  - [ ] Ao abrir o app, rejeições com `created_at < now - 7 days` devem ser removidas do Dexie.
  - [ ] Usuário deve ter botão "Limpar Lista" na tela de Sync Debug.

### TD-006: UI de Nutrição Inexistente

- **Domínio:** Nutrição
- **Risco:** Usabilidade (Feature inacessível)
- **Evidência:** `eventos_nutricao` existe no DB, mas não há form em `/registrar`.
- **Ação:** Criar formulário de registro de nutrição.
- **Critério de Aceite:**
  - [ ] Rota `/registrar` exibe opção "Nutrição".
  - [ ] App persiste `eventos` + `eventos_nutricao`.
  - [ ] Sync envia dados corretamente.

### TD-007: UI de Reprodução Inexistente

- **Domínio:** Reprodução
- **Risco:** Usabilidade (Feature inacessível)
- **Evidência:** `eventos_reproducao` existe no DB, mas não há form em `/registrar`.
- **Ação:** Criar formulário de registro (Cobertura/Diagnóstico/Parto).
- **Critério de Aceite:**
  - [ ] Rota `/registrar` exibe opções reprodutivas.
  - [ ] Registro de Parto cria vínculo mãe/filho.

### TD-008: Validação de Movimentação (Anti-Teleporte Local)

- **Domínio:** Movimentação
- **Risco:** Integridade de Dados
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
- **Evidência:** RLS atual permite DELETE em `animais` para role `cowboy`.
- **Ação:** Atualizar Policy SQL para restringir DELETE a `owner` e `manager`.
- **Critério de Aceite:**
  - [ ] Usuário `cowboy` recebe 403/Risco ao tentar deletar animal via SQL ou App.
  - [ ] Usuário `owner` consegue deletar.

### TD-011: Produto Sanitário como Texto Livre

- **Domínio:** Sanitário
- **Risco:** Relatórios inconsistentes
- **Evidência:** `eventos_sanitario.produto` é `TEXT`.
- **Ação:** Criar catálogo `produtos_veterinarios` e usar FK ou Autocomplete estrito.
- **Critério de Aceite:**
  - [ ] Tabela `produtos_veterinarios` criada.
  - [ ] UI de registro exige seleção de produto válido.

### TD-014: Validação Frontend de Pesagem

- **Domínio:** Pesagem
- **Risco:** UX / Erro de Banco
- **Evidência:** Frontend converte vazio para 0 ou NaN, banco rejeita `CHECK (peso > 0)`.
- **Ação:** Validar input > 0 antes do submit.
- **Critério de Aceite:**
  - [ ] Campo de peso exibe erro se valor <= 0.
  - [ ] Botão salvar bloqueado se houver erros.

### TD-019: FKs de Movimentação Faltantes

- **Domínio:** Integridade DB
- **Risco:** Integridade Referencial
- **Evidência:** `from_lote_id` e `to_lote_id` sem FK explicita para `lotes`.
- **Ação:** Adicionar Foreign Keys nas colunas de lote em `eventos_movimentacao`.
- **Critério de Aceite:**
  - [ ] Migração SQL aplicada sem erros.
  - [ ] Insert com lote inexistente falha com erro de FK.

### TD-020: FK de Reprodutor (Macho) Faltante

- **Domínio:** Reprodução
- **Risco:** Integridade
- **Evidência:** `eventos_reproducao.macho_id` sem FK.
- **Ação:** Adicionar FK para `animais(id)`.
- **Critério de Aceite:**
  - [ ] Insert com `macho_id` inexistente falha.

---

## 🟨 Prioridade P2 (Melhoria - Performance/UX)

### TD-015: Cálculo de GMD em Memória

- **Domínio:** Performance / Dashboard
- **Risco:** Lentidão em rebanhos grandes
- **Evidência:** Dashboard carrega todo histórico para calcular ganho médio.
- **Ação:** Materializar GMD no evento ou criar View agregada.
- **Critério de Aceite:**
  - [ ] Dashboard carrega em < 2s com 5000 animais.

### TD-004: Índices de Performance Faltantes

- **Domínio:** DB Performance
- **Risco:** Scalability
- **Evidência:** Queries de dashboard sem índices compostos.
- **Ação:** Criar índices `(fazenda_id, occurred_at)`, `(animal_id, occurred_at)`.
- **Critério de Aceite:**
  - [ ] `explain analyze` mostra uso de Index Scan nas queries principais.

---

## 🗺️ Inputs para ROADMAP (Épicos Sugeridos)

Estes itens devem ser considerados para planejamento futuro em `ROADMAP.md`.

- **E-020: Gestão de Catálogo de Produtos** (Resolver TD-011, TD-012)
  - Cadastro centralizado de vacinas e medicamentos.
- **E-021: Módulo de Nutrição Completo** (Resolver TD-006)
  - UI de registro, relatórios de consumo e custo.
- **E-022: Módulo de Reprodução e Genealogia** (Resolver TD-007, TD-021)
  - Ciclo reprodutivo completo, árvore genealógica automática.
- **E-023: Painel de Auditoria e Correção** (Resolver TD-001)
  - UI para Managers visualizarem logs de sync e corrigirem dados.
- **E-024: Segurança Hardening V2** (Resolver TD-003, TD-019, TD-020)
  - Revisão completa de FKs e Policies de Delete.
