# Boundary Registrar x Sanitario

Status: P5, documentacao operacional local.  
Fonte primaria: codigo atual em `src/pages/Registrar/**` e `src/lib/sanitario/**`.

## Boundary atual

| Camada | Responsabilidade | Arquivos |
|---|---|---|
| UI/React | Estado visual, inputs, callbacks, efeitos de prefill/refresh e adaptacao para a tela. | `src/pages/Registrar/index.tsx`, `src/pages/Registrar/components/useRegistrarSanitarioPackage.ts`, `src/pages/Registrar/components/RegistrarSanitarioSection.tsx` |
| Registrar orchestration | Compor preflight geral, carregar contexto, tentar conclusao sanitaria online, montar plano offline/fallback e navegar/emitir feedback. | `src/pages/Registrar/createRegistrarFinalizeController.ts`, `src/pages/Registrar/effects/sanitaryContext.ts`, `src/pages/Registrar/effects/sanitaryRpc.ts`, `src/pages/Registrar/helpers/sanitaryFinalize.ts` |
| Sanitario models | Resolver pacote sanitario, montar payload persistivel, validar preflight sanitario puro e preservar produto/protocolo/compliance como dados explicitos. | `src/lib/sanitario/models/registrarPackage.ts`, `src/lib/sanitario/models/executionPayload.ts`, `src/lib/sanitario/models/executionPreflight.ts` |
| Sanitario infrastructure | Encapsular boundary RPC/fallback de conclusao sanitaria com refresh de estado apos sucesso online. | `src/lib/sanitario/infrastructure/executionBoundary.ts`, `src/lib/sanitario/infrastructure/service.ts` |
| Offline/sync | Persistir fallback por gesture/ops, manter append-only de eventos e reconciliar agenda/evento pelo sync. | `src/pages/Registrar/effects/nonFinancialFinalize.ts`, `src/lib/offline/**`, `supabase/functions/sync-batch/**` |
| SQL/RPC | Motor lider de materializacao/recompute e fechamento transacional de agenda sanitaria com evento. | `supabase/migrations/**`, RPCs como `sanitario_complete_agenda_with_event` e `sanitario_recompute_agenda_core` |

## O que o Registrar pode fazer

- Manter estado visual, selecoes e dados digitados.
- Fazer navegacao e feedback/toast.
- Compor o fluxo de finalizacao entre trilhos financeiro, sanitario, movimentacao, nutricao, reproducao e pesagem.
- Chamar boundaries/facades sanitarias ja extraidas.
- Coordenar fallback operacional geral quando o boundary sanitario retorna fallback.
- Decidir o momento de finalizar o formulario e disparar `onFinalizeHandled`.

## O que o Registrar nao deve fazer

- Montar payload sanitario persistivel manualmente quando `buildSanitaryExecutionPayload` atende o caso.
- Decidir dedup, calendario ou sequenciamento sanitario.
- Calcular materializacao de agenda sanitaria.
- Interpretar compliance sanitario profundo fora dos read models/helpers puros.
- Conhecer detalhes internos da RPC sanitaria ou do refresh pos-RPC.
- Reimplementar validacao sanitaria quando `validateSanitaryExecutionPreflight` cobre o contrato.
- Ler regras sanitarias diretamente se ja houver helper puro em `src/lib/sanitario/**`.

## Contratos sanitarios disponiveis

| Contrato | Papel | Arquivo |
|---|---|---|
| `resolveRegistrarSanitaryPackage` | Resolve pacote consumivel pelo Registrar: protocolo, produto, elegibilidade, checklist, compliance e payload sanitario derivado. | `src/lib/sanitario/models/registrarPackage.ts` |
| `buildSanitaryExecutionPayload` | Monta nome, referencia estruturada de produto e metadata de protocolo/regime para execucao sanitaria. | `src/lib/sanitario/models/executionPayload.ts` |
| `validateSanitaryExecutionPreflight` | Valida preflight sanitario puro com resultado bloqueante ou neutro/skip. | `src/lib/sanitario/models/executionPreflight.ts` |
| `executeSanitaryCompletion` | Tenta fechamento online via RPC/facade e devolve `handled`, `fallback`, `skip` ou `error`. | `src/lib/sanitario/infrastructure/executionBoundary.ts` |
| Taxonomia passiva | Resolve `ProtocolKind`, `MaterializationMode` e `ComplianceKind` sem mudar comportamento. | `src/lib/sanitario/models/taxonomy.ts`, `src/lib/sanitario/models/domain.ts` |

## Imports no Registrar

| Import no Registrar | Status | Observacao |
|---|---|---|
| Tipos de `@/lib/offline/types` (`SanitarioTipoEnum`, `ProtocoloSanitarioItem`) | permitido | Contrato de input/ops ainda cruza Registrar e dominio offline. |
| `@/lib/sanitario/models/registrarPackage` | permitido | Boundary puro criado para o hook React. |
| `@/lib/sanitario/models/executionPayload` | permitido em wrapper legado | Usado por `helpers/sanitaryFinalize.ts`; nao deve se espalhar para UI. |
| `@/lib/sanitario/models/executionPreflight` | permitido | Usado por helpers de preflight/issues para evitar regra duplicada. |
| `@/lib/sanitario/models/calendarDisplay` | permitido | Facade visual para labels de calendario no Registrar; evita import direto de `engine/calendar`. |
| `@/lib/sanitario/models/registrarProtocolEvaluation` | permitido | Facade pura para avaliacao de protocolo no contexto do Registrar; substitui import direto de `engine/protocolRules`. |
| `@/lib/sanitario/infrastructure/executionBoundary` | permitido apenas em effect/facade | `effects/sanitaryRpc.ts` deve continuar sendo wrapper fino. |
| `@/lib/sanitario/compliance/*` | permitido com cautela | Aceitavel em adapter/hook quando for tipo/read model; regra profunda deve ficar no dominio. |
| `@/lib/sanitario/engine/*` | proibido/suspeito | Sem ocorrencia ativa no Registrar pos-P5. Usar facade/model quando a necessidade for visual/descritiva. |
| RPC/Supabase direto no Registrar | suspeito | Preferir `executeSanitaryCompletion` via `effects/sanitaryRpc.ts`. |

## Inventario pos-P5 de imports sanitarios diretos

| Arquivo | Import | Status | Acao |
|---|---|---|---|
| `src/pages/Registrar/components/RegistrarSanitarioSection.tsx` | `@/lib/sanitario/models/calendarDisplay` | permitido | Substitui o import direto de `engine/calendar`; uso permanece descritivo/visual para label de calendario no select. |
| `src/pages/Registrar/helpers/protocolEvaluation.ts` | `@/lib/sanitario/models/registrarProtocolEvaluation` | permitido | Substitui o import direto de `engine/protocolRules`. |
| `src/pages/Registrar/index.tsx` | `@/lib/sanitario/compliance/regulatoryReadModel` | permitido | Mantido. Monta read model compartilhado para a tela; nao interpreta regra profunda diretamente. |
| `src/pages/Registrar/effects/bootstrap.ts` | `@/lib/sanitario/catalog/products` | permitido | Mantido. Efeito de refresh/cache do catalogo veterinario. |
| `src/pages/Registrar/effects/localQueries.ts` | `@/lib/sanitario/compliance/regulatoryReadModel` | permitido | Mantido. Carrega fonte/read model para composicao local. |
| `src/pages/Registrar/effects/sanitaryRpc.ts` | `@/lib/sanitario/infrastructure/executionBoundary` | permitido | Mantido. Wrapper fino do boundary RPC/fallback. |
| `src/pages/Registrar/effects/sanitaryContext.ts` | `catalog/products`, `compliance/transit` | permitido | Mantido. Tipos e adapter de contexto de finalizacao. |
| `src/pages/Registrar/effects/nonFinancialFinalize.ts` | `catalog/products` | permitido | Mantido. Tipo de referencia estruturada de produto no plano offline. |
| `src/pages/Registrar/helpers/payload.ts` | `@/lib/sanitario/compliance/transit` | permitido | Mantido. Builder de payload de checklist/transito. |
| `src/pages/Registrar/helpers/sanitaryFinalize.ts` | `catalog/products`, `compliance/transit`, `models/executionPayload` | permitido | Mantido. Wrapper de finalizacao que chama payload builder canonico. |
| `src/pages/Registrar/helpers/transitCompliance.ts` | `@/lib/sanitario/compliance/transit` | aceitavel temporariamente | Mantido. Helper legado ainda usa validador de checklist; nao toca engine critico. |
| `src/pages/Registrar/components/useRegistrarSanitarioPackage.ts` | `catalog/products`, `compliance/*`, `models/registrarPackage` | permitido | Mantido. Hook wrapper consome package resolver e tipos/read models. |
| `src/pages/Registrar/components/RegistrarTransitChecklistSection.tsx` | `@/lib/sanitario/compliance/transit` | permitido | Mantido. Usa tipos/opcoes do checklist na camada visual. |

Resolvido no P5:

- Import direto de `engine/protocolRules` removido de `src/pages/Registrar/**`.
- Import direto de `engine/calendar` removido de `src/pages/Registrar/**`.
- Imports diretos restantes para `engine/*`: nenhum.
- Nenhum import direto de `engine/calendar`, `engine/scheduler`, `engine/dedup` ou `engine/regimen` permanece no Registrar.
- Labels visuais de calendario no Registrar passam por `src/lib/sanitario/models/calendarDisplay.ts`.

## Auditoria do `createRegistrarFinalizeController`

Veredito: **nao mexer agora**.

Evidencia:

- O controller recebe `loadSanitaryFinalizeContext` e `trySanitaryRpcFinalize` por dependency injection; nao conhece implementacao interna de RPC, Supabase ou refresh.
- A montagem de payload sanitario esta delegada para `resolveRegistrarSanitaryFinalizeContext`, que chama `buildSanitaryExecutionPayload`.
- A validacao sanitaria esta no preflight geral por issues ja calculadas e por `validateSanitaryExecutionPreflight` em helpers.
- O fallback offline continua no plano nao financeiro existente; o controller apenas passa `sanitaryProductName`, `sanitaryProductSelection`, `sanitaryProductMetadata` e `protocoloItem`.
- A branch sanitaria ainda e explicita porque precisa decidir early return quando a RPC conclui online. Esse acoplamento e orquestracional, nao regra de dominio.

Respostas da auditoria:

| Pergunta | Resposta |
|---|---|
| O controller ainda contem logica sanitaria de dominio? | Nao de forma dominante. Ele contem branch operacional sanitaria, mas delega payload, RPC/fallback e preflight. |
| Ou apenas orquestra boundaries extraidos? | Majoritariamente orquestra boundaries extraidos e planos de trilhos. |
| Ha duplicacao de payload/preflight/boundary? | Nao foi encontrada duplicacao ativa no controller. |
| Ha branch sanitaria muito grande? | Ha branch explicita para RPC online e passagem de dados ao plano offline, mas o tamanho atual e aceitavel. |
| Ha risco de regressao se mexer agora? | Sim. Uma extracao ampla mexeria no caminho comum de todos os tipos de manejo e no fallback offline. |
| Qual menor proximo corte possivel? | Somente uma micro-extracao futura da decisao "RPC handled -> feedback/navegacao", se a branch crescer ou ganhar novos status. |

## Checklist de aceite arquitetural

- Registrar pode importar tipos e facades, mas nao engines de dedup/calendario/scheduler para decisao operacional.
- Toda execucao sanitaria deve passar por payload builder, preflight e boundary/facade existentes.
- RPC sanitaria direta deve ficar encapsulada fora de componente React.
- Fallback offline deve preservar Two Rails: evento append-only e agenda como intencao mutavel.
- Qualquer nova regra sanitaria deve entrar em `src/lib/sanitario/**` com teste de unidade/contrato antes de ser consumida pelo Registrar.
- Refatorar `createRegistrarFinalizeController` so com teste focado e evidencia de acoplamento real, nao por tamanho visual.
