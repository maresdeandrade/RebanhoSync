---
name: movimentacao-transito-conformidade
description: Protege fluxos de movimentação e trânsito do RebanhoSync, incluindo troca de lote ou pasto, entrada/saída física, transferência, origem/destino, Evento de movimentação, estado atual, ocupação, GTA, documentação de transporte e compliance associado. Usar quando a tarefa criar, corrigir, sincronizar, exibir ou auditar movimento histórico ou estado derivado. Não usar para cadastro animal sem deslocamento, compliance sanitário puro, KPI financeiro isolado ou ajuste apenas visual/copy.
---

# Movimentação Trânsito Conformidade

## Missão

Preservar o fato histórico da movimentação, o estado atual derivado, a integridade de origem/destino e o suporte documental sem criar fontes paralelas de verdade.

## Coordenação

Combinar quando necessário com:

- `animal-cadastro-origem-destino`: identidade, cadastro-base ou proveniência sem movimento;
- `sanitario-catalogo-regulatorio-compliance`: regra sanitária/regulatória ligada ao trânsito;
- `sync-offline-rollback`: gesto, fila, retry, rollback ou reconcile;
- `migrations-rls-contracts`: schema, RLS, constraint ou RPC;
- `rebanhosync-verification-gate`: validação final do patch.

## Leitura inicial

1. `AGENTS.md`;
2. `.agents/rules/CORE_RULES.md`;
3. `.agents/rules/CONTEXT_LOADING.md`;
4. `.agents/rules/no-broad-context.md`;
5. `AGENTS.md` local, se existir;
6. arquivos-alvo e testes diretamente relacionados.

Carregar conforme o caso:

- `docs/domain/LOTES_PASTOS.md`: lote, pasto ou ocupação;
- `docs/domain/COMPRA_VENDA.md`: compra, venda ou saída comercial;
- `docs/domain/SANITARIO.md`: bloqueio ou requisito sanitário explícito;
- `docs/context/SOURCE_OF_TRUTH.md`: conflito entre fato e estado;
- `docs/technical/OFFLINE_SYNC.md`: persistência local, fila ou rollback;
- `docs/technical/SUPABASE_RLS.md`: backend, RLS ou RPC;
- `.agents/rules/rtk.md`: comandos e validação.

Não abrir todas essas fontes por padrão.

## Hierarquia em conflito

1. código + migrations ativas;
2. `docs/context/PROJECT_STATUS.md`;
3. docs normativos ativos;
4. docs derivados;
5. histórico em `docs/archive/**`;
6. esta skill.

## Separação canônica

| Estrutura | Papel |
|---|---|
| Evento de movimentação | Fato histórico executado |
| `state_*` ou read model equivalente | Lote, pasto, status ou ocupação atual |
| Agenda | Intenção futura; nunca histórico de movimento |
| GTA/documento/checklist | Evidência ou suporte regulatório; não cria o fato |
| Tags/sinais/insights | Apoio de UX/consulta; não são verdade do movimento |

## Invariantes

- Preservar `fazenda_id` em todos os vínculos tenant-scoped.
- Não criar relação entre tenants nem aceitar destino interno inacessível.
- Representar destino externo conforme o modelo existente, sem forçar FK cross-tenant.
- Não duplicar Evento no retry ou duplo envio.
- Não atualizar estado atual sem preservar o Evento correspondente quando a mudança for factual.
- Não usar estado atual como substituto do histórico nem manter ambos como fatos concorrentes.
- Não tratar documento, checklist ou sinal de compliance como prova de que o movimento ocorreu.
- Não inferir conformidade de trânsito, liberação sanitária, venda ou abate sem fonte explícita.
- Preservar offline-first, idempotência, rollback e reconciliação de sucesso parcial.

## Procedimento

### 1. Classificar o fluxo

Identificar: troca interna de lote, troca interna de pasto, entrada na fazenda, saída, saída comercial, transferência, transporte/trânsito, documentação/compliance, relatório histórico ou exibição de estado atual.

### 2. Confirmar as fontes

Localizar no código:

- Evento e detalhes que sustentam o histórico;
- read model que sustenta o estado atual;
- documento/checklist como suporte;
- gesto/fila/RPC responsáveis pela persistência, se houver.

Não presumir nomes de tabelas ou comportamento apenas pela documentação.

### 3. Validar origem, destino e elegibilidade

Confirmar:

- origem e destino existentes quando obrigatórios;
- mesma fazenda/tenant para relações internas;
- representação explícita de destino externo;
- animal/lote ativo e compatível;
- rejeição ou no-op explícito para origem igual ao destino;
- ausência de vínculo cross-tenant por payload ou FK incompleta.

### 4. Validar fato, estado e períodos

Verificar que o fluxo:

- cria ou corrige o fato uma única vez;
- fecha e abre períodos de ocupação corretamente, quando modelados;
- atualiza ou recompõe o estado atual;
- preserva a ordem temporal definida pelo contrato;
- trata lote de múltiplos animais sem ocultar sucesso parcial;
- reconcilia estado local e remoto após retry ou conflito.

### 5. Validar trânsito e compliance

Exigir GTA ou documento somente quando a regra aplicável e sua fonte estiverem explícitas. Documento ausente deve produzir pendência/exceção compatível com o contrato, nunca conformidade falsa nem criação automática do movimento.

### 6. Validar correção e rollback

Confirmar identidade estável da operação, retry sem duplicação, rollback em ordem segura e correção auditável. Não apagar silenciosamente Evento confirmado para ajustar apenas o estado atual.

## Casos mínimos

- animal vendido, morto ou inativo;
- origem igual ao destino;
- origem ou destino ausente;
- destino externo;
- animais de outra fazenda;
- seleção múltipla com falha parcial;
- duplo submit e retry offline;
- falha entre Evento e atualização do estado;
- rollback após confirmação remota;
- documento ausente, inválido ou fora de escopo;
- pendência sanitária sem fonte suficiente para bloqueio.

## Validação

Seguir `.agents/rules/rtk.md` e executar no mínimo:

```bash
git status --short --untracked-files=all
git diff --check
```

Executar testes focados do fluxo. Para mudança de domínio crítico, usar lint e build; para entrega ampla, usar a suíte completa. Se tocar Supabase, RLS, RPC, migration ou sync-batch, executar também a validação funcional de baseline indicada em `.agents/rules/rtk.md`.

Não executar reset, deploy, push ou habilitação de gate sem autorização explícita.

## Saída obrigatória

Informar:

1. fatos confirmados;
2. tipo de movimento afetado;
3. Evento e estado atual envolvidos;
4. validação de origem/destino e isolamento;
5. cobertura documental/compliance efetiva;
6. idempotência, sucesso parcial e rollback;
7. testes e resultados;
8. riscos residuais, até três.

Separar fato, inferência e recomendação. Não aprovar movimento ou compliance apenas por estado, documento, checklist, tag ou Agenda.
