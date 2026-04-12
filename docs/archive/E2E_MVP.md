# Roteiro de Testes E2E (MVP)

> **Status:** Normativo
> **Fonte de Verdade:** Requisitos de Produto
> **Ultima Atualizacao:** 2026-04-07

Este documento define os fluxos criticos de validacao do sistema.

---

## Fluxo 0: Autenticacao e Fazenda

- login e redirecionamento correto
- persistencia da fazenda ativa (`user_settings` + `localStorage`)
- bootstrapping automatico de fazenda para novos usuarios

## Fluxo 0.5: Implantacao Inicial

- wizard de onboarding aponta para a primeira etapa pendente
- importacao de pastos por CSV cria gestos locais validos
- importacao de lotes por CSV valida vinculo com pastos da fazenda ativa

## Fluxo 0.6: Resumo Operacional

- tela de resumo operacional consolida rebanho, agenda, financeiro basico e sync da fazenda ativa
- exportacao CSV gera arquivo compartilhavel com o periodo selecionado
- impressao abre visao resumida para repasse ao dono ou equipe

## Fluxo 1: RBAC

- owner tem controle total
- manager nao pode alterar owner
- bloqueio de remocao do ultimo owner
- soft delete de membros

## Fluxo 2: Offline -> Online -> Sync

- criacao de evento offline (`state_*` + `queue_*`)
- sincronizacao automatica ao recuperar conexao
- validacao de dados no servidor e consistencia local

## Fluxo 2.1: Taxonomia Canonica

- novilha prenhe: write offline em `animais.payload.taxonomy_facts`, sync `APPLIED`, projecao final `novilha/prenhe`
- parto: write derivado de evento reprodutivo, sync `APPLIED`, projecao final `vaca/recem_parida`
- secagem: write offline, sync `APPLIED`, projecao final `vaca/seca`
- rejeicao taxonomica: `REJECTED` por shape invalido deve executar rollback local completo do `before_snapshot`
- cobertura automatizada minima em `src/lib/offline/__tests__/taxonomySync.e2e.test.ts`

## Fluxo 3: Anti-Teleporte

- movimentacao magica (`UPDATE` sem `INSERT` de evento) deve ser rejeitada
- movimentacao correta (`Evento + Detalhe + Update`) deve ser aceita
- rollback local correto em caso de rejeicao

## Fluxo 4: Duplicacao de Agenda

- tarefas com mesmo `dedup_key` nao duplicam
- retorno `APPLIED_ALTERED` tratado como sucesso pelo cliente

## Fluxo 5: Setup de Fazenda

- RPC `create_fazenda` cria tenant e membership corretamente

## Fluxo 6: Hardening de Eventos

- validacao de constraints financeiros (`valor > 0`)
- validacao de movimentacao (`origem != destino`)
- validacao de integridade de chaves

## Fluxo 7: Operacional

- feature flags de fazenda
- dashboard de monitoramento de rejeicoes

## Fluxo 8: Nutricao

Escopo MVP:

- registro operacional de eventos de nutricao para animais e/ou lotes
- nao inclui gestao de estoque, inventario ou compras

Requisitos:

- formulario de nutricao registra evento offline
- grava em `state_eventos` e `event_eventos_nutricao`
- cria `queue_gestures` + `queue_ops`
- `sync-batch` processa o gesto
- `syncWorker` executa rollback local em caso de rejeicao
- historico exibe eventos de nutricao sincronizados

---

## Fluxo 9: Pos-Parto Neonatal e Cria Inicial

Escopo:

- parto gera cria localmente e redireciona para pos-parto
- pos-parto confirma identificacao final, lote inicial e pesagem neonatal em gesto atomico
- cria inicial registra dados basicos da cria recem-gerada
- sincronizacao do gesto composto (animal cria + evento pesagem + agenda)

Requisitos:

- `AnimalPosParto.tsx` aceita cria_id e confirma dados neonatais
- `AnimalCriaInicial.tsx` registra ciclo inicial da cria
- gesto atomico com rollback correto em caso de rejeicao
- historico de parto vincula mae a cria corretamente

---

## Veja Tambem

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DB.md](./DB.md)
- [CONTRACTS.md](./CONTRACTS.md)
- [EVENTOS_AGENDA_SPEC.md](./EVENTOS_AGENDA_SPEC.md)
