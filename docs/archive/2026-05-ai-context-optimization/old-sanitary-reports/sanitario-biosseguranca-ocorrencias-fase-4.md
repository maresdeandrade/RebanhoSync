# Sanitário — Biossegurança e Ocorrências Sanitárias — Fase 4

## Problema inicial

O fluxo sanitário projetava itens regulatórios disponíveis como pendências gerais, especialmente biossegurança operacional, doenças notificáveis e suspeitas sanitárias. Isso misturava checklist contextual com tarefa acionável e criava bloqueio indevido para rotina normal.

## Diagnóstico 4A

- `biosseguranca-checklist` e `doencas-notificaveis-alerta` vinham do catálogo oficial/regulatório.
- Esses itens tinham `gera_agenda=false`, mas eram projetados pelo overlay/compliance como atenção operacional pendente quando não havia runtime.
- Biossegurança, notificação e checklist estavam sem separação suficiente entre contexto regulatório e ocorrência real.

## Correção 4B

- O read model de compliance passou a distinguir contexto regulatório de pendência acionável.
- Ausência de runtime deixou de significar não conformidade.
- Checklist regulatório disponível deixou de entrar em contagem de atraso, pendência ou bloqueio.

## Fluxo contextual 4C

- A rotina normal passou a ser `sem_ocorrencia_informada`.
- O usuário registra ocorrência real por ação explícita.
- O mini wizard coleta tipo, escopo, gravidade, descrição, ação imediata, `gera_pendencia` e prazo.
- Suspeita de doença notificável exige vínculo clínico com animal, animais ou lote.
- O evento continua append-only; não foi criada tabela nova de ocorrência.

## Ajustes 4C.1, 4C.2 e 4C.3

- O contexto de animal/lote foi preservado ao abrir o registro a partir de ficha individual, lote ou agenda.
- O vínculo passou a aceitar múltiplos escopos em `escopos_tipo`, mantendo `escopo_tipo` como primário compatível.
- Suspeita notificável exige vínculo clínico, mas permite vínculos adicionais coerentes.
- Lote sem animal registra suspeita no evento/payload, sem abrir `sanitario_casos` por lote.

## Contrato final de ocorrência

Evento com `payload.biosseguranca_ocorrencia`:

- `schema_version`
- `categoria_ocorrencia`: `biosseguranca` ou `suspeita_doenca_notificavel`
- `tipo_ocorrencia`
- `tipos_ocorrencia`
- `escopo_tipo`
- `escopos_tipo`
- `animal_id`
- `animal_ids`
- `lote_id`
- `local_id`
- `evento_id`
- `agenda_item_id`
- `gravidade`: `leve`, `moderada`, `alta`
- `descricao`
- `outro_relato`
- `acao_imediata`
- `gera_pendencia`
- `prazo_correcao`
- `status`: `aberta`, `resolvida`, `cancelada`

`escopo_tipo` e campos singulares permanecem para compatibilidade com dados antigos. `escopos_tipo` e `tipos_ocorrencia` representam o contrato novo.

## Quando gera pendência

Gera `agenda_itens` específica somente quando a ocorrência real registrada tem:

- `gera_pendencia === true`;
- `prazo_correcao` informado;
- evento de origem criado no mesmo gesto.

A agenda criada preserva:

- `source_evento_id`;
- `animal_id`;
- `lote_id`;
- `animal_ids`, `local_id`, `evento_id`, `agenda_item_id` no payload;
- `fazenda_id` via `createGesture`.

Tipos usados:

- `biosseguranca_acao_corretiva`;
- `sanitario_notificacao_pendente`.

## Quando não gera pendência

Não gera pendência quando:

- não há ocorrência real;
- checklist regulatório está apenas disponível;
- runtime/overlay está ausente;
- rotina normal informa `sem_ocorrencia_informada`;
- doença notificável não tem suspeita concreta;
- `gera_pendencia=false`;
- suspeita notificável não tem animal, animais ou lote.

Nunca é criada pendência geral da fazenda para confirmar ausência de doença.

## Doença notificável

- `categoria_ocorrencia=suspeita_doenca_notificavel`.
- Exige `animal_id`, `animal_ids` ou `lote_id`.
- Com `animal_id`, segue o caminho existente de `alerta_sanitario` e `sanitario_casos`.
- Com `lote_id` sem animal, fica registrada no evento/payload.
- Notificação pendente só nasce se a ocorrência real tiver `gera_pendencia=true`.

## Sinais e read models

O read model `biosecurityReadModel` deriva apenas de `eventos.payload.biosseguranca_ocorrencia` e agenda específica vinculada por `source_evento_id`.

Sinais:

- `biosseguranca:ocorrencia_aberta`
- `biosseguranca:ocorrencia_com_pendencia`
- `biosseguranca:alta_gravidade`
- `sanitario:suspeita_notificavel`
- `sanitario:notificacao_pendente`

Fonte declarada:

- `eventos.payload.biosseguranca_ocorrencia`

Fontes excluídas como primárias:

- protocolo;
- checklist regulatório;
- overlay contextual sem ocorrência;
- tags/marcadores.

## Relatórios

O resumo operacional passou a agrupar ocorrências reais por:

- período;
- `tipo_ocorrencia` / `tipos_ocorrencia`;
- gravidade;
- `escopo_tipo` / `escopos_tipo`;
- animal;
- lote;
- local;
- status;
- pendências abertas;
- suspeitas notificáveis abertas.

Tempo até resolução fica omitido quando não há data estruturada de resolução no payload.

## Testes

Coberturas adicionadas/ajustadas:

- `gera_pendencia=false` não cria agenda;
- `gera_pendencia=true` cria pendência específica vinculada ao evento;
- pendência preserva animal, animais, lote, local e evento no contrato;
- suspeita notificável sem vínculo clínico é bloqueada;
- suspeita notificável com animal/lote segue o contrato existente;
- sinais vêm de ocorrência/evento real;
- relatório agrupa por tipo, gravidade e escopo;
- payload singular antigo continua válido;
- payload novo com múltiplos tipos/escopos continua válido.

## Validações

Validações executadas na Fase 4D:

- testes focais de biossegurança, eventos e relatório;
- lint;
- build;
- validação Codex das áreas críticas;
- `git diff --check`.

## Riscos remanescentes

1. Caso notificável por lote ainda não possui `sanitario_casos` por lote; fica em evento/payload.
2. Resolução estruturada de ocorrência ainda depende de fluxo futuro para gravar data de encerramento.
3. Agenda corretiva foi criada como pendência específica mínima; execução/encerramento assistido detalhado pode evoluir em fase futura.

## Recomendação futura

Evoluir um fluxo de encerramento de ocorrência que registre resolução/cancelamento como evento de acompanhamento, atualize pendência específica e permita calcular tempo até resolução sem inferência frágil.
