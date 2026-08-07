# Validation Checklist — RebanhoSync

Atualizado em: 2026-08-03  
Versão: 1.2.0

Use como checklist auxiliar ao finalizar patch ou revisão. Marque **N/A** quando o item não se aplicar; não trate item não verificado como aprovado. Este arquivo não emite READY/NOT READY e não substitui `rebanhosync-verification-gate`.

## Escopo e diff

- [ ] Pedido, escopo permitido e escopo proibido estão claros.
- [ ] Estado inicial do worktree foi registrado.
- [ ] Arquivos tracked, staged, untracked, removidos e renomeados foram inspecionados.
- [ ] Diff real corresponde ao escopo.
- [ ] Não houve refatoração ou alteração incidental sem justificativa.
- [ ] `git diff --check` passou.

## Contratos aplicáveis

- [ ] Agenda não virou histórico.
- [ ] Evento permanece fato executado.
- [ ] `state_*` permanece estado atual/read model.
- [ ] Protocolo não virou execução.
- [ ] Tags, sinais e insights não viraram fonte primária.
- [ ] Decisão crítica não foi automatizada sem fonte técnica explícita.
- [ ] Não surgiu regra crítica na UI nem fonte de verdade paralela.

## Offline, sync e dados

- [ ] Offline-first foi preservado.
- [ ] Idempotência, retry/replay, sucesso parcial, rollback e reconciliação foram avaliados quando tocados.
- [ ] RLS, multi-tenant e `fazenda_id` foram preservados.
- [ ] Relações cross-tenant continuam impossíveis.
- [ ] Nenhum `service_role` foi exposto ao cliente.
- [ ] Migration, RPC, policy, seed ou schema só foram alterados quando explicitamente autorizados.

## Testes e validações

- [ ] Teste diretamente relacionado foi executado ou há motivo objetivo documentado.
- [ ] Cenários negativos e edge cases relevantes foram cobertos.
- [ ] Lint/build/testes amplos foram executados somente quando proporcionais ao risco.
- [ ] Gate Supabase foi executado quando o escopo tocou banco, RLS, RPC, migration ou sync-batch e o script existia.
- [ ] Comandos seguiram `.agents/rules/rtk.md`.
- [ ] Resultados foram relatados sem ocultar falhas, warnings ou limitações.

## Encaminhamento ao gate

- [ ] Evidências, comandos, resultados e lacunas estão prontos para `rebanhosync-verification-gate`.
- [ ] Nenhuma classificação final foi inferida por este checklist auxiliar.

## Entrega

Relatar:

1. arquivos criados/alterados/removidos;
2. validações executadas, com comando e resultado;
3. validações não executadas, com motivo;
4. lacunas conhecidas;
5. riscos/pendências, no máximo 3;
6. próximo passo: executar ou concluir `rebanhosync-verification-gate`.
