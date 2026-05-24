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
| Terapia de Vaca Seca como domínio operacional relevante | Manter como objetivo, mas corrigir a formulação: hoje ela ainda não está efetivamente consolidada como agenda operacional automática. |

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
| Síndrome vesicular aparece como item próprio além do catálogo de notificáveis | Redundância e dupla entrada para suspeita notificável | Tratar como doença dentro de `catalogo_doencas_notificaveis`, mantendo ação única de registrar suspeita notificável. |
| Biossegurança aparece dentro do mesmo universo de protocolos | Checklist/compliance parece rotina sanitária animal | Reposicionar como compliance/checklist operacional, sem agenda animal automática. |
| TPB é descrito como algo a migrar, mas o código já o marca como clínico sem agenda | A proposta cria trabalho duplicado | Trocar "migrar TPB" por "proteger TPB contra regressão para agenda". |
| Terapia de Vaca Seca é proposta como agendável, mas no estado atual ainda está como roteiro clínico sem agenda | Gap funcional real | Abrir recorte próprio para definir elegibilidade, fonte de data/âncora e regra de materialização antes de torná-la agenda. |
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
| Síndrome vesicular | Doença dentro do catálogo de notificáveis | Remover como entrada visual independente quando houver tarefa de UI/catálogo. |
| Biossegurança operacional | Compliance/checklist operacional | Não exibir como protocolo animal agendável. |
| GTA/e-GTA pre-check | Checklist/documental de trânsito | Não modelar como emissão fiscal; manter como pre-check/bloqueio contextual quando validado. |
| TPB | Protocolo clínico de apoio | Proteger `gera_agenda=false`; registrar apenas condutas executadas. |
| Mastite clínica | Caso sanitário individual + protocolo clínico de apoio | Implementar futuramente no trilho de casos clínicos. |
| Terapia de Vaca Seca | Candidata a protocolo operacional por elegibilidade reprodutiva/lactação | Não tornar agendável sem definir âncora, fonte de elegibilidade e vínculo com evento. |

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
Read model futuro identifica fêmea elegível para secagem
-> protocolo operacional ativo avalia âncora e janela
-> agenda é materializada se a regra estiver completa
-> usuário executa procedimento
-> evento sanitário/produtivo é registrado
-> estoque futuro baixa antibiótico/selante confirmado
```

Regra: antes de implementar agenda, a tarefa precisa definir fonte de elegibilidade, âncora temporal, relação com reprodução/lactação e dedup.

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
- travas explícitas: a visualização não gera agenda, evento, prescrição ou baixa de estoque.

Entregas futuras:
- consolidar governança da biblioteca clínica mínima e critérios para novos roteiros sob `clinical_protocol`;
- suporte a mais roteiros clínicos quando houver biblioteca/fonte veterinária validada;
- nenhum evento ou estoque gerado por simples visualização do roteiro.

### Fase 5 — Terapia de Vaca Seca como recorte próprio

Objetivo: decidir se e como vira protocolo operacional agendável.

Pré-condições:
- fonte de elegibilidade validada;
- âncora temporal definida;
- relação com reprodução/lactação definida;
- dedup e recompute definidos;
- teste contra agenda zumbi.

Critério de aceite:
- agenda só nasce quando a elegibilidade é explicável;
- evento de secagem comprova execução;
- estoque futuro consome apenas por evento.

### Fase 6 — Estoque MVP

Objetivo: controlar insumos sem acoplamento precoce.

Escopo mínimo futuro:
- catálogo de insumos;
- apresentações;
- lotes e validade;
- movimentações de entrada/ajuste/saída;
- consumo por evento sanitário confirmado;
- demanda futura estimada por agenda válida.

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
| Protocolos clínicos de apoio | 92% | governança da biblioteca clínica mínima e critérios de expansão. |
| Terapia de Vaca Seca | 10% | definir elegibilidade, âncora, dedup e materialização. |
| Estoque MVP sanitário | 0% | criar módulo de insumos/lotes/movimentações e consumo por evento. |

Estimativa objetiva: o refatoramento estrutural sanitário está entre 80% e 84% concluído. Para fechar o núcleo mínimo sem estoque avançado, falta cerca de 1 recorte pequeno. Para fechar a visão completa com protocolos clínicos, Terapia de Vaca Seca e estoque MVP, faltam cerca de 4 a 6 recortes revisáveis.

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

O próximo passo mais seguro é consolidar governança da biblioteca clínica mínima: critérios de inclusão, limites read-only e regra explícita para não converter roteiro clínico em agenda, prescrição ou estoque.
