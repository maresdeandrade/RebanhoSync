# Parecer validado sobre o Mapa de Fluxos e Contratos

Atualizado em: 2026-08-23
Baseline: `main@9db4bb9ffeb0bc4d1bc07305cde48132cd638721`
Decisão: **o mapa original não deve ser oficializado; as correções abaixo já têm resolução técnica**

## Resumo

O relatório crítico identificou corretamente contradições suficientes para bloquear a oficialização. Depois da inspeção do código e dos testes, 10 dos 12 pontos exigem correção textual no mapa; um ponto (`APPLIED_ALTERED`) foi objetivamente resolvido em favor da crítica; e a proposta de idempotência precisou ser restringida ao que o código realmente garante.

## Matriz de resolução

| # | Achado do parecer original | Validação | Resolução para o mapa |
|---|---|---|---|
| 1 | `APPLIED_ALTERED` contraditório | **Confirmado.** Existe no servidor, worker, reconcile e testes. | Remover “não aplicável”; documentar como aplicado com alteração/no-op e pull de convergência. |
| 2 | Idempotência misturava replay e colisão | **Confirmado com ressalva.** O replay genérico compara IDs, não conteúdo. | Separar replay de conflito de chave; não prometer comparação universal do mesmo fato. |
| 3 | “Toda mutação nasce via createGesture” era absoluto | **Confirmado.** A propriedade correta é uso de writers canônicos. | Usar formulação normativa e descrever composições especializadas. |
| 4 | Import V2 não deveria ser P1 | **Confirmado e fortalecido.** `persistImportV2Preview` chama `createGesture`. | Classificar como orquestrador especializado sobre writer canônico, não bypass. |
| 5 | Risco cross-farm teórico não é P1 | **Confirmado.** A fronteira e cinco testes existem; nenhum bypass concreto foi apresentado. | Mover para invariante preventiva. |
| 6 | “Todas as queries filtram por fazenda” era literal demais | **Confirmado.** Detail pages usam lookup por PK + validação de `fazenda_id`. | Definir a propriedade de isolamento, sem impor um único formato de query. |
| 7 | Reload estava contraditório | **Confirmado.** Dexie/fila sobrevivem; pull converge depois. | Descrever reload local primeiro e reconciliação quando online. |
| 8 | Occupancy estava incompleto | **Confirmado.** Movimento, peso e ECC compõem `AnimalOccupancyPeriod`. | Registrar builders, fontes e estados de cobertura obrigatórios. |
| 9 | Fluxos não estavam ponta a ponta | **Confirmado parcialmente.** Componentes concretos foram localizados; nem todos os fluxos foram reexecutados. | Expandir os quatro manejos confirmados e manter os demais como lacuna de cobertura documental. |
| 10 | “Soft-delete” parecia incorreto | **Confirmado como descrição incompleta.** Remoto usa `deleted_at`; a tela também apaga a linha local. | Descrever a composição real e pedir teste dirigido de reload/rollback. |
| 11 | Venda/abate confundia não inferir com bloquear | **Confirmado.** Registro comercial manual não valida aptidão. | Separar fato comercial de declaração técnica/regulatória. |
| 12 | `queue_rejections` não é auditoria permanente | **Confirmado.** Há exportação, retry e TTL de 7 dias. | Definir como DLQ/evidência operacional temporária. |

## Correções adicionais ao parecer crítico

### Import V2

O parecer tratava o caminho especializado como possivelmente separado da fila. O código elimina essa ambiguidade: cada chunk passa por `createGesture`, com IDs determinísticos. Portanto, a conclusão correta é mais forte que “provavelmente não é P1”: **não há evidência de bypass da fila nesse módulo**.

### Idempotência

A sugestão “mesmo fato + mesmos IDs = replay; conteúdo incompatível = rejeição” expressa uma intenção desejável, mas não é um contrato genérico comprovado. `isPersistedOperationReplay` valida somente `client_op_id` e `client_tx_id`. Colisões de chave com identidade diferente são rejeitadas; validação de conteúdo aparece em fluxos específicos, não como regra universal.

### Classificação final

Os três P1 do mapa original não sobrevivem como P1 confirmados:

- `APPLIED_ALTERED`: erro documental comprovado, não ausência do handler;
- Import V2: composição sobre `createGesture`;
- cross-farm: risco preventivo sem bypass concreto.

Isso não autoriza declarar todo o mapa como oficial. O bloqueador agora é documental: o texto original contém afirmações falsas/absolutas e cobre de forma superficial alguns fluxos anunciados como ponta a ponta.

## Evidências executadas

```txt
pnpm test --
  src/lib/offline/__tests__/syncPartialBatch.test.ts
  src/lib/import/__tests__/importV2Persistence.test.ts
  src/lib/import/__tests__/importV2CreateGesture.test.ts
  src/features/occupancy/__tests__/AnimalMovementHistoryTable.test.tsx
  src/pages/__tests__/detailFarmIsolation.test.ts
  src/lib/offline/__tests__/rejections.test.ts
  supabase/functions/sync-batch/rules.test.ts
```

Resultado: **7 arquivos aprovados, 72 testes aprovados**.

## Critérios para oficialização

1. Substituir no mapa original as seções de sync, idempotência, Import V2, isolamento, reload, occupancy, exclusão, venda/abate e rejeições pelo contrato validado.
2. Rebaixar alegações não verificadas de “confirmado” para “inferência” ou incluir teste/código específico.
3. Expandir apenas os fluxos que realmente precisam de rastreio ponta a ponta, com UI, handler, builder, gesture, operações, fatos/estado, fila, sync e consumidores.
4. Atualizar baseline e estado do worktree na data de publicação.
5. Reexecutar `git diff --check` e os testes de contrato após a consolidação final.

## Veredito

**Mapa original: NOT READY.**
**Errata e mapa validado desta revisão: READY WITH CAVEAT.**

A ressalva é objetiva: as contradições centrais foram resolvidas e testadas, mas a auditoria não reexecutou todos os fluxos listados nas 25 seções do mapa original.
