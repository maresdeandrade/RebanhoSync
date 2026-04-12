                            # Compliance P0 Lean Audit

> Status: Derived analysis
> Data: 2026-04-10
> Escopo: auditoria de repositorio, documentacao e fluxos atuais
> Restricao: sem alteracao de codigo de producao, sem migration, sem implementacao
> Regra de leitura: quando faltar evidencia no repositorio ou a exigencia variar por UF, o item foi marcado como `depende de validacao externa`

## Resumo executivo

- O repositorio atual trata GTA/e-GTA como checklist operacional no fluxo de transito, nao como emissao completa de documento.
- O manifesto do produto deixa claro que NF-e/NFE e gestao fiscal complexa estao fora do escopo do MVP.
- O maior excesso do modelo proposto esta nos blocos `transito` e `fiscal`, que tentam modelar documentos completos antes de existir produto, storage e fluxo para isso.
- O cadastro de propriedade deve continuar curto: `nome_fazenda`, `municipio` e `uf` sao o nucleo P0 observado no repositorio.
- O cadastro de animal tambem deve ser curto; peso, categoria etaria e aptidao nao pertencem ao cadastro-base no P0.
- Para sustentar bovinos e bubalinos de forma minimamente defensavel, `especie` e o unico campo estrutural que eu colocaria no P0 do animal.
- O repositorio atual ja usa `origem`, `data_entrada`, `lote`, `status` e `genealogia`, mas genealogia deve aparecer por fluxo, nao no formulario-base de adesao.
- No sanitario, o P0 minimo deve priorizar prova operacional de uso de produto e nao um formulario de laboratorio completo.
- Quase todos os campos especificos de GTA, atestado e NF devem virar `vinculo_documental` generico, ou ficar condicionais por fluxo, em vez de inflar cadastro-base.
- Status oficiais mutaveis da exploracao, datas de atualizacao cadastral e campos derivados devem sair do modelo manual.
- O modulo `contrapartes` ja cobre boa parte de nome, documento e contato de terceiros; duplicar origem/destino por operacao aumenta ruido.
- Nao ha infraestrutura de storage documental alem do bucket de avatars; anexo em P0 depende de validacao externa e de um bucket proprio.

## Arquivos do repositorio analisados

- Docs normativos: `docs/CURRENT_STATE.md`, `docs/ARCHITECTURE.md`, `docs/OFFLINE.md`, `docs/CONTRACTS.md`, `docs/DB.md`, `docs/RLS.md`, `docs/E2E_MVP.md`, `docs/ROUTES.md`, `docs/EVENTOS_AGENDA_SPEC.md`, `docs/00_MANIFESTO.md`
- Docs derivados e historicos relevantes: `docs/IMPLEMENTATION_STATUS.md`, `docs/TECH_DEBT.md`, `docs/ROADMAP.md`, `docs/archive/analysis/ANALISE_CAMPOS_FAZENDA.md`, `docs/archive/analysis/ANALISE_CAMPOS_REBANHO.md`, `docs/archive/analysis/ANALISE_EVENTOS_SANITARIOS.md`, `docs/review/AUDIT_CAPABILITY_MATRIX.md`
- Schema e migrations: `supabase/migrations/0001_init.sql`, `supabase/migrations/0016_add_farm_location_area_production.sql`, `supabase/migrations/0021_add_animais_origem_raca.sql`, `supabase/migrations/20260409183000_official_sanitary_catalog_foundation.sql`
- Tipos e contratos: `src/lib/offline/types.ts`, `src/lib/events/types.ts`, `src/lib/events/buildEventGesture.ts`, `src/lib/events/validators/sanitario.ts`, `src/lib/events/validators/movimentacao.ts`
- Fluxos sanitarios e regulatorios: `src/lib/sanitario/transit.ts`, `src/lib/sanitario/products.ts`, `src/lib/sanitario/compliance.ts`, `src/components/sanitario/OfficialSanitaryPackManager.tsx`, `src/components/sanitario/FarmProtocolManager.tsx`
- Formularios e telas: `src/pages/CriarFazenda.tsx`, `src/pages/EditarFazenda.tsx`, `src/pages/AnimalNovo.tsx`, `src/pages/AnimalEditar.tsx`, `src/pages/AnimaisImportar.tsx`, `src/pages/Registrar.tsx`, `src/pages/Contrapartes.tsx`, `src/pages/ProtocolosSanitarios.tsx`
- Fluxos financeiros auxiliares: `src/lib/finance/transactions.ts`

Complemento consultivo de regra nacional ja referenciada pelo proprio repositorio:

- MAPA, importancia da vacinacao contra brucelose: [gov.br/agricultura/.../mapa-reforca-a-importancia-da-vacinacao-contra-brucelose](https://www.gov.br/agricultura/pt-br/assuntos/noticias/mapa-reforca-a-importancia-da-vacinacao-contra-brucelose)
- MAPA, PNCEBT - brucelose e tuberculose: [gov.br/agricultura/.../brucelose-e-tuberculose-pncetb](https://www.gov.br/agricultura/pt-br/assuntos/saude-animal-e-sanidade-vegetal/saude-animal/programas-de-saude-animal/brucelose-e-tuberculose-pncetb)

## Critica do modelo atual

- O bloco `propriedade/exploracao` mistura identidade fixa da fazenda com estado oficial mutavel (`status_cadastral`, `situacao_sanitaria_da_exploracao`, `rebanho_atualizado_em`). Esses campos envelhecem rapido e nao devem ser digitados manualmente no P0.
- O bloco `animal` mistura cadastro-base, campos derivados (`categoria_faixa_etaria`), campos de evento (`peso_atual`, `data_ultimo_peso`) e rastreabilidade especial (`sisbov_numero`) no mesmo nivel.
- O bloco `transito` esta modelado como se o app fosse emitir ou espelhar uma GTA completa. O repositorio atual so comprova um checklist operacional com `gta_checked`, `gta_number`, `destination_uf` e datas PNCEBT no caso interestadual reprodutivo.
- Os campos `origem_*` em `transito` duplicam o proprio tenant ativo. Em vez de pedir isso por operacao, o sistema deve derivar da fazenda ativa ou de uma contraparte vinculada.
- Os campos `destino_*` tambem estao superdimensionados. Para P0, um `destino_nome` enxuto e `destino_uf` resolvem a maior parte do problema operacional; o resto deve ser condicional por documento.
- O bloco `sanitario` mistura registro minimo de uso de produto com subfluxos de exame, comprovacao, laboratorio e anexo. Isso gera formulario pesado e baixa adesao.
- `proxima_dose` e `proximo_reforco` estao no lugar errado. No modelo Two Rails, proxima acao vive na agenda, nao no evento append-only.
- O bloco `fiscal` tenta espelhar uma NF completa, mas o produto declara explicitamente que fluxo fiscal complexo/NF-e esta fora do MVP.
- GTA e NF nao devem ser tratadas como "documento do animal". Elas sao documentos de operacao/transito/saida, ou simples vinculos documentais anexados a um evento/operacao.
- O repositorio ja tem `contrapartes` com `nome`, `documento`, `telefone`, `email` e `endereco`; repetir esses dados em varios formularios de operacao cria divergencia e retrabalho.
- O repositorio atual e bovino-first: ha taxonomia canonica bovina, mas nao ha `especie` no cadastro do animal. Se o produto quer sustentar bubalinos no curto prazo, esse e o unico gap estrutural que realmente merece entrar no P0.

## Campos para criar agora

- `cadastro_propriedade`: `nome_fazenda`, `municipio`, `uf`
- `cadastro_animal`: `identificacao`, `especie`, `sexo`, `data_nascimento`, `origem`, `data_entrada`, `lote_atual`, `status`
- `registro_sanitario_minimo`: `animal_id` ou `lote_id`, `tipo_registro`, `produto_nome` ou referencia ao catalogo, `lote_produto`, `dose`, `via_aplicacao`, `data_aplicacao`, `aplicador_nome`, `carencia_abate_leite`
- `operacao_transito`: `lista_animais` por IDs, `finalidade`, `destino_nome`, `destino_uf`, `observacoes`
- `vinculo_documental`: `documento_tipo`, `documento_numero`, `documento_data`, `anexo_referencia`

## Campos condicionais

- `cadastro_propriedade`: `produtor_nome`, `produtor_cpf_cnpj`, `codigo_estabelecimento_oficial`, `responsavel_tecnico_nome`, `responsavel_tecnico_crmv`
- `cadastro_animal`: `idade_estimada`, `mae_id`, `pai_id`
- `operacao_transito`: `destino_codigo_estabelecimento`, `destino_municipio`, `meio_transporte`, `transportador_nome`, `transportador_cpf_cnpj`, `placa_veiculo`, `lacre_numero`
- `vinculo_documental`: `data_validade`, `unidade_expedidora`, `emitente_nome`, `emitente_tipo`, `comprovante_numero`, `resultado`, `laboratorio`, `veterinario_habilitado`, `anexo_pdf`
- `registro_sanitario_minimo`: `programa_sanitario`, `aplicador_crmv`, `tipo_exame`, `doenca_alvo`, `data_coleta`, `data_inoculacao`, `data_leitura`, `validade_ate`

## Campos a adiar

- `inscricao_estadual`
- `raca`
- `sisbov_numero`
- `fabricante`
- `validade_produto`
- Cabecalho completo de GTA
- Cabecalho completo de NF
- Campos fiscais estruturados de CFOP, NCM, tributos e despesas acessorias

## Campos a remover

- `status_cadastral`
- `situacao_sanitaria_da_exploracao`
- `rebanho_atualizado_em`
- `animal_id_interno`
- `categoria_faixa_etaria`
- `aptidao`
- `peso_atual`
- `data_ultimo_peso`
- Todos os `origem_*` do bloco de transito
- `especie`, `quantidade_total`, `sexo` e `faixa_etaria` do bloco de transito como campos digitaveis
- `proxima_dose`
- `proximo_reforco`
- Todos os campos de NF completa no P0

## Modelo P0 enxuto revisado

### cadastro_propriedade

Campos criar agora:

- `nome_fazenda`
- `municipio`
- `uf`

Campos condicionais:

- `produtor_nome`
- `produtor_cpf_cnpj`
- `codigo_estabelecimento_oficial`
- `responsavel_tecnico_nome`
- `responsavel_tecnico_crmv`

Campos adiados:

- `inscricao_estadual`

Observacoes de obrigatoriedade na UI:

- `nome_fazenda` e obrigatorio.
- `uf` deve ser tratada como fortemente recomendada, porque o repositorio atual usa UF para overlay regulatorio e selecao do pack oficial.
- `municipio` pode ser opcional no onboarding, mas recomendada para triagem de fazendas e eventual conferencia documental.
- Todos os demais campos devem ficar atras de um modo `conferencia documental`, nunca no primeiro passo de adesao.

### cadastro_animal

Campos criar agora:

- `identificacao`
- `especie`
- `sexo`
- `data_nascimento`
- `origem`
- `data_entrada`
- `lote_atual`
- `status`

Campos condicionais:

- `idade_estimada`
- `mae_id`
- `pai_id`

Campos adiados:

- `raca`
- `sisbov_numero`

Observacoes de obrigatoriedade na UI:

- `identificacao` e `sexo` devem ser obrigatorios.
- `especie` deve entrar no P0 se o compromisso de produto incluir bubalinos no mesmo ciclo operacional; se o curto prazo continuar bovino-only, o campo pode nascer oculto com default controlado ate a camada multi-especie existir.
- `data_nascimento` deve ser preferida; se faltar, a UI libera `idade_estimada` em vez de pedir os dois.
- `data_entrada` so aparece quando `origem != nascimento`.
- `mae_id` e `pai_id` so aparecem em importacao, fluxo reprodutivo e pos-parto.
- `peso_atual` nao deve existir no cadastro-base; o peso entra por evento de pesagem.

### registro_sanitario_minimo

Campos criar agora:

- `animal_id` ou `lote_id`
- `tipo_registro`
- `produto_nome` ou referencia ao catalogo
- `lote_produto`
- `dose`
- `via_aplicacao`
- `data_aplicacao`
- `aplicador_nome`
- `carencia_abate_leite`

Campos condicionais:

- `programa_sanitario`
- `aplicador_crmv`
- `tipo_exame`
- `doenca_alvo`
- `data_coleta`
- `data_inoculacao`
- `data_leitura`
- `resultado`
- `validade_ate`
- `laboratorio`
- `veterinario_habilitado`
- `comprovante_numero`
- `anexo_pdf`

Campos adiados:

- `fabricante`
- `validade_produto`

Observacoes de obrigatoriedade na UI:

- Primeiro passo: alvo, tipo, produto e data.
- Segundo passo progressivo: `lote_produto`, `dose`, `via_aplicacao`, `aplicador_nome` e `carencia_abate_leite`.
- `aplicador_nome` pode vir preenchido com o usuario logado e ficar editavel.
- `aplicador_crmv` so aparece quando o protocolo/overlay marcar `requiresVet`.
- Campos de exame so aparecem quando `tipo_registro = exame`.
- `comprovante_numero` e `anexo_pdf` devem viver como vinculo documental e nao como peso obrigatorio de toda aplicacao.

### operacao_transito

Campos criar agora:

- `lista_animais` por IDs
- `finalidade`
- `destino_nome`
- `destino_uf`
- `observacoes`

Campos condicionais:

- `destino_codigo_estabelecimento`
- `destino_municipio`
- `meio_transporte`
- `transportador_nome`
- `transportador_cpf_cnpj`
- `placa_veiculo`
- `lacre_numero`

Campos adiados:

- Nenhum campo adicional obrigatorio alem do checklist documental minimo

Observacoes de obrigatoriedade na UI:

- O bloco so aparece quando o manejo e transito externo; movimentacao interna entre lotes nao deve abrir campos de GTA.
- `lista_animais` nao e texto livre; deve vir da selecao de animais.
- `destino_uf` pode ser obrigatoria apenas quando houver transito externo ou interestadual.
- Campos `origem_*` nao devem ser exibidos; o sistema deve derivar da fazenda ativa.
- Pre-check PNCEBT para reproducao interestadual continua condicional e deve ficar junto do vinculo documental, nao no cadastro-base da operacao.

### vinculo_documental

Campos criar agora:

- `documento_tipo`
- `documento_numero`
- `documento_data`
- `anexo_referencia`

Campos condicionais:

- `data_validade`
- `emitente_nome`
- `emitente_tipo`
- `unidade_expedidora`
- `resultado`
- `laboratorio`
- `veterinario_habilitado`
- `observacoes_documentais`

Campos adiados:

- Cabecalho integral de GTA
- Cabecalho integral de NF
- Metadados fiscais completos por item

Observacoes de obrigatoriedade na UI:

- Este bloco deve ser generico e reutilizavel para GTA, atestado, comprovante sanitario e NF externa.
- O P0 pode operar apenas com `tipo + numero + data`, sem anexar arquivo obrigatoriamente.
- `anexo_referencia` so deve entrar como UX real quando existir bucket de documentos; hoje o repositorio so mostra bucket para avatars.
- Quando um overlay oficial marcar documento obrigatorio, a UI deve exigir o vinculo documental correspondente, mas sem abrir uma GTA ou NF completas.

## Regras de UI/validacao

- Nao pedir campos oficiais ou fiscais na criacao da fazenda.
- Nao pedir genealogia, peso ou rastreabilidade especial no cadastro-base do animal.
- Se `data_nascimento` existir, nao pedir `idade_estimada`; usar uma regra de "um ou outro".
- `categoria_faixa_etaria`, `quantidade_total`, `peso_atual` e campos equivalentes devem ser derivados, nao digitados.
- Em transito externo, abrir primeiro a decisao operacional: destino + finalidade + animals. So depois liberar vinculo documental.
- Em sanitario, usar progressive disclosure: o formulario minimo nao deve parecer um laudo.
- Reaproveitar `contrapartes` para nome/documento/endereco de terceiros; evitar repetir esses campos em compra, venda e transito.
- Usar `vinculo_documental` generico para anexar ou referenciar GTA, atestado e NF externa, em vez de replicar cabecalhos completos.
- Nunca transformar regra estadual em obrigatoriedade nacional por default.

## Riscos de conformidade

- Sem `especie`, o produto continua bovino-first e nao consegue sustentar bubalinos de forma limpa no cadastro-base. Isso e risco real se o escopo comercial prometer as duas especies.
- Se o registro sanitario continuar sem `lote_produto`, `via`, `responsavel` e `carencia`, a rastreabilidade minima de uso de produto veterinario fica fragil.
- Se `status_cadastral` e `situacao_sanitaria_da_exploracao` virarem campos manuais, o sistema passa a carregar dado oficial stale e dificil de auditar.
- Se o produto tentar colocar GTA/NF completas no P0 antes de ter fluxo, storage e validacao externa, a adesao do usuario cai sem ganho regulatorio proporcional.
- O bucket documental ainda nao existe no repositorio; qualquer estrategia baseada em anexo como prova depende de implementacao futura.

## Pendencias dependentes de UF

- Comprovacao semestral de brucelose e exemplo claro de overlay estadual; o proprio repositorio ja tem referencia de GO, mas a regra deve permanecer `depende de validacao externa`.
- `data_ultima_vacinacao_aftosa` nao pode entrar como campo nacional generico; o repositorio inclusive deixou de expor aftosa como calendario vacinal base.
- Campos de IE, cabecalho de NF e exigencias fiscais acessorias sao por desenho dependentes de SEFAZ/UF e estao fora do MVP fiscal atual.
- `codigo_estabelecimento_oficial`, requisitos de emissao/conferencia e detalhes de e-GTA podem variar por UF/servico veterinario oficial; tratar como condicional e validar externamente antes de implementar.
- Bubalinos exigem validacao adicional de produto e regra alem do caso obvio de brucelose; o repositorio atual ainda nao mostra taxonomia multi-especie pronta.

## Proximos passos

1. Validar com produto se o curto prazo quer apenas `conferencia/vinculo` ou se realmente quer `emissao` de documento.
2. Confirmar se o escopo comercial de curto prazo inclui bubalinos operando no mesmo tenant; se sim, abrir desenho de `especie` no cadastro do animal e na elegibilidade sanitaria.
3. Normalizar `vinculo_documental` antes de qualquer tentativa de modelar GTA ou NF completas.
4. Se anexo documental entrar no roadmap, criar bucket proprio, politicas e UX dedicadas; nao reutilizar o bucket de avatars.
5. So depois dessa validacao partir para schema/migration/UI, sempre preservando formulario-base curto e progressive disclosure.
