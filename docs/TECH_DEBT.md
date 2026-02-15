# Dívida Técnica (Tech Debt)

> **Status:** Derivado (Inventário)
> **Fonte de Verdade:** Análise de Arquitetura e Código
> **Última Atualização:** 2026-02-15

Lista de débitos técnicos identificados e classificados.

## Críticos (Alta Prioridade)

### 1. Limpeza de Queue Rejections

- **Impacto:** Alta
- **Risco:** Storage/Performance (Crescimento infinito no Dexie)
- **Evidência:** `src/lib/offline/syncWorker.ts` não possui rotina de expurgo.
- **Ação:** Criar job de limpeza ou UI para usuário descartar rejeições.

### 2. Hard Delete de Animais por Cowboy

- **Impacto:** Alta
- **Risco:** Segurança/Integridade
- **Evidência:** `docs/RLS.md` menciona permissão de DELETE para Cowboys.
- **Ação:** Restringir DELETE via RLS para apenas Owner/Manager.

### 6. UI de Nutrição Inexistente

- **Impacto:** Alta
- **Risco:** Usabilidade (Funcionalidade inacessível)
- **Evidência:** `eventos_nutricao` existe no backend, mas não há formulário no frontend (`src/pages/Registrar.tsx`).
- **Ação:** Implementar formulário de registro de Nutrição.

### 7. UI de Reprodução Inexistente

- **Impacto:** Alta
- **Risco:** Usabilidade
- **Evidência:** `eventos_reproducao` existe no backend, mas sem interface de cadastro.
- **Ação:** Implementar formulário de Reprodução.

### 8. Validação Fraca de Movimentação

- **Impacto:** Alta
- **Risco:** Integridade de Dados
- **Evidência:** Backend não valida se `from_lote_id` é diferente de `to_lote_id` (Analysis Movimentação).
- **Ação:** Adicionar validação de negócio no `sync-batch`.

## Importantes (Média Prioridade)

### 3. Sync Background Nativo

- **Impacto:** Média
- **Risco:** Offline UX
- **Evidência:** `syncWorker.ts` usa `setInterval` simples.
- **Ação:** Integrar com Service Worker Background Sync API.

### 4. Validação de Payload JSONB

- **Impacto:** Média
- **Risco:** Integridade de Dados
- **Evidência:** Campo `payload` aceita JSON arbitrário sem validação de schema.
- **Ação:** Adicionar triggers de validação JSONB no Postgres.

### 9. Falta de Índices de Performance

- **Impacto:** Média
- **Risco:** Performance em escala
- **Evidência:** Faltam índices compostos em `eventos(fazenda_id, occurred_at)` e `animais(fazenda_id, status)`.
- **Ação:** Criar índices cobrindo filtros comuns de dashboard.

## Menores (Baixa Prioridade)

### 5. Persistência de Client ID

- **Impacto:** Baixa
- **Risco:** UX
- **Evidência:** Client ID reside em `localStorage`.
- **Ação:** Migrar para IndexedDB.
