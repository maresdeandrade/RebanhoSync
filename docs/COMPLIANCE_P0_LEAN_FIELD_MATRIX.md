# Compliance P0 Lean Field Matrix

> Status: Derived analysis
> Data: 2026-04-10
> Escopo: classificacao campo a campo para P0 enxuto
> Regra: quando faltar evidencia no repositorio ou a regra variar por UF, o item foi marcado com nota `depende de validacao externa`

## A. Propriedade / Exploracao

| campo | bloco_atual | destino_sugerido | decisao | justificativa | risco_da_ausencia | observacao_de_implementacao |
| --- | --- | --- | --- | --- | --- | --- |
| produtor_nome | propriedade_exploracao | cadastro_propriedade.produtor_nome | CONDICIONAL | Ajuda na conferencia documental, mas nao e necessario para onboarding nem para a rotina diaria atual. | baixo no P0 | Mostrar so em modo documental. |
| produtor_cpf_cnpj | propriedade_exploracao | cadastro_propriedade.produtor_cpf_cnpj | CONDICIONAL | Dado util para conferir documentos externos, nao para operar a fazenda no dia a dia. | medio em fluxo documental | Validar formato sem tornar obrigatorio no onboarding. |
| inscricao_estadual | propriedade_exploracao | fora_escopo.perfil_fiscal_estadual | ADIAR | Campo fiscal estadual; o repositorio nao mostra emissao de NF no curto prazo. | baixo no P0 | Nao nacionalizar; depende de validacao externa por UF. |
| nome_fazenda | propriedade_exploracao | cadastro_propriedade.nome_fazenda | CRIAR AGORA | E o identificador base da operacao em onboarding, cabecalho e selecao de fazenda. | alto | Campo obrigatorio. |
| codigo_estabelecimento_oficial | propriedade_exploracao | cadastro_propriedade.codigo_estabelecimento_oficial | CONDICIONAL | Pode ser relevante para conferencia oficial, mas nao e necessario para operar o MVP atual. | medio em fluxo documental | Exibir so para fazendas que ativarem conferencia de GTA/documentos. |
| municipio | propriedade_exploracao | cadastro_propriedade.municipio | CRIAR AGORA | Apoia localizacao basica e reduz ambiguidade entre fazendas. | medio | Pode ser opcional no primeiro passo, mas recomendada. |
| uf | propriedade_exploracao | cadastro_propriedade.uf | CRIAR AGORA | O repositorio usa UF para pack oficial, overlay estadual e regras regulatorias. | alto | Fortemente recomendada no onboarding. |
| status_cadastral | propriedade_exploracao | derivado_sistema.status_oficial | REMOVER | E estado oficial mutavel e envelhece rapido se preenchido manualmente. | baixo no P0 | Se existir no futuro, vir por integracao ou leitura de documento. |
| situacao_sanitaria_da_exploracao | propriedade_exploracao | derivado_sistema.situacao_sanitaria_oficial | REMOVER | Tambem e status oficial mutavel, nao identidade fixa da fazenda. | baixo no P0 | Nao pedir manualmente. |
| responsavel_tecnico_nome | propriedade_exploracao | cadastro_propriedade.responsavel_tecnico_nome | CONDICIONAL | Faz sentido apenas para programas ou documentos que exigem RT formal. | baixo no P0 | Mostrar por fluxo regulatorio, nao por default. |
| responsavel_tecnico_crmv | propriedade_exploracao | cadastro_propriedade.responsavel_tecnico_crmv | CONDICIONAL | So e util quando houver RT formal vinculado a programa ou documento. | baixo no P0 | Validar apenas se o nome do RT for informado. |
| rebanho_atualizado_em | propriedade_exploracao | derivado_sistema.data_atualizacao_cadastral | REMOVER | E um carimbo sistemico/relatorio, nao um campo de entrada manual. | baixo | Derivar de sync, inventario ou documento anexado. |

## B. Animal

| campo | bloco_atual | destino_sugerido | decisao | justificativa | risco_da_ausencia | observacao_de_implementacao |
| --- | --- | --- | --- | --- | --- | --- |
| animal_id_interno | animal | derivado_sistema.id_tecnico | REMOVER | O sistema ja possui `id` tecnico; pedir outro ID interno inflaciona o cadastro sem ganho claro. | baixo | Se precisar de alias futuramente, tratar como opcional e separado. |
| identificacao_visual | animal | cadastro_animal.identificacao | CRIAR AGORA | E o principal identificador operacional do animal no repositorio atual. | alto | Campo obrigatorio. |
| especie | animal | cadastro_animal.especie | CRIAR AGORA | Se o produto quiser bovinos e bubalinos no mesmo P0, esse e o unico discriminador estrutural indispensavel. | alto se o scope incluir bubalinos | Se o curto prazo for bovino-only, pode nascer oculto com default controlado. |
| sexo | animal | cadastro_animal.sexo | CRIAR AGORA | Necessario para taxonomia, reproducao, sanitario e listagem diaria. | alto | Campo obrigatorio. |
| raca | animal | fora_escopo.perfil_zootecnico | ADIAR | E util, mas nao atende aos criterios de bloqueio operacional minimo do P0. | baixo | Trazer depois como enriquecimento, nao como base obrigatoria. |
| data_nascimento | animal | cadastro_animal.data_nascimento | CRIAR AGORA | Sustenta idade, taxonomia e regras sanitarias por faixa etaria. | medio | Preferir data exata quando conhecida. |
| idade_estimada | animal | cadastro_animal.idade_estimada | CONDICIONAL | E uma boa alternativa quando a data exata nao existe, mas nao deve coexistir sempre com ela. | medio se faltar data de nascimento | Regra de UI: `data_nascimento` ou `idade_estimada`, nunca os dois obrigatorios. |
| categoria_faixa_etaria | animal | derivado_sistema.faixa_etaria | REMOVER | E derivavel de idade, sexo e fatos; o proprio repositorio privilegia classificacao derivada. | baixo | Calcular em projection, nao persistir. |
| origem | animal | cadastro_animal.origem | CRIAR AGORA | O repositorio ja usa o campo para compra, sociedade e rastreabilidade de entrada. | medio | Pode ser opcional, mas e util no fluxo de entrada. |
| data_entrada | animal | cadastro_animal.data_entrada | CRIAR AGORA | Importante para animais externos e para coerencia de compra/entrada. | medio | Exigir apenas quando `origem != nascimento`. |
| lote_atual | animal | cadastro_animal.lote_atual | CRIAR AGORA | Necessario para operacao diaria e para os fluxos atuais de movimentacao. | alto | Pode ser nulo no cadastro inicial. |
| status | animal | cadastro_animal.status | CRIAR AGORA | Sem status, o sistema nao separa ativo, vendido e morto. | alto | Default `ativo`. |
| mae_id | animal | cadastro_animal.mae_id | CONDICIONAL | Relevante para reproducao e pos-parto, nao para todo cadastro-base. | baixo no cadastro inicial; medio no fluxo reprodutivo | Exibir so em importacao, reproducao e cria inicial. |
| pai_id | animal | cadastro_animal.pai_id | CONDICIONAL | Mesmo racional de genealogia; util, mas nao necessario em toda entrada. | baixo no cadastro inicial; medio no fluxo reprodutivo | Tratar como campo de fluxo. |
| aptidao | animal | fora_escopo.classificacao_produtiva | REMOVER | Campo ambiguo e duplicado com tipo de producao da fazenda e destino produtivo especifico. | baixo | Se voltar, modelar de forma explicita e nao generica. |
| peso_atual | animal | derivado_sistema.peso_atual | REMOVER | Peso deve entrar como evento de pesagem, nao como atributo manual do cadastro-base. | baixo no cadastro; alto se nao houver fluxo de pesagem | Ler de projection do historico. |
| data_ultimo_peso | animal | derivado_sistema.data_ultimo_peso | REMOVER | Tambem e projection de eventos, nao dado-base. | baixo | Derivar da ultima pesagem. |
| sisbov_numero | animal | fora_escopo.rastreabilidade_especial | ADIAR | SISBOV e rastreabilidade especial e nao faz parte do P0 operacional observado no repositorio. | baixo no P0; alto apenas em exportacao | Trazer so em trilha especifica de rastreabilidade/exportacao. |

## C. Transito / Operacao

| campo | bloco_atual | destino_sugerido | decisao | justificativa | risco_da_ausencia | observacao_de_implementacao |
| --- | --- | --- | --- | --- | --- | --- |
| origem_cpf_cnpj | transito_operacao | cadastro_propriedade.produtor_cpf_cnpj | REMOVER | Duplica dado da fazenda ativa e nao deve ser repetido por operacao. | baixo | Derivar do cadastro da propriedade quando necessario. |
| origem_nome_produtor | transito_operacao | cadastro_propriedade.produtor_nome | REMOVER | Duplica o titular/origem da fazenda ativa. | baixo | Nao expor no formulario de transito. |
| origem_nome_estabelecimento | transito_operacao | cadastro_propriedade.nome_fazenda | REMOVER | E derivavel do tenant ativo. | baixo | Usar snapshot automatico se um documento precisar congelar esse nome. |
| origem_codigo_estabelecimento | transito_operacao | cadastro_propriedade.codigo_estabelecimento_oficial | REMOVER | Tambem e dado de origem da fazenda, nao da operacao. | baixo | Ler do cadastro da fazenda quando aplicavel. |
| origem_municipio | transito_operacao | cadastro_propriedade.municipio | REMOVER | E derivavel do cadastro da fazenda ativa. | baixo | Nao pedir por operacao. |
| origem_uf | transito_operacao | cadastro_propriedade.uf | REMOVER | Ja existe no contexto da fazenda. | baixo | Nao duplicar. |
| destino_cpf_cnpj | transito_operacao | operacao_transito.destino_documento | CONDICIONAL | Pode ser util em conferencia documental, mas nao e necessario no fluxo minimo de transito. | baixo no P0 | Preferir contraparte cadastrada em vez de texto livre. |
| destino_nome_destinatario | transito_operacao | operacao_transito.destino_nome | REMOVER | Duplica `destino_nome_estabelecimento`; basta um nome de destino no P0. | baixo | Normalizar para um unico `destino_nome`. |
| destino_nome_estabelecimento | transito_operacao | operacao_transito.destino_nome | CRIAR AGORA | O transito externo precisa identificar para onde os animais foram. | medio | Manter um unico campo de nome de destino. |
| destino_codigo_estabelecimento | transito_operacao | operacao_transito.destino_codigo_estabelecimento | CONDICIONAL | So agrega valor quando houver conferencia de GTA ou regra oficial especifica. | baixo no P0 | Exibir apenas em modo documental. |
| destino_municipio | transito_operacao | operacao_transito.destino_municipio | CONDICIONAL | Ajuda na conferencia documental, mas nao precisa travar o fluxo minimo. | baixo | Prefill por contraparte quando existir. |
| destino_uf | transito_operacao | operacao_transito.destino_uf | CRIAR AGORA | O proprio repositorio ja usa UF de destino em transito interestadual. | medio | Pode ser obrigatoria apenas quando houver transito externo/interestadual. |
| especie | transito_operacao | cadastro_animal.especie | REMOVER | E derivavel dos animais selecionados e nao deve ser re-digitada. | baixo | Ler do conjunto de animais. |
| quantidade_total | transito_operacao | derivado_sistema.quantidade_animais | REMOVER | E derivavel de `lista_animais` ou do lote. | baixo | Nao pedir manualmente. |
| sexo | transito_operacao | derivado_sistema.sexo_animais | REMOVER | Tambem e derivavel do conjunto selecionado. | baixo | Usar apenas como resumo calculado. |
| faixa_etaria | transito_operacao | derivado_sistema.faixa_animais | REMOVER | E resumo derivado, nao entrada primaria. | baixo | Calcular a partir do cadastro dos animais. |
| lista_animais | transito_operacao | operacao_transito.lista_animais | CRIAR AGORA | E o vinculo operacional minimo do transito com os animais. | alto | Implementar como relacao por IDs, nao lista textual. |
| finalidade | transito_operacao | operacao_transito.finalidade | CRIAR AGORA | O repositorio atual ja usa `purpose` para validar transito e reproducao interestadual. | alto | Campo obrigatorio no transito externo. |
| meio_transporte | transito_operacao | operacao_transito.meio_transporte | CONDICIONAL | E logistica de documento, nao requisito para toda operacao minima. | baixo | Mostrar so em modo documental/logistico. |
| transportador_nome | transito_operacao | operacao_transito.transportador_nome | CONDICIONAL | Mesmo racional; util so quando houver conferencia de transporte. | baixo | Preferir contraparte quando fizer sentido. |
| transportador_cpf_cnpj | transito_operacao | operacao_transito.transportador_cpf_cnpj | CONDICIONAL | Nao e necessario no P0 minimo. | baixo | Validar apenas quando visivel. |
| placa_veiculo | transito_operacao | operacao_transito.placa_veiculo | CONDICIONAL | Campo logistico/documental, nao basico de operacao. | baixo | Nao mostrar por default. |
| lacre_numero | transito_operacao | operacao_transito.lacre_numero | CONDICIONAL | Detalhe documental especifico de alguns fluxos. | baixo | So em fluxos que realmente exigirem isso. |
| data_emissao | transito_operacao | vinculo_documental.documento_data | CRIAR AGORA | Um metadado documental generico e leve substitui cabecalho completo. | medio em fluxo documental | Reutilizar o mesmo campo para GTA, atestado e NF externa. |
| hora_emissao | transito_operacao | fora_escopo.gta_header_hora | ADIAR | Detalhe de cabecalho de GTA; o P0 nao precisa desse nivel de granularidade. | baixo | Nao entrar no contrato inicial. |
| data_validade | transito_operacao | vinculo_documental.data_validade | CONDICIONAL | E util para certos documentos, mas nao para toda operacao. | baixo no P0 | Exibir apenas quando o tipo documental tiver validade. |
| emitente_nome | transito_operacao | vinculo_documental.emitente_nome | CONDICIONAL | Metadado de documento, nao da operacao em si. | baixo | Fica no bloco documental generico. |
| emitente_tipo | transito_operacao | vinculo_documental.emitente_tipo | CONDICIONAL | Mesmo racional do campo anterior. | baixo | Usar so em conferencia de documento. |
| unidade_expedidora | transito_operacao | vinculo_documental.unidade_expedidora | CONDICIONAL | Detalhe de emissao oficial, nao P0 operacional. | baixo | Depende de validacao externa. |
| comprovacao_vacinacao_brucelose | transito_operacao | vinculo_documental.comprovacao_brucelose | CONDICIONAL | Nao e regra nacional generica; faz sentido apenas em contexto documental e possivelmente por UF. | baixo no P0; medio em fluxos oficiais | Tratar por overlay estadual/federal, nunca por default nacional. |
| data_ultima_vacinacao_aftosa | transito_operacao | fora_escopo.overlay_estadual_aftosa | REMOVER | A exigencia e estadual e o proprio repositorio deixou de expor aftosa como calendario base. | baixo no P0 | Nao modelar como obrigacao nacional. |
| atestado_brucelose_numero | transito_operacao | vinculo_documental.documento_numero | CONDICIONAL | Se houver atestado anexado, o numero pode ser vinculado genericamente. | baixo no P0 | Evitar campo dedicado fora do bloco documental. |
| atestado_tuberculose_numero | transito_operacao | vinculo_documental.documento_numero | CONDICIONAL | Mesmo racional do atestado de brucelose. | baixo no P0 | Tratar por tipo documental. |
| data_coleta_exame | transito_operacao | vinculo_documental.data_referencia_exame | CONDICIONAL | Nao e necessaria no checklist minimo atual, mas pode aparecer em conferencia de exame. | baixo no P0 | Se entrar, separar por tipo de exame. |
| data_resultado | transito_operacao | vinculo_documental.data_resultado | CONDICIONAL | Mesmo racional do campo anterior. | baixo | Nao mostrar no fluxo minimo. |
| resultado_exame | transito_operacao | vinculo_documental.resultado | CONDICIONAL | So faz sentido quando houver conferencia de exame especifico. | baixo | Evitar genericidade solta no formulario-base. |
| laboratorio | transito_operacao | vinculo_documental.laboratorio | CONDICIONAL | Dado de laudo/documento, nao da operacao-base. | baixo | Mostrar apenas com documento de exame. |
| medico_veterinario_habilitado | transito_operacao | vinculo_documental.veterinario_habilitado | CONDICIONAL | Campo de laudo/atestado, nao da operacao minima. | baixo | Trazer so em conferencia documental. |
| observacoes | transito_operacao | operacao_transito.observacoes | CRIAR AGORA | Campo leve e util para contexto operacional do transito. | baixo | Opcional. |

## D. Sanitario

| campo | bloco_atual | destino_sugerido | decisao | justificativa | risco_da_ausencia | observacao_de_implementacao |
| --- | --- | --- | --- | --- | --- | --- |
| fazenda_id | sanitario | derivado_sistema.fazenda_id | REMOVER | E chave tecnica do tenant, nao campo de UI. | baixo | Preencher automaticamente. |
| periodo_referencia | sanitario | fora_escopo.apuracao_periodica | ADIAR | Serve mais para consolidacao/relatorio do que para o evento sanitario minimo. | baixo no P0 | Se entrar, tratar em relatorio ou comprovacao periodica. |
| animal_id | sanitario | registro_sanitario_minimo.animal_id | CRIAR AGORA | O evento sanitario precisa apontar o alvo individual quando nao for por lote. | alto | Regra de UI: `animal_id` ou `lote_id`. |
| lote_id | sanitario | registro_sanitario_minimo.lote_id | CRIAR AGORA | Necessario para manejos sanitarios por lote. | alto | Mutuamente alternativo a `animal_id`. |
| programa_sanitario | sanitario | registro_sanitario_minimo.programa_sanitario | CONDICIONAL | E um vinculo bom com protocolo/pack, mas nao e necessario em todo registro manual. | baixo | Preencher automaticamente quando vier da agenda/protocolo. |
| tipo_registro | sanitario | registro_sanitario_minimo.tipo_registro | CRIAR AGORA | Sem esse campo nao ha como distinguir vacina, medicamento ou exame. | alto | Campo obrigatorio. |
| produto_nome | sanitario | registro_sanitario_minimo.produto_nome | CRIAR AGORA | O repositorio ja trata produto como centro do registro sanitario. | alto | Preferir referencia ao catalogo, com fallback para texto livre. |
| fabricante | sanitario | fora_escopo.produto_enriquecido | ADIAR | Enriquecimento util, mas nao minimo para P0. | baixo | Nao travar o registro. |
| lote_produto | sanitario | registro_sanitario_minimo.lote_produto | CRIAR AGORA | Ajuda na rastreabilidade minima de uso de produto veterinario. | medio | Revelar apos selecao do produto. |
| validade_produto | sanitario | fora_escopo.produto_enriquecido_validade | ADIAR | Bom para controle fino, mas nao necessario no P0 minimo. | baixo | Pode voltar depois em trilha de estoque/rastreabilidade. |
| dose | sanitario | registro_sanitario_minimo.dose | CRIAR AGORA | Sem dose, a prova minima de aplicacao fica incompleta. | medio | Campo leve, pode ser numerico simples. |
| via_aplicacao | sanitario | registro_sanitario_minimo.via_aplicacao | CRIAR AGORA | O proprio catalogo regulatorio do repositorio sinaliza `via` como parte da rastreabilidade minima. | medio | Preferir select curto. |
| data_aplicacao | sanitario | registro_sanitario_minimo.data_aplicacao | CRIAR AGORA | Campo basico do evento sanitario. | alto | Obrigatorio. |
| aplicador_nome | sanitario | registro_sanitario_minimo.aplicador_nome | CRIAR AGORA | O responsavel pela aplicacao e parte importante da prova minima. | medio | Prefill com usuario logado e permitir ajuste. |
| aplicador_crmv | sanitario | registro_sanitario_minimo.aplicador_crmv | CONDICIONAL | So faz sentido quando o procedimento exigir RT/habilitacao. | baixo no P0 | Exibir quando protocolo/overlay marcar `requiresVet`. |
| comprovante_numero | sanitario | vinculo_documental.documento_numero | CONDICIONAL | Documento de prova nao deve inflar todo registro sanitario. | baixo no P0 | Levar para o bloco documental generico. |
| carencia_abate_leite | sanitario | registro_sanitario_minimo.carencia_abate_leite | CRIAR AGORA | O repositorio ja trata carencia como requisito regulatorio relevante para uso de produto. | medio | Exigir apenas quando o produto tiver carencia aplicavel. |
| proxima_dose | sanitario | derivado_sistema.agenda_proxima_dose | REMOVER | No modelo Two Rails, proxima acao pertence a agenda, nao ao evento. | baixo | Derivar da agenda/protocolo. |
| proximo_reforco | sanitario | derivado_sistema.agenda_reforco | REMOVER | Mesmo racional de `proxima_dose`. | baixo | Nao persistir no evento append-only. |
| tipo_exame | sanitario | registro_sanitario_minimo.tipo_exame | CONDICIONAL | Exames sao subfluxo especifico, nao parte de todo registro sanitario. | baixo | Mostrar so quando `tipo_registro = exame`. |
| doenca_alvo | sanitario | registro_sanitario_minimo.doenca_alvo | CONDICIONAL | Relevante para exames e algumas vacinas oficiais, nao para todos os eventos. | baixo | Pode ser prefill de protocolo. |
| data_coleta | sanitario | registro_sanitario_minimo.data_coleta | CONDICIONAL | Dado de exame, nao do registro sanitario generico. | baixo | Exibir so em exame. |
| data_inoculacao | sanitario | registro_sanitario_minimo.data_inoculacao | CONDICIONAL | Campo de teste especifico, nao universal. | baixo | Exame only. |
| data_leitura | sanitario | registro_sanitario_minimo.data_leitura | CONDICIONAL | Mesmo racional de exame especifico. | baixo | Exame only. |
| resultado | sanitario | registro_sanitario_minimo.resultado | CONDICIONAL | Necessario apenas em exame/atestado. | baixo | Exame only. |
| validade_ate | sanitario | registro_sanitario_minimo.validade_ate | CONDICIONAL | Relevante em exames e certificados, nao em todo uso de produto. | baixo | Exame/documento only. |
| laboratorio | sanitario | registro_sanitario_minimo.laboratorio | CONDICIONAL | Dado de laudo, nao de aplicacao comum. | baixo | Exame only. |
| veterinario_habilitado | sanitario | registro_sanitario_minimo.veterinario_habilitado | CONDICIONAL | Campo de laudo/RT, nao universal. | baixo | Exame/documento only. |
| anexo_pdf | sanitario | vinculo_documental.anexo_referencia | CONDICIONAL | Um anexo pode substituir muitos campos estruturados, mas o repositorio ainda nao tem bucket documental proprio. | baixo no P0 | Depende de validacao externa e infraestrutura de storage. |

## E. Fiscal

| campo | bloco_atual | destino_sugerido | decisao | justificativa | risco_da_ausencia | observacao_de_implementacao |
| --- | --- | --- | --- | --- | --- | --- |
| emitente_nome | fiscal | vinculo_documental.emitente_nome | CONDICIONAL | Pode ser mantido como metadado leve de documento externo, sem abrir uma NF completa. | baixo no P0 | So em vinculo documental. |
| emitente_cpf_cnpj | fiscal | vinculo_documental.emitente_documento | CONDICIONAL | Mesmo racional do emitente nome. | baixo no P0 | Preferir snapshot documental, nao cadastro-base. |
| emitente_ie | fiscal | fora_escopo.cabecalho_fiscal_emitente_ie | ADIAR | IE e dado fiscal estadual fora do escopo MVP. | baixo | Depende de validacao externa por UF. |
| emitente_endereco | fiscal | fora_escopo.cabecalho_fiscal_emitente_endereco | ADIAR | Endereco completo e detalhe de documento fiscal, nao P0. | baixo | Nao pedir no MVP. |
| destinatario_nome | fiscal | vinculo_documental.destinatario_nome | CONDICIONAL | Pode existir como snapshot documental leve, sem modelar NF inteira. | baixo | Se houver contraparte, prefill. |
| destinatario_cpf_cnpj | fiscal | vinculo_documental.destinatario_documento | CONDICIONAL | Mesmo racional do campo anterior. | baixo | Fica no bloco documental. |
| destinatario_ie | fiscal | fora_escopo.cabecalho_fiscal_destinatario_ie | ADIAR | Dado fiscal estadual fora do curto prazo. | baixo | Depende de validacao externa. |
| destinatario_endereco | fiscal | fora_escopo.cabecalho_fiscal_destinatario_endereco | ADIAR | Excesso para o P0 atual. | baixo | Nao entrar agora. |
| data_emissao | fiscal | vinculo_documental.documento_data | CRIAR AGORA | E o unico metadado documental de data que vale a pena reaproveitar genericamente. | medio em fluxo documental | Mesmo campo para GTA, atestado e NF externa. |
| natureza_operacao | fiscal | fora_escopo.cabecalho_fiscal_natureza_operacao | ADIAR | NF complexa esta fora do MVP por manifesto do produto. | baixo | Nao modelar no P0. |
| cfop | fiscal | fora_escopo.cabecalho_fiscal_cfop | ADIAR | Campo fiscal tecnico e estadual/federalmente sensivel. | baixo | So com trilha fiscal dedicada. |
| finalidade_nf | fiscal | fora_escopo.cabecalho_fiscal_finalidade | ADIAR | Mesmo racional de fluxo fiscal futuro. | baixo | Nao expor agora. |
| item_descricao | fiscal | fora_escopo.item_fiscal_descricao | ADIAR | So faz sentido quando houver emissao ou conferencia detalhada de NF. | baixo | Nao entrar no P0. |
| ncm | fiscal | fora_escopo.item_fiscal_ncm | ADIAR | Campo tecnico de classificacao fiscal fora do MVP. | baixo | Depende de trilha fiscal propria. |
| unidade_comercial | fiscal | fora_escopo.item_fiscal_unidade | ADIAR | Detalhe de item fiscal. | baixo | Nao entrar no P0. |
| quantidade_cabecas | fiscal | derivado_sistema.quantidade_animais | REMOVER | E derivavel da selecao de animais e da operacao financeira. | baixo | Calcular, nao pedir. |
| peso_vivo_total | fiscal | derivado_sistema.peso_total | REMOVER | Tambem e projection/derivado. | baixo | Se necessario, derivar de pesagens. |
| valor_unitario | fiscal | fora_escopo.evento_financeiro.valor_unitario | REMOVER | O modulo financeiro ja trata valor; nao precisa nascer como cabecalho fiscal no P0. | baixo | Fica no fluxo financeiro, nao no documental. |
| valor_total | fiscal | fora_escopo.evento_financeiro.valor_total | REMOVER | Mesmo racional de `valor_unitario`. | baixo | Derivar do evento financeiro. |
| frete | fiscal | fora_escopo.custos_acessorios_fiscais | ADIAR | Custo acessorio de NF, fora do MVP fiscal. | baixo | Nao pedir agora. |
| seguro | fiscal | fora_escopo.custos_acessorios_fiscais | ADIAR | Mesmo racional do frete. | baixo | Nao pedir agora. |
| outras_despesas | fiscal | fora_escopo.custos_acessorios_fiscais | ADIAR | Excesso para P0. | baixo | Nao pedir agora. |
| tributos | fiscal | fora_escopo.custos_acessorios_fiscais | ADIAR | Campo tecnico fiscal fora do escopo atual. | baixo | Nao pedir agora. |
| transportador_nome | fiscal | operacao_transito.transportador_nome | REMOVER | Duplica eventual dado logistico de transito. | baixo | Se vier, vem do bloco de transito. |
| transportador_cpf_cnpj | fiscal | operacao_transito.transportador_cpf_cnpj | REMOVER | Mesmo racional do campo anterior. | baixo | Nao duplicar no fiscal. |
| placa_veiculo | fiscal | operacao_transito.placa_veiculo | REMOVER | Tambem e dado de logistica/transito, nao de perfil fiscal. | baixo | Se necessario, reaproveitar do transito. |
| uf_veiculo | fiscal | fora_escopo.logistica_veiculo_uf | ADIAR | Detalhe logistico/documental fora do P0 minimo. | baixo | Nao incluir agora. |
| gta_numero | fiscal | vinculo_documental.documento_numero | REMOVER | GTA nao e campo fiscal; deve morar no vinculo documental/transito. | baixo | Evitar a modelagem errada de GTA dentro de NF. |
| gta_data | fiscal | vinculo_documental.documento_data | REMOVER | Mesmo racional de `gta_numero`. | baixo | Reaproveitar o campo documental generico. |
| informacoes_complementares | fiscal | vinculo_documental.observacoes_documentais | CONDICIONAL | Um campo de observacao documental leve pode existir sem abrir NF inteira. | baixo | Fica no bloco documental generico. |
