# F24.2B1 — Event identity characterization and P0 reclassification

Atualizado em: 2026-09-16

## Estado

```text
F24.2B0 = CLOSED
F24.2B1 = READY_FOR_REVIEW
F24.2B = READY_FOR_CLOSEOUT
F24.2 = IN_PROGRESS
DUPLICATE_EVENT_P0 = NOT_CONFIRMED_AS_SYNC_FAILURE
```

Baseline explícita da B1: `codex/f24-2b-event-identity@d2c70c6e8ba44f58e6a3036b09d2671462e111b3`.
Esse commit versiona exclusivamente a auditoria B0 sobre
`origin/main@b3e5ed170bafd81c451d9d916502b26fe49e8392`.

## Decisão

A hipótese P0 de `DUPLICATE_EVENT` não foi confirmada como falha de sync. Os testes de
caracterização comprovam que replay/retry preservam a identidade persistida e convergem para
um fato, enquanto comandos causalmente distintos podem manter conteúdo de negócio igual e
produzir dois fatos. Nenhum comportamento funcional de runtime foi alterado.

Não houve “bug corrigido”. Houve encerramento da hipótese por auditoria de proveniência e
testes de caracterização.

## Testes de caracterização

| Teste | Cenário | Esperado | Resultado |
| --- | --- | --- | --- |
| A | reaplicar `E1/T1/O1` | um Evento, um gesto e as mesmas operações | PASS — `eventIdentity.characterization.test.ts` |
| B | commit remoto seguido de response-lost e retry | IDs preservados; replay do mesmo fato | PASS — `syncPartialBatch.test.ts` |
| C | mesma PK com `T2/O2` divergentes | não reconhecer como replay; `REJECTED / OPERATION_IDENTITY_CONFLICT` | PASS — `rules.test.ts` |
| D | mesmo payload factual com `E1/T1/O1` e `E2/T2/O2` | dois Eventos permitidos | PASS — `eventIdentity.characterization.test.ts` |
| E | repetir execução da mesma Agenda na mesma fazenda | um Evento factual | PASS — `sanitaryAgendaExecutionV2.test.ts` |
| F | mesmo `source_task_id` em fazendas distintas | sem colisão/lookup global; escopo preservado | PASS local + boundary — Dexie e `buildMutationMatch`; enforcement remoto composto permanece evidência de migration |
| G | peso de entrada societária | IDs pré-gerados preservados pela mesma gesture; replay do gesto não regenera | PASS na fronteira `createGesture` — o caller não possui mecanismo próprio de replay |

Comando:

```text
pnpm test -- src/lib/offline/__tests__/eventIdentity.characterization.test.ts src/lib/offline/__tests__/syncPartialBatch.test.ts supabase/functions/sync-batch/rules.test.ts src/lib/sanitario/execution/__tests__/sanitaryAgendaExecutionV2.test.ts
```

Resultado: `4` arquivos, `57` testes aprovados.

## Invariantes comprovadas

```text
same identity replay
→ one fact

same PK + different operation identity
→ explicit identity conflict

different identities + same business payload
→ two facts allowed

same causal origin inside the same farm
→ idempotent in the Agenda contract

same causal value across farms
→ isolated by fazenda_id
```

Identidades continuam separadas:

- `event_id`: identidade do registro factual;
- `client_tx_id`: identidade do gesto local;
- `client_op_id`: identidade da mutação;
- `source_task_id`: proveniência causal da Agenda;
- `domain_op_id` / `operation_id`: identidades de comandos especializados.

## Reclassificação

```text
DUPLICATE_EVENT = NOT_CONFIRMED_AS_SYNC_FAILURE
```

O P0 anterior dependia da inferência de que a mesma execução poderia reaparecer com identidade
regenerada. Nenhum caminho técnico reproduzível foi encontrado. Os testes confirmaram que:

1. o gesto persistido não regenera IDs no retry/restart;
2. o backend só reconhece replay quando op e gesto coincidem;
3. uma colisão de PK com identidade diferente é rejeitada;
4. payload igual não é identidade causal.

## Unknown preservado

```text
Fatos ad hoc registrados independentemente em múltiplos dispositivos,
sem identidade causal compartilhada, não podem ser automaticamente
distinguidos entre duplicidade humana e fatos independentes.
```

Essa é uma limitação de causalidade/domínio, não uma falha comprovada de replay. Não autoriza
deduplicação por conteúdo, hash, animal/data, timestamp aproximado, peso ou descrição.

## Próxima fase recomendada

```text
F24.2C_ATOMIC_ACK_AND_SYNCING_RECOVERY
```

O próximo risco comprovado é a janela não atômica entre remoção de `queue_ops` e transição do
gesto para `DONE`, somada à ausência de startup recovery completo para `SYNCING`. Nenhuma
correção da F24.2C foi iniciada nesta execução.
