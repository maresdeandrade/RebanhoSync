# Análise Sanitária — Agenda, Clínica e Estoque

> Status: proposta revisada contra o estado real do repositório em 2026-05-20, com primeiros recortes de implementação iniciados.
> Escopo atual: documentação/proposta, classificação sanitária central, projeção visual em Agenda/Home/Dashboard/Protocolos, casos sanitários mínimos integrados ao registro de suspeita/manejo clínico e apoio clínico read-only inicial no detalhe do animal.
> Capability principal: `sanitario.agenda_clinica_estoque`. Trilhos relacionados: `sanitario.catalogo_regulatorio`, `sanitario.registro`, `agenda.recalculo`, `infra.docs`.

## 1. Veredito executivo

A direção central da proposta deve ser mantida: o bloco amplo chamado de "protocolos sanitários" precisa continuar separado em camadas distintas para evitar que agenda, suspeita clínica, checklist regulatório, tratamento e estoque sejam tratados como a mesma coisa.

O ajuste necessário é de escopo e sequência. O repositório já tem uma agenda sanitária madura, com SQL/Supabase liderando materialização/recompute, `agenda_itens` como intenção futura, `eventos`/`eventos_sanitario` como fato executado e protocolos da fazenda em `protocolos_sanitarios`/`protocolos_sanitarios_itens`. Portanto, a evolução não deve começar por uma reestruturação ampla de banco e UI. Deve começar por correção conceitual, guardrails, leitura compartilhada e somente depois avançar para casos clínicos e estoque.

## 2. O que manter

| Direção | Decisão |
|---|---|
| Separar protocolos operacionais, casos sanitários, protocolos clínicos e estoque | Manter. Essa é a correção conceitual mais importante. |
| Agenda como intenção futura | Manter e reforçar. Agenda não prova execução. |
| Evento sanitário como fato executado | Manter. Registro real vive em `eventos` + `eventos_sanitario`. |
| Doença notificável como fluxo de suspeita/caso, não rotina periódica | Manter. Não deve virar agenda recorrente. |
| TPB como protocolo clínico de apoio | Manter. No código atual, TPB já aparece com `gera_agenda=false` e `calendario_base.mode = clinical_protocol`. |
| Estoque só baixa por fato executado | Manter. Agenda pode estimar demanda, mas saldo real só muda por movimentação vinculada a evento confirmado. |
| Terapia de Vaca Seca como domínio operacional relevante | Manter como objetivo. Hoje já há evento manual estruturado no Registrar, recompute SQL condicionado, ativação/desativação explícita na UI de protocolos da fazenda e validação funcional Supabase do contrato de agenda. |

## 3. O que precisa ser otimizado

### 3.1. Evitar big bang

A proposta original colocava seed, migrations, nova modelagem de protocolos, agenda, UI, casos clínicos e estoque na mesma cadeia de refatoração. Isso é grande demais para a fase atual do RebanhoSync.

Direção corrigida:
- tratar uma capacidade principal por vez;
- preservar a agenda sanitária atual;
- adicionar estruturas novas de forma expansiva;
- validar cada etapa antes de mudar origem de agenda ou UI crítica;
- não alterar `supabase/seed.sql` sem tarefa explícita.

### 3.2. Usar a arquitetura atual como base

Não criar uma árvore nova como `src/features/sanitaryProtocols` como primeiro passo. O estado real já tem fronteiras relevantes:

| Responsabilidade | Local atual preferencial |
|---|---|
| Tipos, payload, preflight e pacote sanitário | `src/lib/sanitario/models/**` |
| Calendário, dedup, scheduler e regime | `src/lib/sanitario/engine/**` |
| Catálogo base/oficial e produtos | `src/lib/sanitario/catalog/**` |
| Compliance, alerts, read model regulatório | `src/lib/sanitario/compliance/**` |
| RPC/fallback e serviço sanitário | `src/lib/sanitario/infrastructure/**` |
| Customização por fazenda | `src/lib/sanitario/customization/**` |
| UI de protocolos | `src/components/sanitario/**` e `src/pages/ProtocolosSanitarios/**` |
| Fluxo operacional | `src/pages/Registrar/**` e `src/pages/Agenda/**` |

Novos módulos de caso clínico e estoque podem nascer depois, mas devem nascer integrados a esses boundaries, não como substitutos imediatos.

### 3.3. Corrigir a tese "agenda depende de biblioteca TypeScript solta"

Essa frase não deve guiar a implementação. O estado atual documentado é:
- SQL/Supabase lidera a materialização e recompute da agenda sanitária;
- TypeScript mantém contratos, adapters, suporte offline/local, testes de paridade e golden tests;
- dedup sanitário existe em TS/SQL;
- `sanitario_complete_agenda_with_event` conclui agenda sanitária vinculando evento.

Formulação corrigida: a agenda sanitária deve continuar tendo SQL como motor líder, TS como camada de contrato/paridade e UI sem regra de negócio forte.

### 3.4. Separar catálogo oficial, overlay e rotina operacional

Itens como biossegurança, GTA/e-GTA, feed-ban, quarentena, água/limpeza, doença notificável e protocolo operacional não devem competir na mesma lista visual como se todos fossem "protocolo agendável".

Direção corrigida:
- catálogo oficial/global: conteúdo regulatório ou técnico mínimo;
- overlay/config da fazenda: `fazenda_sanidade_config` e runtime de compliance;
- protocolo operacional da fazenda: regra que pode materializar agenda;
- caso sanitário: acompanhamento longitudinal por animal;
- protocolo clínico: roteiro de apoio, sem evento automático.

## 4. Gaps e falhas identificadas

| Gap/falha | Impacto | Correção proposta |
|---|---|---|
| Mistura visual e conceitual entre protocolo, checklist, alerta e tratamento | Usuário interpreta itens não agendáveis como rotina operacional | Criar classificação explícita por tipo de item e esconder/rebaixar itens não agendáveis nas telas de agenda operacional. |
| Síndrome vesicular aparecia como item próprio além do catálogo de notificáveis | Redundância e dupla entrada para suspeita notificável | Corrigido: removida a verificação PNEFA independente do seed; síndrome vesicular permanece como doença em `catalogo_doencas_notificaveis`, pelo fluxo único de registrar suspeita e orientar notificação. |
| Biossegurança aparece dentro do mesmo universo de protocolos | Checklist/compliance parece rotina sanitária animal | Reposicionar como compliance/checklist operacional, sem agenda animal automática. |
| TPB é descrito como algo a migrar, mas o código já o marca como clínico sem agenda | A proposta cria trabalho duplicado | Trocar "migrar TPB" por "proteger TPB contra regressão para agenda". |
| Terapia de Vaca Seca é proposta como agendável e agora possui ativação controlada na UI de protocolos da fazenda | Gap funcional corrigido no contrato mínimo | Manter evento manual e recompute SQL com ativação explícita; exposição controlada decidida para `owner`/`manager` em modo completo e smoke real automatizado via scripts Codex. |
| Estoque é colocado cedo demais no plano | Alto acoplamento com evento, produto, lote, validade, offline e sync | Primeiro estabilizar consumo conceitual por evento; implementar estoque MVP depois de casos/protocolos clínicos mínimos. |
| Casos sanitários não existiam como fonte consolidada na baseline ativa | Eventos clínicos ficavam sem contexto longitudinal | Corrigido no recorte mínimo: `sanitario_casos`, store offline, sync, detalhe do animal, suspeita notificável e vínculo/abertura no `Registrar`. |
| Plano original altera seed/migrations cedo demais | Risco contra regra do projeto e baseline Supabase | Transformar seed/migration em etapas futuras explícitas, não ação desta revisão. |

## 5. Contrato conceitual revisado

| Camada | Fonte/estrutura atual ou futura | Regra |
|---|---|---|
| Protocolo operacional da fazenda | `protocolos_sanitarios` + `protocolos_sanitarios_itens` | Regra configurada; pode gerar agenda quando ativo, elegível e `gera_agenda=true`. |
| Catálogo oficial/técnico | `catalogo_protocolos_oficiais`, `catalogo_protocolos_oficiais_itens`, `catalogo_doencas_notificaveis`, `produtos_veterinarios` | Base de referência; não prova execução e não deve virar configuração tenant-scoped por acidente. |
| Agenda | `agenda_itens` / `state_agenda_itens` | Intenção futura mutável; não é histórico. |
| Evento sanitário | `eventos` + `eventos_sanitario` | Fato executado; base para histórico e consumo real. |
| Caso sanitário | `sanitario_casos` / `state_sanitario_casos` | Contexto longitudinal por animal; não substitui evento. Eventos podem apontar para o caso por `eventos.sanitario_caso_id`. |
| Protocolo clínico | Futuro catálogo/modelo clínico ou extensão bem tipada da biblioteca atual | Roteiro de apoio; não gera agenda nem evento sozinho. |
| Estoque | Futuro módulo de insumos/lotes/movimentações | Entrada/saída física/econômica; consumo real nasce de evento confirmado ou movimentação explícita. |

## 6. Reclassificação corrigida dos itens citados

| Item atual/proposto | Destino correto | Ação recomendada |
|---|---|---|
| Brucelose PNCEBT | Protocolo operacional/regulatório agendável sob regra validada | Manter e proteger gates de elegibilidade, dedup e conclusão factual. |
| Raiva dos herbívoros | Protocolo operacional condicionado a risco médio/alto e ativação explícita | Manter sem vacinação universal. |
| Clostridioses, vermifugação, carrapato | Protocolos técnicos recomendados ativáveis pela fazenda | Manter como agenda somente após ativação/configuração explícita. |
| Doenças notificáveis - registrar suspeita | Ação única de abertura de suspeita/caso | Manter como entrada operacional, sem agenda periódica. |
| Síndrome vesicular | Doença dentro do catálogo de notificáveis | Corrigido: sem entrada visual/pack independente; usar "Doenças notificáveis - registrar suspeita". |
| Biossegurança operacional | Compliance/checklist operacional | Não exibir como protocolo animal agendável. |
| GTA/e-GTA pre-check | Checklist/documental de trânsito | Não modelar como emissão fiscal; manter como pre-check/bloqueio contextual quando validado. |
| TPB | Protocolo clínico de apoio | Proteger `gera_agenda=false`; registrar apenas condutas executadas. |
| Mastite clínica | Caso sanitário individual + protocolo clínico de apoio | Implementar futuramente no trilho de casos clínicos. |
| Terapia de Vaca Seca | Evento manual estruturado, recompute SQL condicionado, ativação operacional explícita na cópia da fazenda, exposição controlada por modo completo e smoke real automatizado | Manter sem uso amplo para estoque/prescrição; promover apenas como controle operacional explícito de agenda. |

## 7. Fluxos alvo corrigidos

### 7.1. Protocolo operacional agendável

```text
Catálogo/template disponível
-> fazenda ativa/configura protocolo
-> motor SQL/RPC materializa agenda elegível
-> usuário executa ou registra pelo fluxo correto
-> evento sanitário é criado
-> agenda vinculada é concluída
-> recompute/dedup reconcilia próximas pendências
```

Regra: protocolo ativo não é execução. Agenda aberta não é execução. Execução exige evento.

### 7.2. Suspeita notificável

```text
Usuário escolhe "Registrar suspeita notificável"
-> seleciona um animal
-> escolhe doença do catálogo
-> registra sinais/observações
-> sistema cria evento de alerta/suspeita e, futuramente, caso sanitário
-> read model/compliance sinaliza bloqueios quando validado
```

Regra: suspeita notificável não deve virar agenda periódica. O caso futuro agrupa acompanhamento; o evento continua comprovando cada fato registrado.

### 7.3. Manejo clínico com TPB

```text
Usuário identifica suspeita clínica em um animal
-> abre caso clínico ou registra evento clínico no fluxo atual
-> consulta roteiro TPB
-> registra produto/procedimento efetivamente aplicado
-> evento sanitário é salvo
-> estoque futuro baixa apenas o item realmente registrado
```

Regra: protocolo clínico não prescreve automaticamente, não cria evento sozinho e não baixa estoque sem confirmação.

### 7.4. Terapia de Vaca Seca

```text
Recompute SQL identifica fêmea elegível para secagem
-> protocolo operacional ativo avalia âncora e janela
-> agenda é materializada se a regra estiver completa
-> usuário executa procedimento
-> evento sanitário/produtivo é registrado
-> estoque futuro baixa antibiótico/selante confirmado
```

Regra: a agenda automática de Vaca Seca só pode nascer de protocolo operacional da fazenda com ativação explícita. O SQL já materializa esse contrato via wrapper de `sanitario_recompute_agenda_core`: fonte de elegibilidade em `taxonomy_facts`, âncora em `data_prevista_parto`, vencimento alvo em parto previsto - 60 dias, clamp por `_as_of`, dedup por ciclo de parto previsto e bloqueios anti-agenda-zumbi. O item clínico padrão permanece `gera_agenda=false`; a UI de protocolos da fazenda permite converter explicitamente a cópia tenant-scoped do item para `gera_agenda=true` com `agenda_activation.mode=dry_off_reproductive_window`. O evento manual estruturado pelo `Registrar` continua sendo a comprovação factual da secagem.

## 8. Plano incremental revisado

### Fase 0 — Fechar contrato documental

Objetivo: estabilizar a taxonomia sem código.

Entregas:
- matriz "manter / otimizar / gap" deste documento;
- definição explícita de itens agendáveis, não agendáveis, clínicos e compliance;
- lista do que exige task separada: seed, migrations, UI e estoque.

Critério de aceite:
- nenhuma mudança funcional;
- proposta alinhada a Two Rails, SQL como motor líder e offline-first.

### Fase 1 — Guardrail de classificação sanitária

Objetivo: impedir regressões conceituais antes de mexer em banco.

Status: iniciado.

Entregas já realizadas:
- helper central para classificar itens sanitários como `operational_protocol`, `clinical_protocol`, `notifiable_suspicion`, `compliance_check`, `execution_record`, `inventory_signal` ou `unknown`;
- testes de taxonomia para proteger TPB como protocolo clínico sem agenda operacional;
- read model de atenção sanitária expondo a classe operacional de cada item e os agregados por classe;
- lembretes sanitários filtrando apenas protocolos operacionais agendáveis;
- relatórios operacionais exibindo a classe sanitária de itens de agenda.

O que ainda falta:
- auditar seed/catálogo com tarefa própria antes de remover entradas redundantes;
- expandir a proteção para qualquer novo template sanitário criado no catálogo oficial ou da fazenda.

Sem migration nesta fase.

### Fase 2 — UX/read model de separação visual

Objetivo: reduzir confusão sem alterar o motor de agenda.

Status: iniciado.

Entregas já realizadas:
- Agenda passou a filtrar por classe operacional sanitária;
- Home e Dashboard passaram a expor atalhos por classe para a Agenda filtrada;
- Dashboard adicionou leitura "Agenda sanitária por classe";
- navegação filtrada por calendário/classe foi centralizada em helper compartilhado;
- rótulos de classe sanitária passaram a vir de helper central, não de reconstrução local em UI.
- Protocolos Sanitários passou a expor navegação separada para pack oficial, conformidade e protocolos da fazenda;
- etapas dos protocolos da fazenda exibem a classe operacional sanitária calculada centralmente.
- o pack oficial passou a separar visualmente itens de agenda operacional de itens não agendáveis como compliance/checklist e suspeita notificável, usando helper central de apresentação.
- o overlay/conformidade passou a destacar bloqueio operacional, checklist documental, checklist operacional e sinal de notificacao como classes visuais derivadas do read model.
- suspeitas/notificáveis no pack oficial passaram a aparecer como ação por animal, com navegação para escolha do animal, e não como rotina recorrente.
- itens clínicos em protocolos da fazenda passaram a aparecer como apoio clínico, com ação de registro sanitário, sem serem apresentados como agenda operacional comum.
- o detalhe do animal passou a projetar suspeita sanitária como caso sanitário mínimo derivado do alerta, sem criar entidade persistida nem alterar o contrato de eventos.

O que ainda falta:
- integrar encerramento clínico a uma fonte veterinária consolidada quando esse contrato existir.

Critério de aceite:
- sem regra forte na UI;
- UI consome classificação central;
- termos operacionais respeitam `Registrar`, `Executar`, `Encerrar`, `Cancelar` e `Aplicar protocolo`.

### Fase 3 — Casos sanitários mínimos

Objetivo: criar contexto longitudinal por animal.

Status: iniciado.

Entregas realizadas:
- tabela `sanitario_casos` tenant-scoped, com RLS por membership, FK composta para animal e vínculo opcional em `eventos.sanitario_caso_id`;
- store offline `state_sanitario_casos`, pull inicial e sync-batch alinhados ao novo contrato;
- detalhe do animal passa a consumir caso persistido quando houver, mantendo alerta legado como fallback.
- abertura de suspeita notificável cria caso sanitário persistido no mesmo gesto do evento de alerta e já grava o evento com `sanitario_caso_id`;
- encerramento de suspeita notificável atualiza o caso no mesmo gesto do evento de encerramento, mantendo o evento como fato append-only.
- `Registrar` permite vincular manejo sanitário a um caso clínico ativo de um animal selecionado;
- `Registrar` permite abrir novo caso clínico no mesmo gesto do evento sanitário executado, gerando `sanitario_casos` antes do evento vinculado;
- o caminho de RPC sanitário é bypassado quando há vínculo/criação de caso, preservando atomicidade local/offline do gesto com caso + evento.
- detalhe do animal lista casos sanitários persistidos, mostra eventos vinculados por caso e permite seguir registrando manejo no caso aberto;
- detalhe do animal permite encerrar manualmente caso clínico com validação de desfecho, observação obrigatória quando aplicável e atualização de `sanitario_casos` como estado mutável sem criar evento artificial.
- detalhe do animal mostra timeline filtrada por caso usando `eventos.sanitario_caso_id`, sem alterar a timeline geral nem o contrato append-only de eventos.

Entregas futuras:
- integrar encerramento clínico a uma fonte veterinária consolidada quando esse contrato existir.

Progresso estimado da Fase 3: aproximadamente 95% concluída. Falta apenas integração veterinária futura quando houver fonte consolidada.

Requisitos:
- migration própria;
- RLS por `fazenda_id`;
- FKs compostas;
- compatibilidade offline/sync;
- eventos continuam append-only.

### Fase 4 — Protocolos clínicos de apoio

Objetivo: estruturar roteiros clínicos sem automação indevida.

Entregas realizadas:
- helper puro `buildClinicalProtocolSupport` em `src/lib/sanitario/compliance/clinicalProtocols.ts`;
- detecção contextual inicial de TPB e mastite a partir do caso clínico e dos eventos vinculados;
- seleção/override explícito do roteiro por `clinical_protocol_id`, aliases compatíveis ou código clínico estruturado;
- visualização read-only no detalhe do animal, dentro do caso sanitário;
- indicação visual da origem da seleção (`Contexto` ou `Selecionado`);
- ação explícita por item do roteiro para abrir o `Registrar` com `produto`, `sanitarioTipo=medicamento` e `sanitarioCasoId` pré-preenchidos;
- referência `clinical_protocol` persistida no payload do evento sanitário somente após salvamento explícito no `Registrar`;
- contrato público versionado `payload.clinical_protocol` com `schema_version=1`, helper único de build/read em `src/lib/sanitario/compliance/clinicalProtocols.ts` e testes de compatibilidade;
- timeline do caso sanitário mostrando leitura operacional read-only do roteiro/conduta quando o evento vinculado possui `payload.clinical_protocol`;
- filtro auxiliar no painel de casos por roteiro clínico derivado do caso/eventos vinculados;
- roteiro clínico read-only de diarreia neonatal (`med-diarreia-neonatal`) adicionado sob o mesmo contrato, com `gera_agenda=false` e sem impacto em estoque;
- roteiros clínicos read-only de suporte respiratório/pneumonia (`med-respiratorio-pneumonia`) e feridas/miíase (`med-ferida-miiase`) adicionados com o mesmo contrato, `gera_agenda=false` e leitura por contexto/código clínico;
- governança mínima implementada como contrato TS testável em `CLINICAL_PROTOCOL_LIBRARY_GOVERNANCE` e `validateClinicalProtocolLibraryGovernance`;
- critérios de inclusão formalizados: caso sanitário clínico, condição reconhecida por código/payload/contexto e roteiro apenas orientativo;
- efeitos proibidos formalizados: não materializar agenda, não criar evento sem ação explícita, não prescrever automaticamente, não baixar estoque e não substituir avaliação veterinária;
- regra de item clínico protegida por teste: `gera_agenda=false`, `calendario_base.mode=clinical_protocol` e `target_policy.target_scope=animal`;
- travas explícitas: a visualização não gera agenda, evento, prescrição ou baixa de estoque.

Entregas futuras:
- suporte a mais roteiros clínicos quando houver biblioteca/fonte veterinária validada;
- revisar UX fina do card clínico com dados reais de beta interno;
- nenhum evento ou estoque gerado por simples visualização do roteiro.

### Fase 5 — Terapia de Vaca Seca como recorte próprio

Objetivo: decidir se e como vira protocolo operacional agendável.

Pré-condições:
- fonte de elegibilidade mínima mapeada em read model puro (`sexo=F`, `status=ativo`, `em_lactacao=true`, `secagem_realizada=false`);
- âncora temporal preliminar definida por `data_prevista_parto`;
- relação com reprodução/lactação definida como dependência de fatos de taxonomia/reprodução, não de texto livre;
- dedup TS definido por animal + ciclo de parto previsto;
- recompute SQL definido;
- teste contra agenda zumbi.

Entregas realizadas:
- `evaluateDryCowTherapyReadiness` criado em `src/lib/sanitario/compliance/dryCowTherapy.ts`;
- janela candidata parametrizada, por padrão 45-75 dias antes do parto previsto;
- decisão explícita entre `keep_as_clinical_protocol` e `candidate_for_future_agenda_contract`;
- `agendaMaterializationAllowed=false` fixo, inclusive para candidatas, até existir contrato de agenda/recompute;
- payload versionado `dry_cow_therapy` definido para evento manual, com `schema_version=1`, `performed_at`, parto previsto, decisão de prontidão e `agenda_materialization_allowed=false`;
- dedup canônico TS definido por `buildDryCowTherapyDedupKey`: `sanitario:animal:<animal_id>:terapia_vaca_seca:secagem-intramamario:v1:window:<data_prevista_parto>`;
- reconhecimento central de `clinical_protocol` da terapia de vaca seca para o fluxo operacional;
- `Registrar` conectado ao recorte manual: evento sanitário grava `payload.dry_cow_therapy` e mantém `agenda_materialization_allowed=false`;
- fallback offline forçado para secagem manual, preservando `1 acao -> 1 createGesture` com evento e atualização do animal no mesmo gesto;
- atualização restrita de `taxonomy_facts` do animal no evento manual (`secagem_realizada=true`, `data_secagem`, `em_lactacao=false`), sem agenda, RPC, estoque ou schema novo;
- contrato TS de materialização definido em `DRY_COW_THERAPY_MATERIALIZATION_CONTRACT`, com `status=sql_contract_implemented_activation_required`;
- preview determinístico de candidato em `buildDryCowTherapyAgendaCandidatePreview`, sem criar agenda por si só;
- contrato de agenda fixado: owner SQL `sanitario_recompute_agenda_core`, âncora `taxonomy_facts.data_prevista_parto`, due date `max(as_of, data_prevista_parto - 60 days)`, dedup `window:<data_prevista_parto>` e conclusão por `dry_off_dedup_key`;
- regras anti-agenda-zumbi formalizadas: cancelar pendência automática se elegibilidade cair, não criar fora da janela 75-45 dias, não criar se `secagem_realizada=true`, não recriar quando evento `dry_cow_therapy` ou agenda concluída com evento válido já existir;
- migration `20260524000000_dry_cow_therapy_agenda_recompute.sql` adicionada com recompute incremental por wrapper: preserva a lógica base em `sanitario_recompute_agenda_core_without_dry_cow`, adiciona `sanitario_recompute_dry_cow_therapy_agenda` e mantém `sanitario_recompute_agenda_core` como owner público do recompute;
- materialização SQL condicionada a protocolo operacional da fazenda com `gera_agenda=true`, `family_code=terapia_vaca_seca`, `item_code=secagem-intramamario` e `agenda_activation.mode=dry_off_reproductive_window`;
- payload da agenda materializada inclui `materialization_contract_version=1`, `anchor_fact`, `expected_calving_date`, `dry_off_target_date`, `dry_off_dedup_key` e `source=dry_cow_therapy_sql_recompute`;
- UI de protocolos da fazenda adiciona ação explícita no item de Vaca Seca para ativar/desativar agenda na cópia tenant-scoped, emitindo `createGesture` de update em `protocolos_sanitarios_itens` sem alterar a biblioteca canônica, sem criar evento e sem tocar estoque;
- script funcional `scripts/codex/validate-dry-cow-therapy-functional.mjs` valida no Supabase local: item clínico sem ativação não materializa agenda, ativação operacional materializa uma única agenda, recompute repetido não duplica, conclusão por `sanitario_complete_agenda_with_event` grava `dry_off_dedup_key` em `eventos`/`eventos_sanitario`, recompute pós-evento não recria agenda e pendência aberta é cancelada quando `secagem_realizada=true`;
- testes cobrindo candidata válida, ausência de parto previsto, macho/inativo/não lactante/já seco, janela inválida, payload legado plano, dedup estável/nulo, payload de evento, reconhecimento do protocolo clínico, payload de taxonomia, plano offline do Registrar, contrato TS, preview de agenda e contrato textual da migration SQL.

Critério de aceite:
- agenda só nasce quando a elegibilidade é explicável;
- evento de secagem comprova execução e carrega `payload.dry_cow_therapy`;
- estoque futuro consome apenas por evento.

### Fase 6 — Estoque MVP

Objetivo: controlar insumos sem acoplamento precoce.

Status atual:
- contrato puro `evaluateSanitaryInventoryConsumptionReadiness` implementado para delimitar a fonte segura de baixa futura;
- evento sanitário confirmado + detalhe sanitário + produto catalogado pode originar movimentação manual futura;
- protocolo, agenda, roteiro clínico, evento removido, evento não sanitário, evento sem produto e produto em texto livre sem conciliação ficam bloqueados;
- o contrato retorna `createsStockMutation=false`, preservando que o registro de evento não baixa saldo nem cria movimentação automaticamente;
- migration inicial `20260525000000_insumos_inventory.sql` adicionada com `insumos`, `insumo_apresentacoes`, `insumo_lotes` e `insumo_movimentacoes`, todas tenant-scoped por `fazenda_id`;
- saldo segue modelo híbrido: `insumo_movimentacoes` é razão auditável append-only e `insumo_lotes.saldo_atual_base` é projeção operacional materializada por trigger;
- offline/sync conhece as quatro novas tabelas por `state_*`, `TABLE_MAP`, pull inicial, reset por fazenda e refresh pós-sync de lotes quando há movimentação;
- contrato nutricional inicial cobre `eventos_nutricao` em kg e `eventos_pasto_avaliacao` com suplemento; suplemento em sacos exige apresentação para conversão.
- UI operacional `/insumos` adicionada com leitura principal por categorias em abas, filtros secundários por tipo/período/busca, cards com quantidade atual e lançamentos `+/-` do período, entrada inicial de insumo/apresentação/lote, entrada complementar em lote existente, ajuste positivo/negativo auditável e baixa manual explícita por evento confirmado.
- `/insumos` agora puxa eventos fonte sanitários/nutricionais/pastagem em modo merge e atualiza o catálogo veterinário ao montar, evitando tela sem eventos elegíveis quando aberta diretamente.
- edição inline de cadastro em `/insumos` permite corrigir nome/categoria/ativo do insumo, nome/fabricante da apresentação e identificação/validade/fabricante/local/status do lote sem alterar saldo, quantidade inicial, unidade base ou movimentações históricas.
- `Relatorios` inclui resumo operacional de estoque com insumos/lotes ativos, entradas e saídas do período, agregação por categoria, lista de itens/lotes, ressuprimento parametrizado, demanda futura estimada por agenda sanitária aberta válida, saldo/gap por produto e exportação por CSV/impressão.
- `/insumos` permite configurar estoque mínimo e ponto de ressuprimento por insumo em `payload.inventory_policy`, preservando saldo como projeção de movimentações e sem criar baixa automática.
- Smoke operacional em app real local validou entrada inicial, entrada em lote existente, ajuste negativo, consumo nutricional, consumo sanitário e consumo em ronda de pasto.

Escopo mínimo restante:
- alerta operacional consolidado de reposição combinando saldo, ressuprimento parametrizado e demanda futura.

Requisitos:
- não fazer estoque fiscal/contábil avançado;
- não baixar saldo por agenda;
- não baixar saldo por protocolo clínico visualizado;
- offline/sync e rollback auditados.

## 9. Ordem recomendada de execução

| Ordem | Bloco | Tipo de mudança |
|---:|---|---|
| 1 | Guardrail documental e classificação sanitária | docs/testes puros |
| 2 | Separação visual entre agendável, clínico, notificável e compliance | UI + helpers centrais |
| 3 | Protocolos Sanitários: separar rotinas, notificáveis, clínicos e compliance | UI + read model central |
| 4 | Auditoria específica de seed/catálogo para itens redundantes | seed/catálogo, tarefa explícita |
| 5 | Casos sanitários mínimos | migration + RLS + offline |
| 6 | Protocolos clínicos de apoio | domínio + UI de caso |
| 7 | Terapia de Vaca Seca como recorte agendável | agenda/recompute |
| 8 | Estoque MVP | domínio transversal + sync |

## 9.1. Estimativa de término do refatoramento sanitário

Considerando o recorte desta proposta, não o produto sanitário completo:

| Frente | Status estimado | Falta principal |
|---|---:|---|
| Contrato conceitual e classificação | 90% | auditoria específica de seed/catálogo redundante. |
| Separação visual operacional | 85% | ajustes finos de UX e consistência cross-flow. |
| Casos sanitários mínimos | 95% | integração veterinária futura quando houver fonte consolidada. |
| Protocolos clínicos de apoio | 96% | UX fina com dados reais e expansão somente quando houver fonte veterinária validada. |
| Terapia de Vaca Seca | 99% | smoke visual/operacional em app real executado com Docker/Supabase local, Vite e Chrome/Edge CDP; falta apenas ajuste fino visual com dados beta se surgir atrito. |
| Estoque MVP sanitário/nutricional | 98% | schema tenant-scoped, RLS, sync/offline, contratos puros, UI operacional por categoria, entradas, ajustes, consumo manual, edição de cadastro, estoque mínimo/ponto de ressuprimento por insumo, relatórios CSV/impressão, demanda futura por agenda válida e smoke real local já existem; ainda falta alerta operacional consolidado de reposição. |

Estimativa objetiva: o refatoramento estrutural sanitário está entre 99% e 100% concluído no núcleo mínimo sem estoque avançado. O recorte de Vaca Seca já tem decisão de exposição controlada e smoke real executado em app local; a frente restante passa a ser refinamento operacional do estoque MVP, começando por alerta operacional consolidado de reposição.

## 10. Fora do escopo desta proposta

- prontuário veterinário completo;
- prescrição automática;
- diagnóstico automatizado;
- estoque contábil/fiscal avançado;
- emissão GTA/e-GTA;
- carência ativa operacional universal;
- pronto para venda/abate;
- SISBOV/fiscal completo;
- IA gerando agenda ou concluindo execução;
- mudança em migrations, seed, RLS ou RPC sem task explícita.

## 11. Critérios de aceite para qualquer implementação futura

- Preservar `fazenda_id` como fronteira de isolamento.
- Preservar Two Rails: agenda é intenção, evento é fato.
- Preservar `1 acao -> 1 createGesture`.
- Não colocar regra de negócio forte em componente React.
- Não expor `service_role` no client.
- Não transformar protocolo clínico em prescrição.
- Não gerar evento por simples agenda, roteiro, checklist ou protocolo ativo.
- Não baixar estoque sem evento/movimentação confirmada.
- Não tratar compliance sanitário como bloqueio universal sem read model/guard validado.
- Rodar validações focadas do hotspot tocado, incluindo `scripts/codex/validate.ps1` quando a área for crítica.

## 12. Decisão final

A proposta deve seguir adiante, mas rebaixada de "reestruturação ampla imediata" para "plano incremental de consolidação sanitária".

O núcleo a preservar é:
- protocolos operacionais geram agenda quando elegíveis;
- casos sanitários organizam contexto longitudinal por animal;
- protocolos clínicos orientam, mas não executam;
- estoque registra insumo real e só baixa por fato/movimentação;
- catálogo oficial, overlay regulatório e protocolo da fazenda continuam separados.

O próximo passo mais seguro é consolidar alerta operacional de reposição combinando saldo, ponto de ressuprimento e demanda futura.
