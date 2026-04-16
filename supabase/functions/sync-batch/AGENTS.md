# SYNC-BATCH LOCAL AGENT

Escopo:
- `supabase/functions/sync-batch/**`
- `src/lib/offline/**` apenas se a mudança exigir alinhamento cliente-servidor
- não expandir para UI sem necessidade

Leia primeiro:
1. `docs/CONTRACTS.md`
2. `docs/RLS.md`
3. `docs/DB.md`

Leia só se necessário:
- `docs/ARCHITECTURE.md`
- `docs/OFFLINE.md`
- `docs/CURRENT_STATE.md`

Foco deste diretório:
- validação autoritativa do batch
- membership
- blocked tables
- ordering e aplicação das ops
- status `APPLIED`, `APPLIED_ALTERED`, `REJECTED`
- reason codes
- taxonomia versionada
- invariantes multi-tenant

Invariantes obrigatórias:
- JWT Bearer obrigatório
- validar membership em `user_fazendas`
- nunca permitir bypass tenant por `fazenda_id`
- preservar idempotência por `client_op_id`
- não aceitar shape inválido em payloads versionados
- manter coerência entre cliente e servidor nos reason codes
- tabelas bloqueadas continuam fora do sync transacional
- nada aqui pode relaxar append-only ou integridade cross-farm

Checagens mentais antes de alterar:
1. Esta validação pertence ao cliente, ao servidor, ou aos dois?
2. A rejeição tem `reason_code` explícito?
3. A mudança altera compatibilidade com batches antigos?
4. O erro deve retornar `REJECTED` de negócio ou falha técnica?
5. Existe impacto em rollback local?

Evitar:
- lógica implícita sem `reason_code`
- aceitar campos extras silenciosamente em payload versionado
- misturar regra de UI com validação autoritativa
- quebrar ordering sem documentação
- alterar bloqueios de tabela sem justificativa explícita

Entrega esperada:
- patch mínimo
- contrato alterado
- novos/alterados reason codes
- até 3 riscos

Validação mínima:
- `pnpm test`
- `pnpm run lint`
- `pnpm run build`

Quando escalar:
- se mudar envelope do sync, ordering, status codes, blocked tables ou contrato canônico -> avaliar ADR
- se exigir nova FK, enum ou policy -> revisar migrations e RLS junto