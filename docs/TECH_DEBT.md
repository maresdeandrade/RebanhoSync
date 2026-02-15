# Dívida Técnica (Tech Debt)

> **Status:** Derivado (Inventário)
> **Fonte de Verdade:** Análise de Arquitetura (`ARCHITECTURE.md`, `OFFLINE.md`)
> **Última Atualização:** 2026-02-15

Lista de débitos técnicos identificados, classificados por risco e impacto.

## Críticos (Alta Prioridade)

### 1. Limpeza de Queue Rejections

- **Impacto:** Alta
- **Risco:** Storage/Performance (Crescimento infinito no Dexie)
- **Evidência:** `src/lib/offline/syncWorker.ts` não possui rotina de expurgo para `queue_rejections`.
- **Ação:** Criar job de limpeza ou UI para usuário descartar rejeições antigas.

### 2. Hard Delete de Animais por Cowboy

- **Impacto:** Alta
- **Risco:** Segurança/Integridade (Perda de dados acidental)
- **Evidência:** `docs/RLS.md` menciona que Cowboys têm permissão de DELETE na tabela `animais`.
- **Ação:** Restringir DELETE via RLS para apenas Owner/Manager.

## Importantes (Média Prioridade)

### 3. Sync Background Nativo

- **Impacto:** Média
- **Risco:** Offline UX (Sync para ao fechar app)
- **Evidência:** `syncWorker.ts` utiliza `setInterval` simples.
- **Ação:** Integrar com Service Worker Background Sync API.

### 4. Validação de Payload JSONB

- **Impacto:** Média
- **Risco:** Integridade de Dados
- **Evidência:** Banco aceita qualquer JSON no campo `payload` de eventos. Validação apenas na Edge Function.
- **Ação:** Adicionar triggers de validação de schema JSON no PostgreSQL.

## Menores (Baixa Prioridade)

### 5. Persistência de Client ID

- **Impacto:** Baixa
- **Risco:** UX (Perda de fila em limpeza de cache)
- **Evidência:** Client ID reside em `localStorage`.
- **Ação:** Explorar persistência mais robusta (IndexedDB key) ou recuperação via Auth.

---

_Gerado a partir da análise de gaps em `ARCHITECTURE.md` e `OFFLINE.md`._
