# R04B — planejamento por classe e curadoria dos 13 itens

Data: 21/10/2026. Baseline confirmado: `codex/sanitario-v2-convergencia@b5b6ffc9f515874577003efd2cce3ef4492bdb74`.

**Decisão técnica:** implementação local do contrato opt-in por classe, com cinco versões candidatas de vacinação. Dez itens são LIBERÁVEIS COM RESTRIÇÕES nos respectivos escopos (cinco candidatas de vacinação, cinco de consulta/manual/informação), dois permanecem PENDENTES DE EVIDÊNCIA ESPECÍFICA e LEP2 é INCOMPATÍVEL COM A FONTE. Zero itens aprovados nesta tarefa. O contrato novo não está instalado no remoto.

Esta entrega substitui as propostas de avaliação genérica nas chaves de vacinação do relatório anterior. Os arquivos anteriores estão marcados SUPERSEDIDOS/do_not_submit e permanecem como histórico. Não se troca a finalidade de `primovac_dose1`.

## Fatos verificados e fontes

[Previews por item e fontes por campo](evidence/SANITARIO_V2_R04B_CLASS_PREVIEWS_20261021.json), [baseline](evidence/SANITARIO_V2_R04B_BASELINE_20261020.json), [captura do painel MAPA](evidence/SANITARIO_V2_R04B_MAPA_UI_20261020.json), [comparação remota final](evidence/SANITARIO_V2_R04B_CLASS_REMOTE_FINAL_20261020.json).

Fontes acessadas em 20/10/2026: [Fortress 7/Zoetis](https://www2.zoetis.com.br/content/pt/pages/Especies/Bovinos/Bulario/_assets/Fortress-7.pdf), [Leptoferm 5/2 mL/Zoetis](https://www2.zoetis.com.br/content/pt/pages/Especies/Bovinos/Bulario/_assets/Leptoferm5.2.pdf), [resumo oficial Poliguard/MSD](https://www.msd-saude-animal.com.br/produto/poliguard/) e [painel MAPA](https://mapa-indicadores.agricultura.gov.br/publico/extensions/Produtos_Biologicos/Produtos_Biologicos.html). As datas de acesso não comprovam revisão recente das bulas. O preview conserva espécie, idade, indicação, intervalo, gestação/lactação, identidade, dose/via e carência comprovados ou desconhecidos para cada item.

Fortress e Leptoferm aparecem VIGENTE no indicador MAPA atualizado em 20/10/2026 06:00:47, com registro/titular correspondentes; a expressão do indicador inclui EM RENOVAÇÃO e não equivale a certificado individual. Poliguard não foi localizado por nome/registro: vigência desconhecida, sem prova de cancelamento. O recurso SIPEAGRO disponível contém estabelecimentos, não as licenças dos produtos; não resolve essa lacuna.

Fortress sustenta duas iniciais bovinas 28–42 dias e anual; Leptoferm sustenta inicial única bovina e anual. Idade mínima, gestação/lactação e carência para leite não declaradas permanecem desconhecidas. Isso não é contraindicação inventada nem carência zero. As candidatas são exclusivamente bovinas; não se exige evidência bubalina. Dose/via e 21 dias pré-abate são fatos dessas bulas, sem generalização à classe.

Poliguard sustenta tecnologia inativada e duas iniciais 21–30 dias, mas o critério >4 meses se refere a filhos de mães vacinadas. Essa condição não é verificável pelo contexto atual do motor. Não se impõe quatro meses a todos os bovinos nem se presume elegibilidade de categorias não cobertas. A pendência de registro comercial é distinta e afeta a aplicação; não proíbe consulta ou planejamento manual. Uma fonte específica que delimite a variante/categoria resolve a pendência, sem exigir bula de bubalinos ou carência para planejar.

Raiva: [IN 5/2002, consolidada pela IN 41/2020](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/qualidade-dos-servicos-veterinarios/arquivos/pncrh/in_05_2002_alt__n_41_2020_norma_tecnica_controle_rh.pdf), arts. 7–11, 27 e 30, sustenta reforço inicial 30 dias e contexto epidemiológico. Não comprova área de risco para qualquer fazenda. Aftosa: [Portaria MAPA 678/2024, reprodução do DOU](https://www.adaf.am.gov.br/wp-content/uploads/2024/06/PORTARIA-MAPA-No-678-DE-30-DE-ABRIL-DE-2024-PORTARIA-MAPA-No-678-DE-30-DE-ABRIL-DE-2024-DOU-Imprensa-Nacional.pdf) e [situação atual MAPA](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/programas-de-saude-animal/febre-aftosa/combate-febre-aftosa) sustentam ausência de vacinação de rotina. Consulta e história não são proibidas.

## Matriz dos 13 itens

Todos os itens abaixo continuam remotamente draft e sem automação autorizada. As fontes/justificativas detalhadas e os impedimentos específicos estão também no JSON, vinculados a cada ID.

| Item | Identidade atual | Estado | Evidência | Decisão recomendada | Ajuste mínimo |
|---|---|---|---|---|---|
| 01 | `clostridial_primovac_dose1` — `fe0ddfbc-6b4b-5161-843f-b4cfbd4bff53` v2 | draft; auto=false | SRC_BULA_FORTRESS7; Duas doses iniciais, 28–42 dias; revacinação anual com dose única. Sem tolerância adicional demonstrada. | LIBERÁVEL COM RESTRIÇÕES | v3: classe/esquema, vacinação preservada. Nova versão física da mesma chave/ação; quatro fontes normalizadas; sem marca/dose/via; intervalo literal; reforço anual sem tolerância adicional, após série completa ou reforço factual compatível. |
| 02 | `clostridial_primovac_dose2` — `675e30b0-0654-5407-824e-a73eeead11b4` v3 | draft; auto=false | SRC_BULA_FORTRESS7; Duas doses iniciais, 28–42 dias; revacinação anual com dose única. Sem tolerância adicional demonstrada. | LIBERÁVEL COM RESTRIÇÕES | v4: classe/esquema, vacinação preservada. Nova versão física da mesma chave/ação; quatro fontes normalizadas; sem marca/dose/via; intervalo literal; reforço anual sem tolerância adicional, após série completa ou reforço factual compatível. |
| 03 | `clostridial_reforco_anual` — `a694a3c6-63b3-5e4b-b035-ceb7b3d0e626` v2 | draft; auto=false | SRC_BULA_FORTRESS7; Duas doses iniciais, 28–42 dias; revacinação anual com dose única. Sem tolerância adicional demonstrada. | LIBERÁVEL COM RESTRIÇÕES | v3: classe/esquema, vacinação preservada. Nova versão física da mesma chave/ação; quatro fontes normalizadas; sem marca/dose/via; intervalo literal; reforço anual sem tolerância adicional, após série completa ou reforço factual compatível. |
| 04 | `fmd_bloqueio_vacinacao_rotina` — `fa867ec0-acdf-4b8c-a12e-2620faca4e08` v1 | draft; auto=false | Fontes normativas no preview; Ver evidência por campo no JSON | LIBERÁVEL COM RESTRIÇÕES | Manter protocolo retirado, espécie e conteúdo histórico; não produzir versão automatizável. |
| 05 | `fmd_historico_contingencia` — `dd09c61e-6686-4b1c-99b7-ef9c3f15dc6b` v1 | draft; auto=false | Fontes normativas no preview; Ver evidência por campo no JSON | LIBERÁVEL COM RESTRIÇÕES | Manter protocolo retirado, espécie e conteúdo histórico; não produzir versão automatizável. |
| 06 | `ibr_bvd_primovac_dose1` — `85fd413b-649f-5353-a6b2-7a03f1b08d58` v2 | draft; auto=false | SRC_BULA_POLIGUARD; Duas doses de primovacinação com 21–30 dias; reforço de 12 meses. | PENDENTE DE EVIDÊNCIA ESPECÍFICA | Preservar ambas as chaves de vacinação; delimitar variante/eligibilidade e cobertura por campo da fonte oficial. Dose 2 mantém Evento compatível de dose 1 e 21–30 dias. |
| 07 | `ibr_bvd_primovac_dose2` — `6d8b7130-c1a5-577e-ac60-1d127eca0b8d` v3 | draft; auto=false | SRC_BULA_POLIGUARD; Duas doses de primovacinação com 21–30 dias; reforço de 12 meses. | PENDENTE DE EVIDÊNCIA ESPECÍFICA | Preservar ambas as chaves de vacinação; delimitar variante/eligibilidade e cobertura por campo da fonte oficial. Dose 2 mantém Evento compatível de dose 1 e 21–30 dias. |
| 08 | `lepto_primovac_dose1` — `85f9ce5a-6173-5183-aca9-c4106ce938cd` v2 | draft; auto=false | SRC_BULA_LEPTOFERM5; Bovinos: dose inicial única e revacinação anual única. Duas doses iniciais são descritas para suínos. Semestral não sustentado. | LIBERÁVEL COM RESTRIÇÕES | v3: classe/esquema, vacinação preservada. Nova versão física da mesma chave/ação; quatro fontes normalizadas; sem marca/dose/via; intervalo literal; reforço anual sem tolerância adicional, após série completa ou reforço factual compatível. |
| 09 | `lepto_primovac_dose2` — `77c52cb2-069e-4d84-89d4-1cb26236ab5a` v1 | draft; auto=false | SRC_BULA_LEPTOFERM5; Bovinos: dose inicial única e revacinação anual única. Duas doses iniciais são descritas para suínos. Semestral não sustentado. | INCOMPATÍVEL COM A FONTE | Preservar bloqueio da versão 1; nenhuma candidata de dose 2. Variante futura exige fonte própria e série completa compatível, sem trocar a identidade antiga. |
| 10 | `lepto_reforco_anual_semestral` — `76e411fe-8690-5229-a3e7-cf0b0d4a2f11` v2 | draft; auto=false | SRC_BULA_LEPTOFERM5; Bovinos: dose inicial única e revacinação anual única. Duas doses iniciais são descritas para suínos. Semestral não sustentado. | LIBERÁVEL COM RESTRIÇÕES | v3: classe/esquema, vacinação preservada. Nova versão física da mesma chave/ação; quatro fontes normalizadas; sem marca/dose/via; intervalo literal; reforço anual sem tolerância adicional, após série completa ou reforço factual compatível. |
| 11 | `raiva_primovac_dose1` — `34b2ac38-25cb-4cef-9885-7b8bd027495d` v1 | draft; auto=false | Fontes normativas no preview; Dose inicial sob contexto técnico adequado; não gerar por suspeita genérica. | LIBERÁVEL COM RESTRIÇÕES | Preservar no_agenda_auto atual e não proibir consulta nem fato manual. Variante regional futura precisa contexto verificável, fonte/ato e aprovação; reforço 30 dias depende do Evento da dose inicial. |
| 12 | `raiva_primovac_reforco_30d` — `f62a7a12-0604-4539-8245-5564e4e3592e` v1 | draft; auto=false | Fontes normativas no preview; Reforço 30 dias após Evento da dose inicial, IN 5/2002 art. 8 §2. | LIBERÁVEL COM RESTRIÇÕES | Preservar no_agenda_auto atual e não proibir consulta nem fato manual. Variante regional futura precisa contexto verificável, fonte/ato e aprovação; reforço 30 dias depende do Evento da dose inicial. |
| 13 | `raiva_reforco_anual_area_risco` — `e5430f23-2f84-4812-9caa-85bb6596304d` v1 | draft; auto=false | Fontes normativas no preview; Imunidade máxima para revacinação de 12 meses, art. 10; tolerância +30 dias não sustentada. | LIBERÁVEL COM RESTRIÇÕES | Preservar no_agenda_auto atual e não proibir consulta nem fato manual. Variante regional futura precisa contexto verificável, fonte/ato e aprovação; reforço 30 dias depende do Evento da dose inicial. |

Impedimentos concretos que permanecem:

- IBR1/IBR2: elegibilidade da variante/categoria pretendida ainda não delimitada de forma verificável. A fonte cadastrada permanece apoio/PRECISA_VALIDAR; não se promove toda a fonte por inferência. Os intervalos literais permanecem reconhecidos.
- LEP2: Leptoferm bovino não sustenta segunda dose; a série de duas iniciais é suína. Nenhuma candidata de dose 2 foi criada. Outra variante precisa evidência própria e série compatível.
- Raiva: faltam variante regional, fonte/ato e contexto epidemiológico aprovados para automação. A RPC atual mantém a restrição da família; futura liberação contextual exige revisão específica desse guard. Aftosa permanece somente informação/histórico e contingência sob comando oficial.

## Diferenças entre contrato anterior e patch local

| Ponto | Antes | Agora, somente em nova versão class_scheme |
|---|---|---|
| Aprovação de esquema definido | Produto comercial, registro, dose e via antecipados para toda regra dependente | Classe vacinal global revisada e quatro campos com fonte/cobertura registrada; sem marca/dose/via |
| Fonte de intervalo | Guard comercial uniforme | Variante da bula ou norma, limitada à cobertura escolhida; não libera toda a classe |
| Snapshot da Agenda | Versão/janela/fontes | Acrescenta escopo, política de produto e booster_rule nos mesmos JSON existentes |
| Dose 2 | Histórico factual e vínculo específico quando exigido | Mantém histórico factual e exige cobertura compatível registrada no produto realmente aplicado |
| Reforço anual | Última execução da família | Em classe, conclusão da série inicial definida por previous_logical_item_key ou próprio reforço; sem tolerância extra |
| Aplicação prospectiva | Curadoria vigente e snapshot técnico do produto | Acrescenta prova produto→fonte→cobertura do esquema e vigência comercial; revalida dentro da mesma transação |
| Fato já ocorrido | Registro auditável com não conformidades | Preserva fato e alerta se registro/esquema incompatível; não certifica esquema sem prova |
| Digest curatorial | Protocolo, itens, fontes/coberturas, produtos | Inclui classe revisada; decisão trava essas linhas e rejeita digest obsoleto |
| Legado | R04/R05 e regras sem marcador | Mesmo contrato anterior; nenhuma reinterpretação automática de snapshots antigos |

Foram reutilizados product_requirement_kind/product_class, eligibility_rule, operational_window_rule, booster_rule, source_refs_by_field, snapshot_template, allows_agenda_auto e executionProductPolicy. O marcador semântico class_scheme vive no JSON existente, sem novo status persistido. Um helper valida a variante e outro emite evidência factual de compatibilidade; o motor de planejamento continua único. Sem nova tabela, operação sync, UI, alteração de Agenda ou Evento existente.

A migration local `20261020232807_sanitario_class_scheme_planning_v2.sql` altera somente três funções curatoriais existentes. Mantém autenticação, escopo, CAS, replay, auditoria, fontes/coberturas, guards de aftosa/raiva e a restrição de LEP2 v1. Nenhuma linha de catálogo é atualizada por ela. Não foi aplicada remotamente.

## Previews prontos para autorização da proposta

As cinco candidatas abaixo têm UUID proposto, versão nova, status=draft e allows_agenda_auto=false. Preservam o ID/versionamento anterior e a chave lógica; não são decisões já publicadas.

| Preview | Nova identidade proposta | Chave preservada | Janela/recorrência |
|---|---|---|---|
| R04B-01 | `0625eedf-f069-5ee4-ae50-decd329176e6` v3 | `clostridial_primovac_dose1` | {"type":"hybrid","anchor":"manual_context"}; {"tolerance":null,"recurrenceRule":{"kind":"primovaccination_dose_1"}} |
| R04B-02 | `cb8fad2f-5836-5939-a64f-ce6a323acd1c` v4 | `clostridial_primovac_dose2` | {"type":"relative","anchor":"previous_dose","max_offset_days":42,"min_offset_days":28}; {"tolerance":null,"recurrenceRule":{"kind":"primovaccination_dose_2"},"previous_logical_item_key":"clostridial_primovac_dose1"} |
| R04B-03 | `d4a9602e-b011-5b33-a1c9-890b36da1b46` v3 | `clostridial_reforco_anual` | {"type":"relative","anchor":"last_execution"}; {"recurrenceRule":{"kind":"annual"},"tolerance":{"days":0},"previous_logical_item_key":"clostridial_primovac_dose2"} |
| R04B-08 | `d69c754c-1d61-5680-abfe-92fc1d43209b` v3 | `lepto_primovac_dose1` | {"type":"hybrid","anchor":"manual_context"}; {"tolerance":null,"recurrenceRule":{"kind":"primovaccination_dose_1"}} |
| R04B-10 | `f3122e73-549d-594a-aed6-5dd4ab93c0d9` v3 | `lepto_reforco_anual_semestral` | {"type":"relative","anchor":"last_execution"}; {"recurrenceRule":{"kind":"annual"},"tolerance":{"days":0},"previous_logical_item_key":"lepto_primovac_dose1"} |

Os aceites de consulta/manual/informação são 04, 05 e 11–13, sem nova versão automatizável. IBR1/2 não têm versão candidata. LEP2 tem proposta explícita de manutenção do bloqueio.

O pacote reutiliza duas fontes existentes e propõe oito coberturas de variante (quatro por fonte). Coberturas de janela são compartilhadas pelas etapas da mesma série para comparar fatos compatíveis. Propõe revisão das classes clostridial/leptospirose, mantendo can_validate_execution=false e automation_status=manual_only: revisar a taxonomia não aprova aplicação nem todos os produtos.

O produto comercial só é selecionado na execução. Outra marca só pode usar a variante se houver prova explícita de compatibilidade e vínculo técnico cadastrado; pertencer à classe não basta. A bula Fortress não se torna prova de outra marca por conveniência. As propostas de vínculo às fontes se limitam aos respectivos produtos de referência.

**Nenhuma candidata está pronta para decisão direta na RPC remota atual.** A sequência autorizável é preparação/publicação canônica versionada, revisão explícita das classes/coberturas, preview autenticado e decisão específica com o digest real daquele conteúdo. Os IDs das cinco candidatas e a justificativa são revisáveis agora; actor, assinatura e digest remoto não foram fabricados. Não reaplicar o seed antigo sobre os sete aprovados. Na conclusão R04B.1, o CLI público fixava payload e contagens de 20 itens. A [R04B.2](SANITARIO_V2_R04B2_CERTIFICACAO_20261021.md) prepara e valida localmente a opção incremental no mesmo publicador, sem writer alternativo ou bypass; publicação e decisões remotas continuam não executadas.

## Validação e integridade

- 193 testes focados em nove arquivos passaram no estado final, cobrindo janelas, regras legadas, materialização real de classe sem marca, automação, fila/retry e isolamento.
- PostgreSQL descartável: 13 cenários passaram com roles/RLS, CAS, concorrência, auditoria, digest e replay; migrações locais instaladas apenas em container novo descartável. As cinco candidatas reais também obtiveram preview sem bloqueios e decisão de teste exclusivamente nesse banco descartável, preservando integralmente os sete aprovados originais. Treze itens aprovados nesse banco são sete originais + um sintético de contrato + cinco candidatas; zero aprovações reais. [Evidência PostgreSQL persistida](evidence/SANITARIO_V2_R04B_CLASS_POSTGRES_20261021.json).
- Lint dos arquivos de runtime/testes alterados passou. Build Vite `--mode development` passou; aviso de chunks >500 kB. Endpoints e chave placeholder exclusivamente locais no processo, sem instalação ou mudança de configuração.
- O primeiro build production foi recusado pelo guard por apontar para localhost; não se contornou esse guard. O pnpm recusou node_modules compartilhado; comandos foram executados diretamente pelos binários existentes, sem reinstalar dependências.
- TSC instalado é 5.8.3 e tsconfig usa ignoreDeprecations=6.0; com override 5.0 foram observadas 391 linhas de diagnósticos, sem menção aos arquivos alterados. A origem de cada diagnóstico não foi reavaliada contra HEAD. Não se declara typecheck global aprovado.
- O baseline funcional geral recusou execução sem banco explicitamente descartável. Não se marcou o banco local existente como descartável. A validação PostgreSQL acima executou os contratos afetados num banco novo e removido ao final.
- O normalizador/validador canônico existente aceitou as cinco candidatas e oito coberturas combinadas em memória ao payload de referência. Isso comprova contrato estrutural, não importação nem aprovação. Fonte remota de verdade continua intacta.
- Comparação deepStrictEqual: 20 itens e 10 protocolos iguais ao baseline; sete Agendas iguais ao snapshot final R05. Consulta final: cinco decisões anteriores, sete itens aprovados, zero Eventos R05, gates OFF. O arquivo de evidência conserva as linhas completas e a observação temporal.

Não houve aprovação, importação, migration remota, deploy, push, merge ou repetição da R05. A homologação incremental remota e qualquer decisão do proprietário continuam pendentes de autorização específica.

## Fechamento do verification gate local

**READY WITH CAVEAT**, limitado ao patch e aos previews locais. Foram revisados diff tracked, staged (vazio) e todos os arquivos novos: domínio/execução/histórico/janelas, testes, migration de três funções, documentação e evidências. Nenhuma mudança em UI, schema de tabelas, sync-batch, configuração de rollout ou evidências originais R05. A mudança transitória da CLI foi restaurada no worktree desta tarefa; a alteração preexistente no outro worktree foi preservada.

Comandos observados, via binários existentes por causa do node_modules compartilhado:

- `node node_modules/vitest/vitest.mjs run` com os nove arquivos de agenda/janelas/precheck/histórico/execução indicados na evidência: **193/193**.
- `node tests/codex/sanitario-v2-review.postgres.mjs`: **13/13**, container próprio removido, RLS/roles reais e claims de transporte simulados.
- `node node_modules/eslint/bin/eslint.js` nos 13 arquivos TypeScript/JavaScript alterados: exit 0.
- `node node_modules/vite/bin/vite.js build --mode development`: exit 0, 17,34 s, aviso de chunks >500 kB; sem deploy.
- `git diff --check`: exit 0. JSONs parseados; IDs/coberturas/flags e igualdade integral das linhas de preservação conferidos por assertions.

Validações não certificadas: typecheck global; build production com configuração real; baseline funcional geral (guard de banco descartável); homologação remota incremental e nova sessão autenticada de preview/decisão remota (sem autorização). O PostgreSQL isolado validou as funções e candidatas afetadas, mas não substitui homologação de browser/transporte remoto.

Pendências reais: (1) elegibilidade específica IBR/BVD e variantes regionais de raiva, com LEP2/aftosa mantidas nos limites descritos; (2) autorização específica e preparação canônica compatível para publicação, contrato remoto e decisões das cinco candidatas; (3) compatibilizar o ambiente de typecheck e executar a homologação incremental autorizada antes de liberação operacional. Nenhuma dessas pendências autoriza ativar gates ou alterar as sete Agendas existentes.
