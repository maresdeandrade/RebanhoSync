# Arquitetura Offline-First

> **Status:** Normativo
> **Fonte de Verdade:** `src/lib/offline/`
> **Ultima Atualizacao:** 2026-04-06

Este documento descreve a persistencia local, a fila transacional e como a taxonomia canonica convive com o modelo offline-first.

---

## 1. Stores Dexie

### `state_*`

Replica local mutavel do estado atual.

Exemplos:

- `state_animais`
- `state_lotes`
- `state_agenda_itens`

### `event_*`

Log local append-only.

Exemplos:

- `event_eventos`
- `event_eventos_reproducao`
- `event_eventos_pesagem`

### `queue_*`

Controle de sincronizacao.

- `queue_gestures`
- `queue_ops`
- `queue_rejections`

---

## 2. Taxonomia no Cliente

A taxonomia canonica nao introduz uma nova store dedicada.

Decisao adotada:

- fatos minimos ficam em `state_animais.payload.taxonomy_facts`
- a derivacao e calculada em selectors/helpers
- a UI consome snapshots derivados sem persistir labels canonicos como fonte primaria
- `taxonomy_facts` carrega `schema_version = 1`
- o contrato e validado antes do enqueue em `src/lib/offline/ops.ts`

Beneficios:

- sem breaking change no Dexie schema
- sem custo de backfill local estrutural
- rollback continua igual, porque os fatos seguem como `UPDATE` normal em `animais.payload`

---

## 3. Escrita e Rollback

Quando um fato taxonomico muda:

1. a UI cria um gesto
2. grava `queue_ops`
3. atualiza `state_animais`
4. em rejeicao, restaura `before_snapshot`

Exemplos de fatos atualizados automaticamente:

- diagnostico positivo -> `prenhez_confirmada`, `data_prevista_parto`
- parto -> `data_ultimo_parto`, `em_lactacao`, `secagem_realizada`

Exemplos de fatos manuais:

- `castrado`
- `secagem_realizada`
- `data_secagem`
- `em_lactacao`

Se o `sync-batch` responder `REJECTED`, o rollback continua restaurando o `before_snapshot` inteiro de `state_animais`.

---

## 4. Compatibilidade

O shape da store `state_animais` permanece o mesmo.

- nao foi criada tabela nova para taxonomia
- dados legados continuam validos
- compatibilidade com `papel_macho` e `habilitado_monta` permanece por helper

Cobertura critica:

- `src/lib/offline/__tests__/taxonomySync.e2e.test.ts`
- fluxo `APPLIED` para novilha prenhe, parto e secagem
- fluxo `REJECTED` com rollback local do animal

---

## Veja Tambem

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DB.md](./DB.md)
- [CONTRACTS.md](./CONTRACTS.md)
