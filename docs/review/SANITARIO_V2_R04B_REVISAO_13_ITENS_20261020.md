# R04B — revisão dos 13 itens sanitários e previews curatoriais

> **SUPERSEDIDO em 21/10/2026:** manter como registro da análise anterior. As candidatas de avaliação nas chaves de vacinação não devem ser submetidas. O pedido posterior preserva a identidade vacinal e é atendido em [convergência por classe](SANITARIO_V2_R04B_CLASSES_20261021.md) e no novo pacote de previews. Os estados de prontidão abaixo são históricos.

Atualizado em: 2026-10-20
Baseline: `codex/sanitario-v2-convergencia@b5b6ffc9f515874577003efd2cce3ef4492bdb74`.
Modo: DOCUMENTATION, com diagnóstico somente leitura do catálogo e dos contratos.
Status: **revisão e propostas locais preparadas; sem aprovação ou publicação remota**.

**Decisão:** oito itens liberáveis com restrições no escopo indicado, quatro pendentes para
automação de esquema específico e uma segunda dose incompatível com a referência utilizada.
Nenhum item está liberado irrestritamente. Consulta e registro factual não dependem da aprovação
da automação; registrar um fato não certifica adequação técnica ou legal da aplicação.

Os oito aceites técnicos preparados são **01, 04, 05, 06, 08, 11, 12 e 13**.
Somente **01, 06 e 08** têm novas versões candidatas de avaliação genérica.
Os outros cinco preservam consulta/manual ou informação histórica, sem automação.
**Zero decisões estão prontas para submissão imediata à RPC no estado remoto atual.**
Não confundir aprovação do proprietário à proposta com aprovação global de catálogo.

Evidências: [baseline remoto](evidence/SANITARIO_V2_R04B_BASELINE_20261020.json),
[painel MAPA capturado](evidence/SANITARIO_V2_R04B_MAPA_UI_20261020.json) e
[previews estruturados](evidence/SANITARIO_V2_R04B_PREVIEWS_20261020.json).
O JSON contém, por item, evidência por campo, impedimento, proposta, limite da autorização e
conteúdo candidato quando aplicável. UUIDs candidatos são propostos, inexistentes no banco.
Nenhum arquivo novo é fonte de runtime ou importável automaticamente.

## Fatos confirmados e preservação do baseline

- O worktree inicial estava em outra branch. O worktree correto foi localizado em
  `C:/Users/mares/.codex/worktrees/sanitario-v2-convergencia/GestaoAgro`, inicialmente limpo.
  A alteração preexistente `supabase/.temp/cli-latest` na pasta inicial foi preservada.
- Projeto remoto consultado: `zqloazqzhwauamcejmuz`. Há 20 itens atuais, sete ativos com
  automação autorizada e 13 `draft/allows_agenda_auto=false`.
- Cinco decisões curatoriais anteriores permanecem registradas. Gates: zero habilitados;
  existe uma linha histórica da R05, desabilitada. Rollout local continua false.
- Fazenda R05: sete Agendas preservadas, zero Eventos. Sua homologação não foi executada
  novamente, e as evidências originais não foram alteradas.
- As consultas desta tarefa são SELECTs de catálogo, metadados e integridade; nenhuma escrita,
  chamada de decisão, simulação de identidade, migration, deploy, push ou merge foi executada.

## Evidência técnica atual

Fontes acessadas em 20/10/2026, sem presumir que a data de acesso seja a data de revisão da bula:

- **F1 — [bula Fortress 7](https://www2.zoetis.com.br/content/pt/pages/Especies/Bovinos/Bulario/_assets/Fortress-7.pdf)**, página 1, indicação, modo de usar e precauções.
- **F2 — [resumo oficial Poliguard, MSD](https://www.msd-saude-animal.com.br/produto/poliguard/)**, composição, indicação, dosagem e precauções.
  É resumo oficial; não comprova bula integral vigente ou situação regulatória.
- **F3 — [bula Leptoferm 5/2 mL](https://www2.zoetis.com.br/content/pt/pages/Especies/Bovinos/Bulario/_assets/Leptoferm5.2.pdf)**, página 1, descrição, esquema e carência; arte 40040644, v2.
- **F4 — [painel oficial MAPA de Produtos Biológicos](https://mapa-indicadores.agricultura.gov.br/publico/extensions/Produtos_Biologicos/Produtos_Biologicos.html)**,
  atualizado no próprio painel em **20/10/2026 06:00:47**.
- **F5 — [IN MAPA 5/2002 consolidada com IN 41/2020](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/qualidade-dos-servicos-veterinarios/arquivos/pncrh/in_05_2002_alt__n_41_2020_norma_tecnica_controle_rh.pdf)**,
  arts. 7–11, 27 e 30; [orientação MAPA de vacinação antirrábica](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/raiva-dos-herbivoros-e-eeb/vacina-antirrabica).
- **F6 — [Portaria MAPA 678/2024, reprodução do DOU pela ADAF](https://www.adaf.am.gov.br/wp-content/uploads/2024/06/PORTARIA-MAPA-No-678-DE-30-DE-ABRIL-DE-2024-PORTARIA-MAPA-No-678-DE-30-DE-ABRIL-DE-2024-DOU-Imprensa-Nacional.pdf)**,
  art. 1 alterando arts. 1–2 da Portaria 665/2024 nas UFs listadas; e
  [situação nacional atual publicada pelo MAPA](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/febre-aftosa/combate-febre-aftosa), atualizada em 22/07/2026.

| Campo verificado | Fortress 7 — F1/F4 | Poliguard — F2/F4 | Leptoferm 5 — F3/F4 |
|---|---|---|---|
| Registro atual | Painel exibe VIGENTE, 5.893/1997, titular Zoetis | Não localizado por POLIGUARD ou 9.299; vigência/titular atuais não confirmados | Painel exibe VIGENTE, 5.037/1995, titular Zoetis |
| Espécie da proposta | Somente bovinos | Somente bovinos | Somente bovinos; esquema suíno separado |
| Idade | Mínima não declarada | Após quatro meses **para filhos de mães vacinadas**; não universalizar | Mínima não declarada |
| Indicação | Clostridioses expressamente contempladas, bovinos sadios | IBR, BVD e leptospirose, bovinos sadios | Leptospirose pelos sorovares descritos, bovinos sadios |
| Intervalo | Duas iniciais a 28–42 dias; anual única | Duas iniciais a 21–30 dias; reforço a 12 meses | Inicial única bovina; anual única; semestral não comprovado |
| Gestação | Não declarada | Vacas prenhes admitidas expressamente | Não declarada |
| Lactação | Não declarada | Não declarada no resumo | Não declarada |
| Produto | Fortress 7/Zoetis, identidade existente | Poliguard, resumo MSD; não é produto Zoetis | Leptoferm 5/2 mL/Zoetis, identidade existente |
| Dose e via | 5 mL SC | 5 mL SC | 2 mL IM |
| Carência | 21 dias antes do abate; leite desconhecido | Carne/leite não informados no resumo | 21 dias antes do abate; leite desconhecido |

**Limite do indicador F4:** a expressão visível da coluna agrupa `EM RENOVAÇÃO` em
`VIGENTE`. A evidência é a situação publicada pelo indicador, com identidade e titular;
não foi obtido certificado individual ou status bruto. Ela resolve a pendência anterior
de ausência de consulta atual para Fortress/Leptoferm, sem validar automaticamente todos os usos.

A busca sem correspondência de Poliguard **não prova cancelamento**. O número
`9.299/2007` encontrado na lista de 2014 continua apenas evidência histórica.
Também foi baixado o [recurso SIPEAGRO denominado Produto Veterinário](https://dados.agricultura.gov.br/pt_PT/dataset/sipeagro/resource/7ce5fac0-9c8f-4e14-82d9-6deab9b5e2e9):
seu CSV contém estabelecimentos e não denominações/licenças individuais dos produtos;
portanto não resolve a vigência destes três produtos. Cabeçalho e hash estão no pacote.

**Critério técnico:** ausência de idade mínima, gestação ou lactação não significa
contraindicação. Tampouco comprova segurança irrestrita. Não criar idade, proibição,
dose ou carência por silêncio. Ausência de evidência bubalina não bloqueia estas propostas
bovinas. Carência desconhecida de execução não bloqueia consulta ou avaliação sem aplicação.
As informações literais de F2 continuam comprovadas para esses campos, mesmo sem vigência
regulatória de Poliguard confirmada; não rebaixar todos os campos pelo mesmo motivo.

## Matriz dos 13 itens

Todos os itens abaixo continuam `draft`, com automação false, no remoto. Siglas das fontes:
F1–F6 acima. “Aprovar proposta” significa somente o recorte explicitado, ainda não aplicado.

| Decisão / item | Estado técnico atual | Evidência encontrada | Impedimento concreto | Decisão recomendada | Ajuste mínimo / pronto para aceite |
|---|---|---|---|---|---|
| 01 — clostridial_primovac_dose1 v2 | recomendado; draft | F1 bovinos, 5 mL SC; F4 vigente | Item atual é vacinação sem produto/dose/via e sem referências normalizadas; isso não impede avaliação | **LIBERÁVEL COM RESTRIÇÕES**: avaliação bovina sem aplicação | Nova versão v3 de manejo/avaliação, nenhum produto/dose/via; **proposta pronta** |
| 02 — clostridial_primovac_dose2 v3 | recomendado; draft | F1 28–42 dias; F4 vigente | Produto/esquema por campo e Evento anterior compatível; condições individuais sem aprovação irrestrita | **PENDENTE DE EVIDÊNCIA ESPECÍFICA** para automação; consulta/manual disponíveis | Preservar intervalo e âncora; não transformar reforço em avaliação independente; retirar exigência bubalina |
| 03 — clostridial_reforco_anual v2 | recomendado; draft | F1 anual; F4 vigente | Produto/esquema e Evento factual; tolerância de +30 dias não sustentada | **PENDENTE DE EVIDÊNCIA ESPECÍFICA** para automação; consulta/manual disponíveis | Vincular esquema em nova versão; remover tolerância sem fonte; vigência já obtida |
| 06 — ibr_bvd_primovac_dose1 v2 | recomendado; draft | F2 espécie, condição etária materna, gestação, 5 mL SC | Vigência/titular e bula integral atuais pendentes para uso comercial; não impedem avaliação | **LIBERÁVEL COM RESTRIÇÕES**: avaliação bovina sem aplicação | Nova versão v3 de avaliação; fonte limitada por campo, sem extrapolar bula integral; **proposta pronta** |
| 07 — ibr_bvd_primovac_dose2 v3 | recomendado; draft | F2 21–30 dias, gestação admitida | Vigência não confirmada, produto/esquema e Evento anterior; carências desconhecidas | **PENDENTE DE EVIDÊNCIA ESPECÍFICA** para automação | Preservar 21–30 dias; obter situação regulatória/rotulagem e vincular produto; não duplicar aplicação multiprotocolo |
| 08 — lepto_primovac_dose1 v2 | condicional; draft | F3 inicial única bovina, 2 mL IM; F4 vigente | Atual vacinação depende de esquema/produto; contexto de risco atual deve ser preservado | **LIBERÁVEL COM RESTRIÇÕES**: avaliação bovina sem aplicação | Nova versão v3 de avaliação com risco explícito preservado; **proposta pronta** |
| 10 — lepto_reforco_anual_semestral v2 | condicional; draft; recorrência anual | F3 anual única; F4 vigente | Produto/esquema, Evento anterior e cobertura por campo; semestral e tolerância +30 dias sem fonte | **PENDENTE DE EVIDÊNCIA ESPECÍFICA** para automação anual; semestral não autorizada por F3 | Restringir futura variante à anual; não renomear chave lógica histórica; semestral exige outra fonte/variante |
| 11 — raiva_primovac_dose1 v1 | condicional; manual_only; no_agenda_auto | F5 vacina inativada; ≥3 meses em área de ocorrência, menores a critério MV | Automação bloqueada por política versionada e guard da família; contexto/rotulagem para esquema | **LIBERÁVEL COM RESTRIÇÕES** para consulta/manejo manual | Preservar flags; não exigir foco/perifoco para toda consulta ou manejo voluntário; **aceite restrito pronto** |
| 12 — raiva_primovac_reforco_30d v1 | condicional; manual_only; no_agenda_auto | F5 art. 8 §2: 30 dias após primeira aplicação | Para automação: decisão versionada, contexto e Evento anterior; não é proibição de consulta | **LIBERÁVEL COM RESTRIÇÕES** para consulta/manejo manual | Preservar vínculo factual e 30 dias; **aceite restrito pronto** |
| 13 — raiva_reforco_anual_area_risco v1 | condicional; manual_only; no_agenda_auto | F5 art. 10: máximo 12 meses | Automação sem revisão/variante aprovada; +30 dias não cabe no máximo normativo | **LIBERÁVEL COM RESTRIÇÕES** para consulta/manual dentro do esquema aplicável | Não aprovar tolerância +30 dias; preservar no_agenda_auto; **aceite restrito pronto** |
| 04 — fmd_bloqueio_vacinacao_rotina v1 | bloqueado; protocolo retired | F6 regime sem vacinação | Uso rotineiro incompatível com a norma; não é restrição de consulta | **LIBERÁVEL COM RESTRIÇÕES** somente informativa | Preservar retired/bloqueado, vincular referência direta na justificativa; **aceite informativo pronto** |
| 05 — fmd_historico_contingencia v1 | bloqueado; protocolo retired | F6 situação atual; histórico consultável | Contingência exige ato/comando específico; plano genérico não o substitui | **LIBERÁVEL COM RESTRIÇÕES** somente consulta/histórico | Preservar restrição; nenhum calendário ou aplicação futura; **aceite informativo pronto** |
| 09 — lepto_primovac_dose2 v1 | bloqueado; janela blocked | F3 bovino inicial única; duas doses são suínas | Segunda dose bovina incompatível com a referência | **INCOMPATÍVEL COM A FONTE** no esquema Leptoferm bovino | Não liberar; outro produto exige variante e fontes próprias; consulta/fato histórico preservados |

Os quatro itens pendentes não estão bloqueados por uma exigência comercial genérica sem
identificação: o JSON especifica o que já existe e o que falta em cada esquema.
Os intervalos e revacinações comprovados **não** precisam ser redescobertos.
Histórico individual, contexto regional e plano de fazenda são condições de elegibilidade
na execução futura, não documentos que o proprietário precisa produzir para aceitar esta revisão.

## Identidades e versões conferidas no remoto

| R04B-01 | `clostridial_primovac_dose1` | `fe0ddfbc-6b4b-5161-843f-b4cfbd4bff53` | v2 |
| R04B-02 | `clostridial_primovac_dose2` | `675e30b0-0654-5407-824e-a73eeead11b4` | v3 |
| R04B-03 | `clostridial_reforco_anual` | `a694a3c6-63b3-5e4b-b035-ceb7b3d0e626` | v2 |
| R04B-04 | `fmd_bloqueio_vacinacao_rotina` | `fa867ec0-acdf-4b8c-a12e-2620faca4e08` | v1 |
| R04B-05 | `fmd_historico_contingencia` | `dd09c61e-6686-4b1c-99b7-ef9c3f15dc6b` | v1 |
| R04B-06 | `ibr_bvd_primovac_dose1` | `85fd413b-649f-5353-a6b2-7a03f1b08d58` | v2 |
| R04B-07 | `ibr_bvd_primovac_dose2` | `6d8b7130-c1a5-577e-ac60-1d127eca0b8d` | v3 |
| R04B-08 | `lepto_primovac_dose1` | `85f9ce5a-6173-5183-aca9-c4106ce938cd` | v2 |
| R04B-09 | `lepto_primovac_dose2` | `77c52cb2-069e-4d84-89d4-1cb26236ab5a` | v1 |
| R04B-10 | `lepto_reforco_anual_semestral` | `76e411fe-8690-5229-a3e7-cf0b0d4a2f11` | v2 |
| R04B-11 | `raiva_primovac_dose1` | `34b2ac38-25cb-4cef-9885-7b8bd027495d` | v1 |
| R04B-12 | `raiva_primovac_reforco_30d` | `f62a7a12-0604-4539-8245-5564e4e3592e` | v1 |
| R04B-13 | `raiva_reforco_anual_area_risco` | `e5430f23-2f84-4812-9caa-85bb6596304d` | v1 |

Os três protocolos comerciais são globais, sem fazenda, e permanecem v1/draft.
Raiva permanece v1/draft; aftosa permanece v1/retired. Os sete itens já aprovados
não fazem parte das seleções propostas.

O pacote também propõe incorporar a evidência atual de registro aos metadados dos dois
produtos existentes Fortress/Leptoferm, sem criar produto ou mudar seu status curatorial.
Essas duas propostas não foram aplicadas. O recorte do indicador e sua limitação de status
agrupado devem acompanhar a evidência; Poliguard permanece sem confirmação regulatória.

## Previews prontos para autorização específica

### Avaliação sem aplicação — 01, 06 e 08

No [pacote JSON](evidence/SANITARIO_V2_R04B_PREVIEWS_20261020.json), cada preview contém:

1. ID/versão atual e UUID físico proposto, versão seguinte e `supersedes`.
2. `action_type=manejo_sanitario`, `product_requirement_kind=none`, produto/classe/dose/via nulos;
   `planning_scope=assessment_only`; sem recorrência de vacinação.
3. Elegibilidade bovina e contexto manual existentes; risco de leptospirose preservado.
   Nenhuma idade ou categoria clínica inventada.
4. Fontes candidatas limitadas e coberturas propostas de `eligibility_rule`,
   `operational_window` e `product_requirement`.
   A cobertura é para avaliação; a bula não é apresentada como autorização para omitir produto
   numa vacinação. As fontes anteriores e suas limitações permanecem no baseline.
5. `status=draft`, `allows_agenda_auto=false`, assinatura/ator/digest remoto pendentes.
   As lacunas de aplicação continuam registradas em `sourcePolicy.applicationEvidence`;
   retirar bloqueio genérico não resolve automaticamente as lacunas comerciais.

**Justificativa:** avaliar o manejo bovino não administra vacina. A proposta retira
exigências de produto executado e autorização bubalina desse recorte, mantendo os dados de
vacinação comprovados apenas como referência e os campos ausentes como desconhecidos.

**Efeito a autorizar:** substituir semanticamente somente essas três etapas por versões
de avaliação. A eventual aprovação global pela RPC tornará a avaliação elegível à automação;
não ativa gate/plano de fazenda, não vacina e não altera as sete Agendas existentes.
Se o proprietário desejar preservar vacinação nas três etapas atuais, deve recusar essa
substituição e manter o caminho de esquema específico, sem aprovar uma versão ambígua.

### Consulta/manual e informação — 04, 05, 11, 12 e 13

Os cinco previews documentais mantêm IDs, versões e flags.
O aceite é da interpretação restrita e das fontes, sem comando `approved` na RPC.

Raiva: preservar consulta e manejo manual; foco/perifoco é contexto próprio, não requisito
universal para consulta nem prova de que todo manejo depende de ocorrência atual.
A vacinação sistemática e a obrigatoriedade dependem da norma/contexto aplicável; adesão
voluntária não se torna proibida por `no_agenda_auto`. Menores de três meses exigem MV.
Não ampliar janela de reforço ou imunidade.

Aftosa: preservar leitura histórica e referência regulatória. Nenhuma decisão deste pacote
autoriza aplicação rotineira, emergência sanitária ou dispensa de autoridade competente.

### Por que os candidatos ainda não são previews autenticados

O [cliente existente](../../src/lib/sanitario/catalog/sanitaryCatalogReviewV2.ts) e a
[migration da revisão](../../supabase/migrations/20261017080447_sanitario_catalog_review_v2.sql)
foram conferidos contra as definições SQL remotas:

- A RPC de decisão aprovada coloca protocolo em active/approved e item em active com
  `allows_agenda_auto=true`; não existe resultado “aprovar somente consulta” nessa RPC.
- O guard impede raiva, aftosa e LEP2 expressamente. Não removê-lo nesta revisão.
- Vacinação específica exige produto ativo com vigência verificada, dose/via e fontes por campo.
- Uma avaliação exige outro recorte semântico e fontes normalizadas; as versões candidatas
  ainda não estão no banco. Chamar a RPC sobre o conteúdo atual não validaria o candidato.
- A política local considera `previous_dose`, `last_execution`, dose 2 e anual como esquema
  definido. Adicionar somente `assessment_only` aos quatro reforços não os libera;
  remover essas âncoras destruiria o contrato factual. Por isso não foi proposto esse atalho.
- Digest local do pacote não é o digest PostgreSQL de `content::text`.
  Depois de autorização específica de conteúdo/publicação, obter novo preview autenticado
  e confirmação do conteúdo/digest antes de qualquer decisão global.

Nenhuma credencial foi lida ou exportada; nenhuma identidade foi simulada via SQL.
Não houve alteração em RLS, sync, RPC, schema, UI ou writers operacionais.

## Validação e pendências reais

Validação proporcional desta entrega documental: integridade dos JSONs, 13 identidades
distintas, correspondência com o baseline remoto, fontes/coberturas candidatas vinculadas,
escopo das três avaliações e preservação de versões/flags, links e `git diff --check`.
A evidência final de verificações é registrada no pacote de baseline.
Sem regressão global, build ou E2E; não houve alteração de runtime e R05 não foi repetida.
Os gates gerais de continuidade documental não foram usados: a cadeia de fase/roadmap não mudou.

Resultado observado: **12 verificações locais passaram**, por script Node em memória usando
os módulos TypeScript reais de política de planejamento e fontes. As três propostas foram
classificadas como avaliação genérica; continuam bloqueadas antes da aprovação. A projeção
com flags futuros passou somente na política pura, sem ator, recibo ou persistência simulados.
Os quatro esquemas dependentes conservaram bloqueios. Isso não é teste clínico ponta a ponta
nem preview autenticado. O recibo e os hashes do pacote/painel estão no baseline JSON.

Na reconferência remota entre 22:04:47 e 22:11:47 UTC (19:04:47–19:11:47 em São Paulo),
coincidiram todos os digests de itens, protocolos, fontes, coberturas, produtos e sete Agendas
R05; zero Eventos R05, cinco decisões curatoriais e zero gates habilitados permaneceram iguais.

Pendências para decisões futuras:

1. Autorização do proprietário ao recorte exato dos oito aceites; três deles substituem
   vacinação por avaliação. Nenhuma aprovação global ou escrita remota está implícita.
2. Para os quatro esquemas dependentes, completar somente os campos específicos listados.
   Em Poliguard, confirmar vigência/titular e rotulagem integral; em Fortress/Leptoferm,
   incorporar a consulta atual de registro e delimitar condições individuais sem alegar
   segurança irrestrita, leite zero ou idade inventada.
3. Automação de raiva requer revisão/versão e contrato próprio aprovados; aftosa e LEP2
   conservam as restrições. Não é necessário reexecutar R05 para aceitar este relatório.
