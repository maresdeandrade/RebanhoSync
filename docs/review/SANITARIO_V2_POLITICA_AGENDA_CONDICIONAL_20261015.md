# Sanitário V2 — Política de consulta, sugestão e Agenda condicional

**Revisão documental:** 2026-10-15 (ajustes pré-aprovação A–E incorporados; versão documental 2)
**Natureza:** proposta técnica para decisão e implementação — **não é autorização de importação, promoção curatorial, automação, uso de produto ou deploy**.
**Baseline remoto inspecionado:** `main@b7f475e589569a2d80843335dc7d60531c442e08`.
**Entrega funcional local relatada:** `codex/sanitario-v2-entrega-funcional@e72bf5004fe2bf8d6a7052dc57ee1167f64ccb7e`, sem publicação/merge comprovados.
**Origem da revisão:** levantamento das 18 pendências sanitárias de 15/10/2026 e cinco ajustes pré-aprovação (raiva, multivalentes, B19, tipo de Agenda e evidência). [Matriz operacional de 20 itens](evidence/SANITARIO_V2_MATRIZ_DECISAO_AGENDA_20261015.csv).
**Fonte normativa principal de domínio:** [`docs/domain/SANITARIO.md`](../domain/SANITARIO.md).

## 1. Decisão proposta

Os bloqueios de autorização devem ser **específicos ao que se pretende fazer**. Falta de produto comercial vinculado não impede, por si só, consultar uma regra ou criar uma **Agenda genérica de avaliação/manejo**, sem dose, via, carência ou indicação de produto. Entretanto, uma Agenda que prescreva um produto/esquema específico só pode utilizar os parâmetros cobertos por fonte pertinente; nenhuma Agenda é autorização de aplicação.

Separar cinco capacidades, sem reduzir as restrições de execução:

| Capacidade | Resultado permitido | Condições mínimas | Não pressupõe |
|---|---|---|---|
| `consulta` | Visualizar protocolos, itens, limites e fontes | Fonte e escopo de leitura válidos | Aprovação para uso prospectivo |
| `sugestao` | Exibir candidatos e motivos, sem persistir | Pré-checagem e contexto quando conhecido | Elegibilidade confirmada ou obrigação legal |
| `agenda_manual_condicional` | Criar intenção após escolha/confirmação | Identidade da fazenda/animal, regra aplicável, janela e decisão humana | Produto escolhido, execução ou estoque |
| `agenda_automatica_condicional` | Materializar intenção por regra aprovada/configuração de fazenda **em ação determinística e idempotente** | Aprovação do item/versão + plano válido + elegibilidade e dados comprovados | Execução em background, Evento, prescrição, carência |
| `execucao_factual` | Registrar ato realizado, com auditoria | Fato, produto e dados efetivos quando cabível; contratos de evento/estoque | Autorização prospectiva implícita |

**Atenção:** essa tabela é uma proposta de política; não corresponde a flags atualmente ativadas. No payload canônico inspecionado: 10 protocolos, 20 itens, protocolos em `draft` (aftosa `retired`), `allows_agenda_auto=false` em **todos**, `agenda_allowed=false`, `approved_for_catalog=false` e `import_real_authorized=false`. O payload é candidato e não foi importado no remoto consultado. Não substituir esses campos por uma segunda fonte de verdade. <br>

### 1.1. Tipos operacionais de Agenda: regra obrigatória para implementação

A **Agenda genérica de avaliação/manejo** e a **Agenda de aplicação com esquema definido** não são intercambiáveis:

| Tipo | Exemplo de título | Quando pode ser planejada | Dados proibidos de inferir |
|---|---|---|---|
| `avaliacao_manejo_generica` (capacidade proposta, **não enum já implementado**) | “Avaliar vacinação contra clostridioses” | Contexto geral, alvo e janela de avaliação plausíveis; sem exigir produto comercial | Produto, dose, via, segunda dose, prazo de carência, promessa de aplicação |
| `aplicacao_esquema_definido` (capacidade proposta, **não enum já implementado**) | “Revisar/aplicar dose 2 de [produto identificado] conforme esquema” | Produto/formulação e variante de esquema identificados, fonte técnica aplicável, histórico factual da dose anterior e intervalo válido | Não herdar parâmetros de outra bula nem de nome de classe |

A transição de genérica para esquema definido **exige nova seleção explícita e revalidação** no domínio e na persistência. Nunca preencher automaticamente dose, via, produto, calendário de reforço ou carência apenas porque uma opção comercial apareceu no catálogo depois. A Agenda genérica permanece uma tarefa de avaliação; não deve ser reinterpretada como ordem de administração. Este documento descreve contrato proposto; confirmar o modelo e o writer existentes antes de introduzir campos persistentes.

## 2. Invariantes e semântica

1. **Protocolo** é regra/configuração; **Agenda** é tarefa futura; **Evento** é fato realizado; `state_*` é read model. Prévia, sugestão e Agenda nunca geram execução, estoque ou carência.
2. Nenhuma regra crítica decorre apenas de UI, tags, inferência, cache volátil, data prevista ou consulta externa indisponível. **Reforços exigem histórico factual compatível**; dose inicial planejada não equivale a dose aplicada.
3. Não reutilizar nome genérico de produto legado como identidade comercial; existem 18 registros em `produtos_veterinarios`, zero vínculos técnicos V2 comprovados. Não fabricar UUID, carência ou equivalência entre produtos.
4. O contexto de fazenda pode habilitar *aplicabilidade* de uma política existente, desde que registrado com origem, responsável, vigência e versão. **Não** substitui bula, norma, autorização por espécie, aprovação do item ou requisito legal.
5. Mudança de item/protocolo cria versão auditável ou segue o contrato de versionamento existente; não altera retroativamente Eventos, tarefas editadas ou regras que embasaram um planejamento anterior.
6. Geração de Agendas exige idempotência persistente com chave estável por `fazenda_id`, regra/versão, alvo(s) e janela. Repetição, concorrência, retries, offline/reconnect e farm-switch não criam intenções equivalentes nem cruzam fazendas.
7. Não depender de job contínuo de background. A automação pode rodar sob ação explícita do usuário, ao abrir o módulo ou num ponto controlado do ciclo de vida, com reprocessamento seguro; ativação em lote fica condicionada a política e testes.
8. Regras prospectivas devem ser revalidadas no domínio/persistência, não somente na UI; pull e push respeitam versão do cliente, RLS, tenant e sessão.
9. **`no_agenda_auto` é restrição explícita de precedência:** os três itens atuais de raiva a carregam. Histórico, plano de fazenda, bula e janela **não a removem**. A automação depende de decisão técnica e revisão **versionada, auditável e aprovada** da política/item, com testes; até lá, sugestão e planejamento manual permitido pelo contrato atual, nunca Agenda automática.
10. **Cobertura multiprotocolo** só vale para produto/formulação comercial identificados e composição/espécie/esquema conferidos, com fonte técnica por cobertura. A mesma aplicação pretendida **não deve criar duas tarefas de administração** só porque atende leptospirose e IBR/BVD. Preservar vínculo de todas as regras, versões, alvos e janelas na intenção; um **único Evento factual** pode documentar coberturas comprovadas, sem duplicar aplicação/estoque. Se o contrato atual não suporta esse vínculo, manter a recomendação informativa e registrar gap de implementação — não fabricar relações nem suprimir evidência histórica.
11. Para agrupar demandas multiprotocolo, verificar identidade do produto, dose/rota/esquema pertinentes, mesmo animal, compatibilidade de janelas, autorização vigente e ausência de execução já registrada. Em caso de conflito entre versões ou datas, **não mesclar silenciosamente**: apresentar as demandas separadas como pendência de compatibilização, sem instruir duas aplicações do mesmo ato. Deduplicação persistente, concorrência, idempotência e rastreabilidade por `fazenda_id` são obrigatórias.

## 3. Decisões por 18 pendências (20 itens canônicos)

Os IDs/`logical_item_key` exatos e status propostos estão na [matriz CSV associada](evidence/SANITARIO_V2_MATRIZ_DECISAO_AGENDA_20261015.csv). **“Condicional” significa critério para futura aprovação por item, nunca ativação presente.**

| # | Item/procedimento | Capacidade proposta e condição determinante | Preservar bloqueio específico |
|---|---|---|---|
| 1 | **B19 — fêmeas 3–8 meses** | **Agenda automática condicional** com espécie bovina/bubalina, sexo, idade, UF, histórico e norma estadual atual aplicáveis. Expor tarefa de comprovação oficial, sem presumir cumprimento. | Proibir B19 em SC; UF/idade/histórico desconhecidos não viram recomendação afirmativa; RB51 não se estende automaticamente a bubalinas; execução exige MV cadastrado e demais requisitos legais. |
| 2 | **Clostridioses — dose 1** | Automação conforme plano e **bula/esquema selecionado**: Poli-Star (primeira dose aos 4 meses) ou Bovilis Poli-Star T (pode iniciar aos 2 meses, com terceira dose recomendada aos 6 meses). | Não adotar idade universal da classe, nem trocar bula de produto. |
| 3 | **Clostridioses — dose 2** | Automação se dose 1 for **Evento compatível**, com intervalo ancorado na bula escolhida (4 semanas nos produtos MSD citados; referência Fortress 7 do catálogo precisa continuar produto-específica). | Não contar Agenda/dose declarada sem evidência suficiente como execução. |
| 4 | **Clostridioses — reforço anual** | Automação se esquema inicial estiver concluído e houver histórico factual, segundo produto. | Não gerar reforço após dose inicial isolada quando há série obrigatória. |
| 5 | **Raiva — dose 1** | **Somente sugestão/planejamento manual**, quando compatível com contexto regional e plano antirrábico vigente. Automação futura exige revisão e aprovação versionada de `no_agenda_auto`. | O item conserva `no_agenda_auto`; plano de fazenda ou bula não revoga a restrição. Sem obrigatoriedade nacional indiscriminada. |
| 6 | **Raiva — reforço 30 dias** | **Somente sugestão/planejamento manual no estado atual**; uma futura automação precisará de dose 1 factual, esquema pertinente e plano vigente **E** remoção aprovada/versionada de `no_agenda_auto` para este item. | Histórico é necessário, **não substitui a aprovação da política**. Não criar segunda dose sem Evento ou com bula incompatível. |
| 7 | **Raiva — reforço anual** | **Somente sugestão/planejamento manual no estado atual**; automação futura requer plano vigente, histórico factual, recorrência aplicável **e aprovação/versionamento da revisão de `no_agenda_auto` deste item**. | Histórico e avaliação regional não revogam o bloqueio vigente nem tornam a vacinação universal. |
| 8 | **Leptospirose — dose 1** | Planejamento por **esquema/produto** e contexto sanitário: Leptoferm 5/2 mL bovino tem dose inicial única; Poliguard e Fertiguard são esquemas de duas doses. | Não impor segundo componente de esquema sem identificá-lo. |
| 9 | **Leptospirose — dose 2** | **Condicional por produto**: só elegível nos esquemas de duas doses com dose 1 factual e intervalo 21–30 dias. | **Bloqueio atual deve permanecer para Leptoferm bovino**. O item canônico atual é `bloqueado`; exige revisão/versionamento do item por variante antes de qualquer promoção. Produto desconhecido não permite calcular dose 2. |
| 10 | **Leptospirose — reforço** | Anual quando produto/esquema e última execução comprovada sustentam. | Semestral exige fonte específica e contexto; não inferir por risco genérico. |
| 11 | **IBR/BVD — dose 1** | Automação por esquema escolhido: Poliguard tem duas doses; Bovilis Vista Once SQ é referência de dose inicial única para seus antígenos e condições. | Não gerar dose 2 para vacina de dose única; respeitar restrições reprodutivas. |
| 12 | **IBR/BVD — dose 2** | Automação quando esquema exige série, dose 1 é Evento e prazo é aplicável (Poliguard: 21–30 dias). | Não transferir segurança ou intervalo entre formulações. |
| 13 | **Recria — maio** | Automação apenas com plano regional/estacional vigente e categoria de recria elegível. | Maio/julho/setembro é **referência regional** para Cerrado/Brasil Central, não calendário nacional obrigatório. |
| 14 | **Recria — julho** | Automação pela mesma política; consultar histórico para evitar duplicidade/intervalos incompatíveis. | Falta de manejo em maio não significa proibição universal de manejo em julho. |
| 15 | **Recria — setembro** | Automação pela mesma política; histórico, resistência e janela local considerados. | Jamais automatizar rotação química, dose, produto ou carência a partir do calendário. |
| 16 | **Pré-desmama** | **Sugestão contextual** de avaliação; Agenda somente com manejo/intensidade ou decisão MV adequados. | Não fazer vermifugação universal dos bezerros zebuínos extensivos. |
| 17 | **Pré-confinamento/pasto vedado** | Agenda condicionada à data real **prevista de entrada** e manejo confirmado. | Sem produto, dose ou carência pré-assumidos; avaliar restrições específicas de terminação na execução. |
| 18 | **Matrizes pré-parto** | Planejamento contextual vinculado à previsão de parto e sistema produtivo; separar antiparasitário de **vacinação pré-parto**, com esquemas próprios. | Não criar janela universal de 30 dias para todos os tratamentos; restrições de gestação/lactação dependem do produto. |
| — | **Febre aftosa — 2 itens** | **Consulta/histórico apenas** para os itens canônicos `fmd_historico_contingencia` e `fmd_bloqueio_vacinacao_rotina`. | Preservar protocolo `retired`, itens informativos/bloqueados, **sem Agenda automática nem vacinação rotineira**. |

### 3.1. Cobertura por vacina polivalente: decisão de planejamento (B)

As bulas do [Fertiguard Selenium Max](https://www.msd-saude-animal.com.br/produto/fertiguard-selenium-max/) e do [Poliguard](https://www.msd-saude-animal.com.br/produto/poliguard/) incluem **IBR, BVD e leptospirose** na composição para bovinos. Uma vacina real, em um esquema compatível, pode satisfazer condições documentais de mais de uma família de protocolo. Essa possibilidade **não** comprova que algum dos 18 registros legados genéricos seja esse produto.

**Contrato proposto, ainda não implementado/certificado:**

1. Mapear coberturas por **produto/formulação real + fonte primária + espécie/condições**, nunca pelo nome textual do protocolo/classe ou por mera coincidência de datas.
2. Antes de materializar Agendas, confrontar as necessidades por animal, janelas, histórico, série vacinal, versões do protocolo e fonte do esquema. Para **uma aplicação física prevista**, criar **uma única tarefa de aplicação** vinculada às coberturas pertinentes, se o modelo persistente comportar referências auditáveis a todos os itens. Não duplicar lote de estoque, dose ou data.
3. Preservar rastreabilidade por `fazenda_id`, produto/formulação, identidade de cada item/versão e demanda original. Reprocessamentos e farm-switch não podem gerar nova tarefa equivalente.
4. Na execução, **um Evento sanitário real**, quando suportado e validado pelo contrato, registra o produto, a administração e as coberturas comprovadas; não emitir Eventos ou baixas de estoque adicionais para cada doença. Se a arquitetura atual exigir alteração, desenvolver um vínculo explícito, idempotente e forward-compatible — **não inferir** cobertura por `state_*`, tags ou campos livres.
5. Se houver janelas ou requisitos incompatíveis, produto não identificado, histórico insuficiente ou ausência de modelo para o vínculo, **não mesclar silenciosamente**. Exibir pendência de revisão, mantendo separadas as necessidades técnicas e evitando ordens duplicadas de aplicação.

**Casos de teste obrigatórios antes da ativação:** Fertiguard e Poliguard cobrem IBR/BVD + leptospirose com tarefa única quando compatível; produtos distintos geram demandas distintas; intervalo ou espécie incompatível impede agrupamento; doses já executadas não são recriadas; dois protocolos/versões com janelas distintas preservam trilha de cada requisito; clique duplo, offline/reconnect, retries e troca de fazenda não geram duplicidade.

### 3.2. B19: conciliação federal–estadual (C)

A [Portaria SDA/MAPA nº 1.633/2026](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/pncebt/legislacao-e-fichas-tecnicas/portaria_sda_mapa_na___1-633__de_12_de_junho_de_2026.pdf), art. 2º, estabelece os períodos nacionais de vacinação (janeiro–junho e julho–dezembro) e a comprovação até 10/07 ou 10/01, respectivamente. Pelo art. 3º, UFs com campanhas estaduais instituídas **antes da vigência da Portaria** podem manter seus **prazos de comprovação**, mas o parágrafo único exige observar os **períodos nacionais de vacinação**. Essa ressalva não autoriza declarar que toda norma estadual prevalece sobre a federal.

A elegibilidade deve conciliar **norma federal vigente e normas estaduais compatíveis**, com exceções sanitárias específicas da UF (inclusive situação de risco A e proibição da B19 em SC). Se houver incompatibilidade ou dado essencial ausente, apresentar o motivo e não automatizar a tarefa de vacinação. Para a **tarefa de comprovação**, distinguir vencimento nacional de prazo estadual anterior validamente preservado e do calendário de aplicação. Nenhuma dessas datas significa Evento executado.

**Prioridade proposta para implementação:** B19 → clostridioses e IBR/BVD por esquema → recria por plano regional → raiva/leptospirose por plano e variante de produto → manejos situacionais. Esta sequência não aprova nenhum procedimento sem completar a revisão por campo/versão.

## 4. Evidência por fonte e limites da confirmação

As referências abaixo foram conferidas em páginas primárias acessíveis em 15/10/2026; não equivalem à curadoria de um **produto comercial cadastrado** ou à verificação do registro individual no MAPA. A atualização de fonte no payload exige `source_ref`/`field_key`, coverage e validação específicos, não somente inserir um link num documento.

| Ref. documental | O que sustenta | Limite |
|---|---|---|
| [Portaria SDA/MAPA 1.633/2026](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/pncebt/principais-normas-pncebt/portaria-1-633-de-12-de-junho-de-2026.pdf) | Faixa 3–8 meses; exceção de risco A; comprovação 10/07 e 10/01, ressalva de prazo estadual anterior | Não determina autorização do produto comercial nem risco da fazenda isoladamente |
| [MAPA — vacinação contra brucelose](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/pncebt/arquivos/vacinacao-contra-brucelose) | B19 bovinos/bubalinos; RB51 substituição para bovinos | Conciliar norma federal e regras estaduais **compatíveis**; art. 3º da Portaria 1.633 preserva somente prazos estaduais preexistentes de comprovação nas condições previstas, não altera os períodos nacionais de vacinação |
| [CIDASC — brucelose](https://www.cidasc.sc.gov.br/defesasanitariaanimal/defesa-sanitaria-animal-2/) | Proibição B19 em SC; RB51 com regras estaduais | Não generalizar para outras UFs |
| [MSD Poli-Star](https://www.msd-saude-animal.com.br/produto/poli-star/) e [Bovilis Poli-Star T](https://www.msd-saude-animal.com.br/produto/bovilis-poli-star-t/) | Idade, doses e intervalo dos produtos exemplificados | Não transferir regras para toda a classe clostridial |
| [MSD Raivacel Multi](https://www.msd-saude-animal.com.br/produto/raivacel-multi/) | Primovacinação + 30 dias, revacinação anual para espécies previstas na bula | Não resolve zona epidemiológica nem autoriza bubalinos automaticamente |
| [Zoetis Leptoferm 5/2 mL](https://www.zoetis.com.br/global-assets/private/leptoferm-5-2ml_0.pdf) | Para bovinos: dose inicial única e revacinação anual | Esquema de suínos não deve ser aplicado a bovinos |
| [MSD Poliguard](https://www.msd-saude-animal.com.br/produto/poliguard/) e [Fertiguard Selenium Max](https://www.msd-saude-animal.com.br/produto/fertiguard-selenium-max/) | Duas doses iniciais 21–30 dias; anual para bovinos segundo bula; **cada formulação cobre IBR/BVD e leptospirose**, entre outros antígenos no caso de Fertiguard | Composição validada permite avaliar cobertura multiprotocolo sem duplicar aplicação; **não** comprova identidade de produto legado nem compatibilidade de todas as variantes |
| [MSD Bovilis Vista Once SQ](https://www.msd-saude-animal.com.br/produto/bovilis-vista-once-sq/) | Formulação e esquema próprios em bovinos | Não usar como referência universal da família IBR/BVD |
| [Embrapa — Recomendação Técnica 26](https://www.infoteca.cnptia.embrapa.br/bitstream/doc/562842/1/rectec26.pdf) | Calendário regional maio/julho/setembro e diferenças extensivo/intensivo | Não prescreve tratamento universal ou rotação automática |
| [MSD Rotavec Corona](https://www.msd-saude-animal.com.br/produto/rotavec-corona/) | Exemplo de vacinação pré-parto entre 12ª e 3ª semana | É **outro protocolo**, não parte do item antiparasitário atual |

Outras afirmações do levantamento (e.g., Fortaleza/Fortress 7, pesquisas comparativas e restrições do produto Solution) permanecem **a conferir na fonte primária específica** antes de alterar `source_refs_by_field` ou regras que dependem delas. **A existência de uma bula válida não comprova que um dos 18 cadastros genéricos corresponda àquele produto.**

## 5. Roteiro de transição documental → operacional (não executado)

1. **Registrar a decisão por item e fonte** no documento e no CSV, mantendo os `draft`, `manual_only`, `preview_allowed` e `allows_agenda_auto=false` do payload original até aprovação rastreável. Não alterar o JSON canônico nesta tarefa documental.
2. **Corrigir a revisão funcional em PR**: quatro achados novos de Fallow foram **relatados** para o commit local `e72bf50`; o relatório deve fornecer **IDs, regra, arquivo/linha e output bruto** para atribuição de cada um. Sem tais identificadores, não declarar causa ou resolução. Validação local anterior não equivale a CI remoto. Não alterar módulos não relacionados; conferir [rastreabilidade operacional e lacunas](#7-rastreabilidade-de-evidências-e-limites-e).
3. **Isolar ambiente de homologação**: o Supabase `zqloazqzhwauamcejmuz` é utilizado pelo frontend Vercel de produção, apesar da constante `STAGING_PROJECT_REF`. Exigir destino separado, ou autorização explícita sobre impacto no backend compartilhado, antes de qualquer escrita.
4. **Publicar catálogo apenas quando autorizado**: usar importador canônico, schema e dry-run no destino confirmado; preservar as 18 identidades legadas e evitar correspondência por nome. Acesso de leitura ao catálogo não exige produto comercial fictício.
5. **Aprovação por item/versão**: revisar `field_key`/fonte, variantes por produto, histórico necessário e contexto; registrar aprovador, data, escopo, versão, justificativa e validade. Migrar prospectivamente estados somente pelo contrato real de curadoria. Não liberar todos os itens por atualização em massa.
6. **Materializar a Agenda**: usar o mesmo escritor persistente, checagem de concorrência, `fazenda_id` e idempotência. Solicitação repetida, recarga, offline e farm-switch devem convergir sem gerar Evento.
7. **Sync remoto de Agenda**: é uma entrega **separada**. O writer local de `e72bf50` persiste em Dexie e não enfileira `create_agenda`; ativar flag não corrige esse contrato. Migration remota e testes de transporte ficam fora desta revisão documental.

## 6. Critérios de aceite por item antes de habilitar `agenda_automatica_condicional`

- Fonte por campo pertinente; `product_class`/grupo não usados como equivalência de esquema/dose de produto.
- Item de raiva com `no_agenda_auto`: **não pode gerar automaticamente**, inclusive dose 2/reforços, até revisão **por item e versão** aprovada; dose anterior ou plano válido não constitui revogação.
- Tipos de Agenda diferenciados: genérica (avaliar/manejar sem produto) versus aplicação com esquema definido; nenhuma promoção silenciosa de uma para outra.
- Identidade e composição comercial comprovadas para cobertura multiprotocolo, agrupamento somente de demandas compatíveis e **um ato executado = um Evento e uma baixa de estoque**, com vínculos rastreáveis a cada protocolo e sua versão, sem duplicidade.
- Aprovação explícita da regra, versão e escopo. Configuração válida da fazenda quando necessária, com UF/região/manejo/espécie e condições temporais.
- Pré-checagem explica **por que** cada animal/lote é elegível, não elegível ou tem dados insuficientes; nenhuma restrição normativa é substituída por sugestão.
- Para dose 2/reforço, Evento compatível com data, identidade e produto/esquema exigidos; não derivar fatos da Agenda ou estado atual.
- Criação de Agenda estável e idempotente; a mesma demanda não produz duplicidade ativa sob concorrência; cancelamento/reagendamento têm semântica definida e tarefas editadas não são sobrescritas.
- Sem Evento, movimento de estoque, carência ativa ou execução ao gerar Agenda; RLS/isolamento preservados onde existir escrita remota.
- Testes focados cobrindo fonte, janela, animais, reprocessamento, offline/reconnect, farm-switch e versões antigas com pendências.

## 7. Rastreabilidade de evidências e limites (E)

**Atribuição explícita, sem transformar relatório de agente em prova de runtime.**

| Informação | Referência disponível | Classificação nesta revisão | Falta para comprovação independente |
|---|---|---|---|
| Branch local `codex/sanitario-v2-entrega-funcional` e commit `e72bf5004fe2bf8d6a7052dc57ee1167f64ccb7e` | Relatório local `scratch/sanitario-v2-publicacao/REVISAO_PR.md`; relato do agente | **RELATADO / NÃO VERIFICADO NO GITHUB** | Conferir SHA, diff e worktree in loco; o commit não estava publicado no GitHub na verificação anterior |
| Fallow com **quatro achados novos** | `scratch/sanitario-v2-publicacao/REVISAO_PR.md` e registro de preparação; **logs/JSON bruto não incluídos neste pacote** | **RELATADO / IDs E LOCALIZAÇÕES NÃO FORNECIDOS** | Anexar caminho/hash do JSON/log Fallow e listar separadamente **os quatro IDs/assinaturas reais, regra, arquivo, linha, baseline e condição de falha**; não inventar IDs |
| Testes focados/Chromium e cenário Dexie | Evidências locais relatadas pela implementação; este pacote não inclui os logs brutos | **RELATADO / NÃO REEXECUTADO** | Ler logs e versões exatas ou reexecutar apenas se houver alteração funcional que os afete |
| Projeto remoto usado pelo frontend de produção | `scratch/sanitario-v2-publicacao/PLANO_PUBLICACAO.md` e observação anterior do bundle de produção | **RELATO COM VERIFICAÇÃO ANTERIOR**, sujeito a configuração corrente | Confirmar variáveis efetivas do preview/prod antes de qualquer escrita; não presumir ambiente isolado pelo nome |
| Writer local sem `create_agenda` na fila e sem sync remoto desta entrega | `scratch/sanitario-v2-publicacao/PLANO_PUBLICACAO.md`, implementação de referência | **LIMITE REPORTADO, NÃO RECERTIFICADO NESTA REVISÃO** | Inspecionar writer/sync no HEAD que será publicado e testar transporte antes de prometer multi-dispositivo |
| Decisões dos **20 itens**, inclusive três raiva `no_agenda_auto` | [Matriz CSV anexa](evidence/SANITARIO_V2_MATRIZ_DECISAO_AGENDA_20261015.csv); payload candidato 12F10 | **DOCUMENTAL — PROPOSTA NÃO ATIVADA** | Comparar UUIDs, `logical_item_key`, versão, restrições e status do JSON antes de qualquer promoção |
| Norma federal B19 e cobertura Fertiguard/Poliguard | [Portaria SDA/MAPA 1.633/2026](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/pncebt/legislacao-e-fichas-tecnicas/portaria_sda_mapa_na___1-633__de_12_de_junho_de_2026.pdf), [Fertiguard](https://www.msd-saude-animal.com.br/produto/fertiguard-selenium-max/), [Poliguard](https://www.msd-saude-animal.com.br/produto/poliguard/) | **FONTES PRIMÁRIAS CONSULTADAS** | Registrar cobertura por campo e identidade técnica no artefato canônico antes de mudar regras de execução |

**Regra de aprovação documental:** a ausência dos quatro identificadores do Fallow não invalida a redação clínica da política, mas impede declarar o CI `READY` ou atribuir as quatro falhas a funções específicas. A aprovação para integração do frontend depende de evidência do gate remoto atualizado; isso é independente da revisão normativa. O CSV deve ser revisto junto com este documento, não tratado como apêndice opcional.

**Situação ao emitir este documento:** recomendação documental concluída; **nenhum dos 20 itens foi operacionalmente ativado**, nenhuma alteração em banco, migração, flag, JSON de importação ou frontend foi realizada por este documento.


## Nota de implementação local — 16/10/2026

O conteúdo de 15/10 acima continua sendo a proposta documental, sem aprovação curatorial. A implementação posterior da branch `codex/sanitario-v2-politica-ae` está descrita na [evidência local A–E](evidence/SANITARIO_V2_A_E_IMPLEMENTACAO_LOCAL_20261016.md).

Os tipos de planejamento agora existem no TypeScript e no JSON `protocol_item_snapshot.planningKind` da Agenda local, sem novo enum SQL ou migration. A Central oferece planejamento manual e geração condicional por regra autorizada. Ausência de fontes/aprovação continua impedindo automação; os 20 itens candidatos e a matriz CSV continuam com `allows_agenda_auto=false`. B19 genérica não exige produto e não autoriza administração. Conversão de avaliação para esquema não ocorre por atualização de catálogo: cancelar a avaliação e realizar nova seleção/validação e confirmação explícitas.

Cobertura multiprotocolo possui identificação/agrupamento informativo, com identidade comercial, composição/fonte, esquema e versões. O contrato factual ainda possui um único item/versionamento por Agenda/Evento: materialização de aplicações possivelmente duplicadas fica bloqueada para revisão técnica. Não há certificado local de um Evento cobrindo múltiplos protocolos nem de sincronização dessas novas intenções.
