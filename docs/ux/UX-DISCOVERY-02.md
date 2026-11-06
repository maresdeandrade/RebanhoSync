# UX-DISCOVERY-02 — Decisões preservadas e reconciliação pós-merge

Atualizado em: 2026-11-06

## Autoridade e proveniência

Reconciliação documental sobre `origin/main@1de7d220b368086367efb6db326bae660ff5acc1`
(#272), com incremento B02/A05 local pendente de integração. **GATE-03 = BLOQUEADO; Etapa 3 não autorizada.**
Este registro complementa o [backlog canônico](../review/MASTER_BACKLOG.md#reconciliação-dos-bloqueadores-e-decisões),
sem criar backlog, homologação UX ou autorização operacional.

Fonte preservada: `files/docs/ux/UX-DISCOVERY-02.md` no snapshot externo
`C:/Users/mares/.codex/artifacts/post-f24-preserved-1793933077154/`.
As decisões de produto foram registradas em 29/10/2026, por solicitação do PO,
sem nome civil informado. A aprovação de design V3 de 30/10 está na
[especificação canônica](../superpowers/specs/2026-10-30-sanitario-agenda-v3-design.md#autoridade-e-proveniência).
Essas aprovações não liberaram o GATE-03.

A revisão histórica dos pacotes é `main@8878cc924b57eefac8ea9a32485bba82a6adef06`.
Hashes abaixo são os registrados no snapshot, **não recalculados nesta tarefa**;
ZIPs, 36 RS, 40 JOR, 5 PER, 21 AR, 49 T, 10 AUD, 4 BLQ, 13 PND e 7 DEC mantêm
identidade e [proveniência](../review/MASTER_BACKLOG.md#proveniência-dos-pacotes-ux).

| Pacote | SHA-256 histórico |
| --- | --- |
| UX-E1 — `RebanhoSync_Discovery_UX_Etapa1_8878cc9.zip` | `1f328070a8a57e9eaf14fb7847d3398a5660a606788f0da99e281453d248a2df` |
| UX-E2 — `RebanhoSync_Discovery_UX_Etapa2_8878cc9.zip` | `271c2eb91710f13fd6e1f00b8f92c75461344faffdf7971aff46a509f38f0458` |
| UX-AUD — `RebanhoSync_UX-DISCOVERY-02_Auditoria.zip` | `787ba0c1c8f700042aed9377fd7515ec2dd542797710716fb2b3c0908c62b8f9` |

## Decisões válidas

| Decisão | Conteúdo preservado |
| --- | --- |
| DEC-001 — aprovada | Incluídas JOR-001/014/015/016/031/032/033; JOR-034 condicional. Excluídas JOR-004/005/011/021/023/025. As outras 26 não foram incluídas. Prioridade histórica não concede inclusão nem autoriza User Flows. |
| DEC-002 — aprovada | PER-001→owner, PER-002→manager, PER-003→cowboy. PER-004/técnico dedicado pós-MVP; PER-005/administração global fora do ciclo, com gate próprio. Cowboy pode trocar fazenda com membership válida; participante de pesquisa não ganha permissão. AR-11/13, membership, fazenda_id, RLS e RPC prevalecem. |
| DEC-003 — aprovada | Agenda=intenção; Evento+detalhe=fato; cancelamento/dispensa/fechamento administrativo não comprovam execução. Política normal de fechamento offline decidida no design V3; participação operacional difere de visualização. Irrecuperabilidade não autoriza fechamento forçado automático. |
| DEC-004 — aprovada | Cenário OFF aceito; consulta/planejamento dependem do contrato concreto. OFF não promete execução remota, fila para toda mutação ou compatibilidade com schema remoto incompleto. |
| DEC-005 — adiável | Navegação: usar implementação como baseline; redesign depende de decisão própria. |
| DEC-006 — não aplicável ao ciclo | JOR-027 fora do ciclo; lacuna de rastreabilidade permanece no backlog, sem bloqueio global. |
| DEC-007 — aprovada | Distinguir persistência local, fila efetiva, APPLIED, APPLIED_ALTERED, rejeição/conflito, reconciliação e convergência por operação/store/fazenda. Apresentação de sync não é recibo. |

## Afirmações técnicas reconciliadas

Os recortes V3.1/V3.2 de proteções, writer progressivo por subconjunto, leitores/efeitos
e recuperação foram integrados por #265. Participação, resolução gerencial,
fechamento com snapshot, tardios e continuidade foram integrados por #268;
consequências de óbito por #270. Portanto, as afirmações de 30/10 de que esses
recortes ainda exigiam implementação, ou de que V3 permanecia integralmente sem
autorização de implementação, estão superadas. Evidências e limites são os do
[handoff](../review/CURRENT_PHASE_HANDOFF.md) e da
[sequência canônica](../review/MASTER_BACKLOG_EXECUTION_PLAN.md#incrementos-candidatos-da-agenda-sanitária-v3).
Não repetir suas suítes ou homologações para esta reconciliação.

BLQ-001/004 têm condições documentais satisfeitas. **BLQ-002/003 continuam abertos**:
capacidade integrada não equivale à homologação das jornadas/atores selecionados
nem à certificação universal ação×role×Edge/RPC/RLS. Dados de ambiente, sync,
recuperação e convergência só sustentam afirmações no recorte efetivamente observado.
Os AUD/PND e suas restrições permanecem no backlog canônico, sem novos IDs.

O #271 preserva `eventId` no builder D7/D30/desmame e movimento distinto estável.
No incremento B02/A05 local sobre #272, o caller
[AnimalCriaInicial](../../src/pages/AnimalCriaInicial.tsx) passa pela transação de
`registerCalfJourneyGesture`: identidade por farm/Agenda, marcador técnico na gesture
e payload/horário nas operações/fatos existentes. Dois cliques e retomada não criam
outra execução; rejeição exige revisão explícita na Sincronização. A UI distingue
registro local de confirmação remota. [Contrato e evidência local](../architecture/OPERATIONAL_FLOWS.md#conclusão-d7d30desmame--b02a05);
transporte simulado e reabertura Dexie não certificam kill real ou convergência remota.
Cura de umbigo/revisão neonatal seguem a Central e o bloqueio V3 vigente;
nenhum Evento fictício ou novo writer foi criado nesta tarefa.

## Limites e reconsideração do GATE-03

Preservam-se as decisões do PO; não se exige nova decisão sobre fechamento offline.
Uma futura reconsideração exige evidência por gesto/ator no escopo escolhido e
aprovação explícita do GATE-03/Etapa 3. Não foram executados pesquisa de campo,
browser, seed operacional, testes remotos ou rollout nesta reconciliação.
Schema V3 → Edge compatível → frontend continuam dependentes de autorização própria.
F24, F24.7/F24.8 e certificação de dispositivos não são reabertos nem encerrados aqui.
