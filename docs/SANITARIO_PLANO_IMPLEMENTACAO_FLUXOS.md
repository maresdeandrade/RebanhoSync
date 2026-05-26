# Plano implementado — fluxos sanitários, protocolos, agenda e suprimentos

## Escopo do recorte

Este recorte implementa a primeira onda operacional do plano sanitário sem alterar migrations nem contratos de sync/offline. O foco é tornar explícito para o operador:

- qual camada originou o protocolo;
- se o protocolo está ativo e materializado;
- se seus itens geram agenda ou são apenas referência;
- por que a agenda sanitária pode estar vazia;
- como estoque sanitário, lote e consumo se conectam ao evento.

## Fluxos sanitários ponta a ponta

### 1. Ativação de pack oficial

1. Operador informa UF, aptidão, sistema, riscos sanitários e modo de calendário.
2. Catálogo oficial seleciona frentes regulatórias aplicáveis.
3. Configuração sanitária da fazenda é gravada.
4. Protocolos operacionais já materializados na fazenda passam a ser lidos em `protocolos_sanitarios` e `protocolos_sanitarios_itens`.
5. A UI diferencia pack oficial ativado de protocolo operacional que realmente gera agenda.

### 2. Materialização de agenda sanitária

1. Recompute considera somente protocolo ativo, item ativo e `gera_agenda=true`.
2. O animal precisa estar elegível por espécie, sexo, idade e status.
3. Configurações de risco/pressão precisam estar preenchidas quando a família sanitária depende delas.
4. Campanhas dependem de janela mensal válida.
5. Dependências entre doses precisam estar concluídas.
6. A agenda é criada com dedup determinístico; se alguma condição falhar, o diagnóstico local mostra o motivo provável.

### 3. Execução pela Agenda

1. Operador abre uma pendência sanitária.
2. A linha mostra protocolo, produto, periodicidade, status operacional e próximo passo.
3. Executar conclui via serviço sanitário e cria evento.
4. Recompute cria próximas doses/ocorrências.
5. Consumo de estoque pode ser registrado em Insumos com vínculo ao evento sanitário; eventos com produto catalogado podem abrir `/insumos` com a fonte pré-selecionada, mas a baixa permanece gesto separado.

### 4. Registro manual no Registrar

1. Operador registra evento sanitário sem pendência explícita.
2. O fluxo tenta pré-preencher protocolo/produto quando a origem é uma agenda.
3. Reconciliação busca pendências por protocolo e produto.
4. Quando não há vínculo explícito, a operação deve ser tratada como registro manual sujeito a revisão operacional.

### 5. Gestão de suprimentos

1. Item sanitário é cadastrado com unidade base, produto veterinário opcional, apresentação e lote.
2. Entrada cria lote e movimentação inicial.
3. Ajustes manuais corrigem saldo operacional.
4. Consumo por evento baixa lote específico e preserva vínculo com `source_evento_id`.
5. Cartões de lote destacam validade, saldo, estoque mínimo e ponto de ressuprimento.

### 6. Pré-requisitos da Fase 3 de estoque

1. Relatórios medem eventos sanitários com produto veterinário catalogado.
2. Produto catalogado só conta como mapeado de forma confiável quando aponta para exatamente um insumo sanitário ativo.
3. O insumo mapeado precisa ter lote ativo e apresentação compatível com a unidade base.
4. A cobertura de consumo assistido é medida por movimentações reais vinculadas a evento sanitário.
5. A baixa automática permanece desabilitada até esses critérios estarem validados em uso real.

## Glossário operacional

| Termo | Significado |
| --- | --- |
| Agenda | Intenção futura e mutável em `agenda_itens`. |
| Evento | Fato histórico append-only em `eventos` e tabela especializada. |
| Protocolo oficial | Frente regulatória do catálogo oficial aplicável por UF/aptidão/sistema. |
| Protocolo operacional | Configuração materializada da fazenda em `protocolos_sanitarios`. |
| Item de protocolo | Etapa/dose/procedimento que pode ou não gerar agenda. |
| Materializado | Existe localmente para a fazenda, mesmo que não esteja ativo. |
| Gera agenda | Item ativo participa do recompute e cria pendências automáticas. |
| Somente referência | Item/protocolo informativo, de compliance ou execução avulsa. |
| Dedup key | Chave canônica que evita duplicidade entre agenda e histórico. |
| Reason code | Código operacional para explicar ausência/bloqueio de agenda. |
| FEFO | Sugestão de consumo pelo lote com validade mais próxima. |
| Ressuprimento | Política de estoque mínimo e ponto de compra. |

## Matriz agenda/evento/protocolo/estoque/compliance

| Objeto | Responsabilidade | Fonte | Indicadores |
| --- | --- | --- | --- |
| Protocolo oficial | Define obrigação/recomendação sanitária | Catálogo oficial | Oficial ativado, somente referência |
| Protocolo operacional | Adapta o protocolo à fazenda | `protocolos_sanitarios` | Ativo, materializado, bloqueado |
| Item operacional | Define produto, dose, alvo e calendário | `protocolos_sanitarios_itens` | Gera agenda, sem agenda, pendências |
| Agenda | Lista o que executar | `agenda_itens` | Vencidas, hoje, futuras, canceladas |
| Evento | Registra execução concluída | `eventos` + especializadas | Eventos vinculados à agenda/protocolo |
| Estoque | Controla item/lote/saldo/validade | `insumos`, lotes e movimentações | Baixo estoque, vencido, consumo vinculado |
| Pré-requisito Fase 3 | Mede prontidão para futura automação | Relatórios + eventos sanitários + inventário | Produto catalogado, insumo único, lote ativo, apresentação compatível, consumo assistido |
| Compliance | Aponta bloqueios e evidências | Configuração sanitária + catálogo | Bloqueios, documentos, alertas |

## Reason codes implementados

| Código | Mensagem operacional |
| --- | --- |
| `missing_farm_config` | Complete a configuração sanitária da fazenda. |
| `protocol_inactive` | Ative o protocolo operacional da fazenda. |
| `item_not_generating_agenda` | Marque pelo menos uma etapa como "gera agenda". |
| `animal_ineligible_species` | Revise espécie-alvo e animais elegíveis. |
| `animal_ineligible_age` | Revise janela etária das etapas. |
| `animal_ineligible_sex` | Revise sexo-alvo das etapas. |
| `risk_not_enabled` | Ajuste risco/pressão sanitária da fazenda. |
| `explicit_activation_missing` | Ative explicitamente a agenda da família sanitária. |
| `already_completed` | A pendência pode já estar concluída no histórico. |
| `outside_campaign_window` | Replaneje ou aguarde a janela de campanha. |
| `dependency_not_completed` | Conclua a etapa anterior antes da próxima dose. |

## Indicadores do recorte

- Protocolos com status operacional visível na página de protocolos.
- Agenda vazia sanitária com diagnóstico acionável.
- Lotes sanitários com validade, saldo e ressuprimento visíveis.
- Consumo por evento com indicação de lote FEFO.
