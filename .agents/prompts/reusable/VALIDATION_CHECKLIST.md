# Validation Checklist — RebanhoSync

Use este checklist ao finalizar revisão, patch ou prompt de execução.

## Escopo

- [ ] Escopo permitido declarado.
- [ ] Escopo proibido declarado.
- [ ] Arquivos-alvo listados.
- [ ] Nenhuma alteração fora do escopo.
- [ ] Nenhuma refatoração ampla sem necessidade.

## Contratos do domínio

- [ ] Agenda não foi tratada como histórico.
- [ ] Evento continua sendo fato executado.
- [ ] `state_*` continua sendo estado atual/read model.
- [ ] Protocolo não foi tratado como execução.
- [ ] Tags/sinais/insights não viraram fonte primária.
- [ ] Decisão crítica não foi automatizada sem fonte técnica explícita.

## Segurança técnica

- [ ] Offline-first preservado.
- [ ] RLS/multi-tenant preservado.
- [ ] `fazenda_id` preservado como fronteira de isolamento.
- [ ] Nenhum `service_role` exposto no client.
- [ ] Nenhuma migration/RPC/policy alterada sem pedido explícito.
- [ ] Operações idempotentes preservadas.

## Validação

Executar proporcionalmente ao escopo:

```bash
git status --short --untracked-files=all
```

Patch local:

```bash
rtk pnpm test -- caminho/do/teste.test.ts
```

Entrega ampla:

```bash
rtk pnpm run lint
rtk pnpm test
rtk pnpm run build
```

Supabase/RLS/sync:

```bash
rtk node scripts/codex/validate-supabase-baseline-functional.mjs
```

## Resultado final

Relatar:
- arquivos criados/alterados/movidos;
- validações executadas;
- validações não executadas e motivo;
- riscos/pendências, no máximo 3.