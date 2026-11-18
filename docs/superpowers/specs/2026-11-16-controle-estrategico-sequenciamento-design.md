# Desenho proposto — controle estratégico individual 5-7-9 / 5-6-9

> Registro histórico da proposta de 16/11/2026. Parte do desenho foi implementada localmente após este registro; a janela de junho permanece contextual, sem materialização validada. Este documento não representa o estado de implantação remota.

Status: **proposta para implementação posterior**, não publicada nem executável. A adoção de 5-6-9 é declaração de prática da fazenda, não equivalência clínica, recomendação universal ou alteração da curadoria 5-7-9. A implementação depende do contrato factual efetivo da Fase 2 e de validação técnica da janela contextual de junho.

## Contratos observados

- O catálogo identifica `recria_maio`, `recria_julho` e `recria_setembro`; a revisão de campo os associa a `regional_applicability_5_7_9` (`20261022230000_sanitario_manual_catalog_review_v2.sql`). A política `sanitaryPlanningPolicyV2.ts` limita a revisão de avaliação a `manejo_sanitario`, produto `none` e `assessment_only`, sem dose/via. `sanitaryProtocolPrecheckV2.ts` exige contexto `rearing` para a família de recria e mantém a pré-checagem.
- `sanitaryTriageV2.ts` projeta janelas a partir da fonte e não cria fatos. `sanitaryManualAgendaV2.ts` grava snapshot da versão de protocolo e participantes explícitos; a identidade `obrigacao_origem_agenda_id` nasce no writer. `sanitaryAgendaMaterialization.ts` inclui data, lote e conjunto de animais na deduplicação atual: isso **não prova** unicidade individual de etapa/ciclo entre agrupamentos ou reagendamentos.
- `sanitary_tipo_enum` atual e `apply_factual_core` exigem um detalhe sanitário; não se presume que já representem avaliação sem aplicação. Fatos, correções, associações individuais e sincronização são responsabilidade do contrato da Fase 2. Este documento não declara esse contrato disponível.

## Identidades e configuração

Proposta de configuração na fonte canônica de configuração da fazenda, em namespace próprio versionado e atualização atômica com CAS, preservando outras chaves: `{schemaVersion: 1, revision, variant: '5-7-9' | '5-6-9', declaredAt, declaredBy, provenance, effectiveFrom}`. A revisão é imutável quando usada no snapshot de uma Agenda; a configuração corrente não reescreve agendas anteriores. Ausência, versão desconhecida ou dados malformados significa variante não definida; não inferir 5-6-9 nem alterar comportamento legado. `activated_template_slugs` mantém semântica regulatória independente.

Modelo de projeção, não tabela de fatos:

```ts
type Stage = 'may' | 'middle' | 'september';
type Context = { farmId: string; animalId: string; familyCode: 'controle_parasitario_recria_5_7_9'; cycleYear: number; variant: '5-7-9' | '5-6-9'; configRevision: number };
type StageProjection = { context: Context; stage: Stage; month: 5 | 6 | 7 | 9; window: { start: string; end: string } | null; assessment: 'not_done' | 'no_treatment_indicated' | 'treatment_indicated' | 'insufficient_data' | 'unknown'; application: 'proven' | 'not_proven' | 'unknown'; temporal: 'current' | 'future' | 'overdue' | 'unknown'; lateEntry: boolean | 'unknown'; agendaIds: string[]; evidenceEventIds: string[]; blockers: string[] };
```

O ano do ciclo é ano civil local da fazenda; a data de referência deve ser civil explícita. `lateEntry` depende de data de entrada verificável e janela; ausência gera `unknown`. Uma avaliação só satisfaz a etapa se animal participante, fazenda, família, ciclo, etapa/contexto e vínculo da versão forem comprováveis no fato válido após correções. Histórico externo sem esses vínculos resulta `unknown`, nunca dose presumida. `insufficient_data` permanece inconclusivo; `treatment_indicated` é avaliação registrada e tratamento pendente, sem comprovar administração. `no_treatment_indicated` encerra apenas a avaliação da etapa, não uma série farmacológica. Aplicação comprovada vem exclusivamente do writer farmacológico e seus participantes e guards; não se presume ausência de aplicação apenas porque a avaliação não a referencia.

## Projeção e mudança de variante

1. Carregar configuração confirmada, catálogo e versões, animais da fazenda, participantes efetivos, histórico factual e correções, além de agendas já existentes; nunca inferir participantes do lote atual. Usar dados locais reconciliados e reavaliar na mudança de fonte, data de referência, fazenda ou reconnect.
2. Resolver elegibilidade e restrições pelo precheck existente, incluindo UF, manejo, fonte e versão. Nenhuma configuração de fazenda amplia escopo regional ou substitui autorização veterinária. Para cada etapa, derivar temporalidade da janela comprovada; janela ausente gera `unknown`.
3. Aplicar fatos e cadeia de correção segundo a semântica append-only efetivamente estabelecida na Fase 2. Em duplicidade concorrente sem resolução canônica, apresentar conflito/`unknown`; não escolher silenciosamente o último timestamp. Distinguir avaliação e aplicação e projetar evidência de ambos.
4. Ao trocar variante no mesmo ano, preservar fatos e Agendas pelo snapshot da época. Maio e setembro têm mesma identidade conceitual de etapa quando o vínculo factual comprova família/ciclo; a etapa intermediária exige revisão explícita de conflito entre junho e julho, sem concluir equivalência técnica. Agendas confirmadas continuam visíveis e não são canceladas ou movidas. Até resolução explícita, impedir materialização concorrente de outra etapa intermediária para o mesmo animal/ciclo; isso é proteção operacional, não equivalência clínica. Mudança retroativa que afete fatos anteriores exige política de correção própria e fica bloqueada nesta proposta.

## Junho: prévia e writer manual futuro

Junho não aponta para `recria_julho` nem copia sua versão com mês trocado. A alternativa recomendada é etapa contextual identificada como `declared_june`, ligada à família canônica e à declaração 5-6-9, com referência ao catálogo somente como fonte de contexto familiar; sua janela civil real precisa de confirmação explícita e de cobertura técnica pertinente antes de permitir o writer. Se não houver item/contrato contextual validado que os guards atuais consigam revalidar, manter somente consulta e impedir materialização. Não criar item canônico de julho fictício nem relaxar validação para viabilizar junho.

Prévia pura propõe, para cada participante confirmado, `farmId`, `animalId`, `familyCode`, `cycleYear`, `stage: middle`, `contextualStage: declared_june`, intervalo civil efetivo, `variant`, revisão da configuração, proveniência declarada, referências e versão de suporte, e avisos/bloqueios da pré-checagem. A confirmação explícita envia ao writer canônico existente, por extensão aditiva de contrato a ser projetada e testada, snapshot imutável com esses campos e participantes efetivos em `sanitario_agenda_animais_v2`. Snapshot não contém produto, dose ou carência presumidos. O writer deve revalidar configuração/revisão, contexto, janela, catálogo, participação, permissão e concorrência dentro da transação local e novamente na admissão remota; rechecagem posterior de produto, dose, via, espécie, estoque e carência permanece obrigatória para qualquer aplicação.

Definir chave lógica individual versionada `(farmId, animalId, familyCode, cycleYear, stage)` e chave distinta de operação idempotente. A etapa intermediária é única em controle de conflito, não um fato de equivalência junho/julho; snapshot registra variante e mês efetivos. O writer deve implementar reserva/checagem atômica por chave individual no banco e no domínio local, ordenando locks para listas; concorrência entre grupos parcialmente sobrepostos retorna conflito individual explícito, sem duplicar nem cancelar agendas anteriores. A dedup atual por grupo/data/lote não é suficiente: uma futura mudança deve tratar agendas antigas sem chave como potenciais conflitos a revisar, não ignorá-las. Não prometer implementação por mera concatenação em `dedup_key`.

## Testes exigidos antes da implementação

- Os três itens 5-7-9 mantêm IDs, janelas, versão, fontes e guard regional; escolha da fazenda não valida equivalência clínica nem autoriza produto.
- Sem configuração, configuração desconhecida, UF/contexto insuficiente, janela ausente e entrada sem data nunca resultam conclusão ou elegibilidade fabricada.
- Animal com avaliação sem tratamento, com tratamento indicado ou inconclusiva projeta situações distintas; aplicação real vem apenas de Evento farmacológico válido. Correção append-only e histórico ambíguo são rastreáveis por participante e ciclo.
- Entrada tardia, janelas futuras/vencidas e retorno no ano seguinte não reescrevem o ciclo anterior; dados faltantes resultam incerteza.
- Troca 5-7-9 ↔ 5-6-9 com agendas intermediárias existentes preserva snapshot e exige resolução; a outra variante não apaga ou duplica obrigação.
- Junho sem fonte/janela/contrato contextual não materializa; com contrato autorizado, snapshot contém proveniência, revisão e janela efetivas e nunca associa o item `recria_julho` como se sua janela fosse junho.
- Confirmação manual com participantes parcialmente sobrepostos, concorrência local/remota, replay, ACK perdido, restart, farm-switch e reconnect preservam identidade individual e isolamento; snapshots e Agendas existentes permanecem íntegros.
- Prévia e planejamento não criam Evento, estoque ou carência. Aplicação exige validação comercial e farmacológica existente, inclusive após mudança de variante.

## Dependências e limite

A especificação e os nomes finais da Fase 2, semântica de correção, fonte técnica e autorização da janela contextual de junho, e mecanismo persistente de unicidade individual precisam ser resolvidos e testados antes do código da Fase 3. Nenhuma migration, mecanismo de calendário ou materialização foi criada por este desenho.
