# Database Schema - Gestão Pecuária

## Estrutura de Tabelas
O banco de dados é dividido em quatro grandes grupos:
1.  **Tenant & Auth:** `fazendas`, `user_fazendas`, `user_profiles`, `user_settings`.
2.  **State (Estado Atual):** `pastos`, `lotes`, `animais`, `contrapartes`, `protocolos_sanitarios`.
3.  **Agenda (Mutável):** `agenda_itens`.
4.  **Eventos (Append-Only):** `eventos` e suas extensões 1:1 (`eventos_sanitario`, `eventos_pesagem`, etc).

## FKs Compostas (Multi-tenant)
Para garantir o isolamento total entre fazendas (tenants), utilizamos chaves estrangeiras compostas `(id, fazenda_id)`.
- **Por que?** Isso impede que um animal da Fazenda A seja movido para um lote da Fazenda B, mesmo que o atacante conheça o UUID do lote. A integridade é verificada no nível do banco.

## Idempotência e Offline-first
Cada tabela possui um índice de unicidade baseado em `(fazenda_id, client_op_id)`.
- **client_op_id:** Um UUID gerado no frontend no momento do gesto do usuário.
- **Garantia:** Se o app tentar sincronizar a mesma operação duas vezes (devido a instabilidade de rede), o banco rejeitará a duplicata, mantendo o estado consistente.

## Dedup de Agenda
A tabela `agenda_itens` possui um índice parcial de deduplicação:
- `ux_agenda_dedup_active` em `(fazenda_id, dedup_key)` onde `status = 'agendado'`.
- Isso evita que protocolos automáticos gerem tarefas duplicadas para o mesmo animal/lote se o gatilho for disparado repetidamente.