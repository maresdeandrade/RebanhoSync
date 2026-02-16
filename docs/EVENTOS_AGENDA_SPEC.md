# Especificação Técnica: Regras de Eventos e Agenda (Two Rails)

> **Status:** Normativo
> **Fonte de Verdade:** Código Fonte (`sync-batch`, Migrations)
> **Última Atualização:** 2026-02-16

Este documento define regras de domínio, invariantes e validações para os módulos de Eventos e Agenda.

---

## 1. Eventos (Rail Append-Only)

Fonte de verdade imutável para a história do rebanho.

### 1.1 Invariantes de Imutabilidade

- **Proibição de UPDATE/DELETE físicos:** Campos semânticos (`payload`, `occurred_at`) são imutáveis.
- **Justificativa:** Consistência Distribuída e Auditoria.

### 1.2 Mecanismo de Correção

Para corrigir erros, cria-se um **Evento de Correção**:

1.  **Novo Evento:** INSERT com os dados corretos.
2.  **Vínculo:** Referencia o original via `corrige_evento_id`.
3.  **Visualização:** O sistema exibe o estado consolidado mais recente.

### 1.3 Hardening

- `UPDATE dominio`: PROIBIDO.
- `UPDATE payload`: PROIBIDO.
- `DELETE físico`: Restrito (Admin apenas).

---

## 2. Agenda (Rail Mutável)

Intenções e planejamento (`agenda_itens`).

### 2.1 Máquina de Estados

- `agendado` → `concluido` (sucesso)
- `agendado` → `cancelado` (desistência)

### 2.2 Deduplicação (`dedup_key`)

Chave única composta para evitar tarefas duplicadas (ex: Protocolos automatizados).

- Colisão retorna `APPLIED_ALTERED` (No-Op).

---

## 3. Anti-Teleporte

Garante integridade entre Estado (`lote_id`) e Histórico (`eventos`).

> "Nenhuma alteração de propriedade de localização pode ser persistida sem um evento correspondente."

### Validação Atômica

O servidor rejeita **todo o lote** se detectar mudança mágica de lote sem evento de movimentação correspondente na mesma transação.

### Ordenação Obrigatória (Ops)

1.  **Evento** (Causa)
2.  **Detalhe** (Dados Satélites)
3.  **Estado** (Consequência - UPDATE animais)

---

## Veja Também

- [**ARCHITECTURE.md**](./ARCHITECTURE.md)
- [**DB.md**](./DB.md)
- [**CONTRACTS.md**](./CONTRACTS.md)
