# Sanitario Protocols v2 - Import Gate 12F10

Status: import real bloqueado.
Data: 2026-06-15

## Gate obrigatorio antes da 12G0

12G0 so pode iniciar se todos os itens abaixo forem tratados explicitamente:

| Gate | Status 12F10 | Motivo |
|---|---|---|
| Payload canonico definido | OK | `SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json` |
| Import real autorizado | BLOQUEADO | ainda nao ha autorizacao explicita para carga real |
| Dry-run transacional | PENDENTE | deve rodar antes de qualquer commit de dados |
| Rollback definido | PENDENTE | import deve ser reversivel/testavel |
| Members com `class_id` real | BLOQUEADO | 16 rejeicoes `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER` |
| Aprovacao catalogal | BLOQUEADO | `approved_for_catalog=false` |
| Agenda automatica | BLOQUEADO | `agenda_allowed=false` e `allows_agenda_auto=false` |

## Bloqueios reais

- ProductClassGroup members nao podem ser importados sem `class_id` real.
- Principio ativo ou `class_key` nao pode ser usado como FK.
- UUID artificial continua proibido.
- ProductClassGroup nao valida execucao, dose ou carencia.
- Produto real continua obrigatorio no evento executado.
- Carencia ativa continua dependendo de evento executado + produto executado + snapshot.

## Conduta para 12G0

Usar somente o payload canonico 12F10, em dry-run, dentro de transacao com rollback validado. Nao promover agenda, catalogo, venda, abate, leite ou aptidao operacional.
