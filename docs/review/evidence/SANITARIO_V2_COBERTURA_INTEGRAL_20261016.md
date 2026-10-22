# Sanitário V2 — cobertura funcional dos 20 itens normalizados

Atualizado em: 2026-10-16
Baseline: `695d5cbb91af27b90a57c0131203ce2db8fe4ee1`; main remota confirmada na abertura `1a3ee9e3a540492e6b4ac840b0c62c890db36f7a`. Durante a verificação final, a main avançou para `b38b7368acec160c2c7a4a14ed745fe47978a8cc` pelo PR #209 (AnimalNovo/registro/atomicidade comercial), sem sobreposição com este patch sanitário. Nenhum merge/rebase foi executado.

## Resultado observado

Classificação do verification gate: **READY para o mecanismo e a homologação local com fixtures**, com 22 arquivos revisados (tracked, staged e novos), escopo preservado e nenhum bloqueador local. Aprovação operacional, integração na main que avançou durante o trabalho e homologação multidispositivo continuam pendentes; essa classificação não certifica o ambiente remoto.

- 10 protocolos / 20 itens canônicos classificados e testados diretamente a partir do payload 12F10; nenhuma alteração desse payload.
- 14 itens com geração automática demonstrada em **fixtures sintéticas explicitamente aprovadas**. A aprovação de teste não se transfere ao catálogo operacional.
- 3 itens de raiva: `SUGESTAO_CONDICIONAL`, preservando `no_agenda_auto`.
- 3 bloqueios específicos: leptospirose dose 2 da referência bovina atual e os 2 itens de aftosa.
- Autorizações canônicas efetivas: **0/20**, pois todas as flags continuam falsas. Os 14 casos de sucesso local estão `AGUARDANDO_APROVACAO_VERSIONADA` no catálogo real.

Regra normalizada, fundamento técnico, autorização versionada e animal elegível são etapas distintas. A matriz CSV registra separadamente identificação/versão, fonte e campo registrado, cenário elegível e inelegível, histórico, tipo de Agenda da fixture, autorização canônica, teste e condição concreta de promoção.

## Matriz resumida

| Item canônico | Versão | Resultado local | Autorização canônica | Pendência específica |
|---|---:|---|---|---|
| `b19_femeas_3_8_meses` | 2 | `AUTOMATICO_TESTADO_LOCALMENTE` | Não | Aprovar nova versão de avaliação genérica; mapear elegibilidade/janela/requisito de produto para SRC_MAPA_IN_10_2017_PNCEBT e restrições Portaria 1.633/2026/CIDASC. Não declarar vacinação obrigatória em UF risco A. |
| `clostridial_primovac_dose1` | 1 | `AUTOMATICO_TESTADO_LOCALMENTE` | Não | Vincular produto comercial e espécie/idade elegíveis; registrar cobertura operacional de elegibilidade, janela, dose, via e requisito de produto. Aprovar item/versionamento específico para a formulação. |
| `clostridial_primovac_dose2` | 2 | `AUTOMATICO_TESTADO_LOCALMENTE` | Não | Vincular produto comercial e espécie/idade elegíveis; registrar cobertura operacional de elegibilidade, janela, dose, via e requisito de produto. Aprovar item/versionamento específico para a formulação. |
| `clostridial_reforco_anual` | 1 | `AUTOMATICO_TESTADO_LOCALMENTE` | Não | Vincular produto comercial e espécie/idade elegíveis; registrar cobertura operacional de elegibilidade, janela, dose, via e requisito de produto. Aprovar item/versionamento específico para a formulação. |
| `raiva_primovac_dose1` | 1 | `SUGESTAO_CONDICIONAL` | Não | Os três itens exigem revisão técnica aprovada e versionada de no_agenda_auto antes de qualquer automação. Não basta declarar área de risco. |
| `raiva_primovac_reforco_30d` | 1 | `SUGESTAO_CONDICIONAL` | Não | Os três itens exigem revisão técnica aprovada e versionada de no_agenda_auto antes de qualquer automação. Não basta declarar área de risco. |
| `raiva_reforco_anual_area_risco` | 1 | `SUGESTAO_CONDICIONAL` | Não | Os três itens exigem revisão técnica aprovada e versionada de no_agenda_auto antes de qualquer automação. Não basta declarar área de risco. |
| `lepto_primovac_dose1` | 1 | `AUTOMATICO_TESTADO_LOCALMENTE` | Não | Dose 1: vincular formulação, contexto e cobertura de campos. Reforço: comprovar recorrência própria do produto. Dose 2: apenas outra variante com bula, produto, intervalo e aprovação próprios. |
| `lepto_primovac_dose2` | 1 | `BLOQUEIO_TECNICO_ESPECIFICO` | Não | Dose 1: vincular formulação, contexto e cobertura de campos. Reforço: comprovar recorrência própria do produto. Dose 2: apenas outra variante com bula, produto, intervalo e aprovação próprios. |
| `lepto_reforco_anual_semestral` | 1 | `AUTOMATICO_TESTADO_LOCALMENTE` | Não | Dose 1: vincular formulação, contexto e cobertura de campos. Reforço: comprovar recorrência própria do produto. Dose 2: apenas outra variante com bula, produto, intervalo e aprovação próprios. |
| `ibr_bvd_primovac_dose1` | 1 | `AUTOMATICO_TESTADO_LOCALMENTE` | Não | Resolver a classificação da fonte completa/bula e vincular formulação, espécie e campos de esquema na nova versão. Não transferir intervalo entre produtos. |
| `ibr_bvd_primovac_dose2` | 2 | `AUTOMATICO_TESTADO_LOCALMENTE` | Não | Resolver a classificação da fonte completa/bula e vincular formulação, espécie e campos de esquema na nova versão. Não transferir intervalo entre produtos. |
| `fmd_historico_contingencia` | 1 | `BLOQUEIO_TECNICO_ESPECIFICO` | Não | Nenhuma promoção operacional de vacinação de rotina. Contingência exigiria alteração normativa e fluxo oficial próprio, fora do escopo. |
| `fmd_bloqueio_vacinacao_rotina` | 1 | `BLOQUEIO_TECNICO_ESPECIFICO` | Não | Nenhuma promoção operacional de vacinação de rotina. Contingência exigiria alteração normativa e fluxo oficial próprio, fora do escopo. |
| `recria_maio` | 1 | `AUTOMATICO_TESTADO_LOCALMENTE` | Não | Aprovação técnica por campo e escopo regional/sistema adotado; fonte responsável aplicável à fazenda. Nenhum princípio ativo, dose, via ou carência pode ser escolhido pelo calendário. |
| `recria_julho` | 1 | `AUTOMATICO_TESTADO_LOCALMENTE` | Não | Aprovação técnica por campo e escopo regional/sistema adotado; fonte responsável aplicável à fazenda. Nenhum princípio ativo, dose, via ou carência pode ser escolhido pelo calendário. |
| `recria_setembro` | 1 | `AUTOMATICO_TESTADO_LOCALMENTE` | Não | Aprovação técnica por campo e escopo regional/sistema adotado; fonte responsável aplicável à fazenda. Nenhum princípio ativo, dose, via ou carência pode ser escolhido pelo calendário. |
| `pre_desmama_situacional` | 1 | `AUTOMATICO_TESTADO_LOCALMENTE` | Não | Aprovar avaliação/manejo situacional em versão própria com indicação do sistema/MV e campos de elegibilidade/janela/requisito de produto. Produto continua desconhecido na avaliação genérica. |
| `pre_confinamento_dose_unica` | 1 | `AUTOMATICO_TESTADO_LOCALMENTE` | Não | Aprovar avaliação contextual por versão e fonte aplicável ao manejo. Identificar intenção de entrada e revisar produto/carência antes de execução. |
| `matrizes_pre_parto_antiparasitario` | 1 | `AUTOMATICO_TESTADO_LOCALMENTE` | Não | Aprovar avaliação contextual com indicação definida; intervenção farmacológica exige bula/decisão MV e produto próprio. Data programada não é prova de gestação ou parto. |

## Evidência técnica e promoção específica

A [matriz CSV completa](SANITARIO_V2_MATRIZ_AUTOMACAO_20_ITENS_20261016.csv) contém as condições por item. O [registro de propostas](SANITARIO_V2_PROMOCOES_PREPARADAS_20261016.json) prepara separadamente a próxima versão de B19 genérica e as três etapas de clostridioses, com os registros de coverage já existentes. É revisão de decisão e vínculo de campos/produto; não exige liberar os demais protocolos e não efetiva aprovação, importação ou flag.

B19 tem fonte normativa primária forte já cadastrada. Clostridioses tem dose, via, intervalo 4–6 semanas e reforço anual fortes para FORTRESS7; o vínculo comercial e os campos de elegibilidade ainda não autorizam generalizar a classe. LEPTOFERM5 sustenta dose inicial única bovina; a variante sintética de dose 2 foi testada sem modificar a referência bloqueada. IBR/BVD dispõe de coverage registrado, mas as fontes do cadastro permanecem apoio/PRECISA_VALIDAR. Os itens parasitários/contextuais não convertem uma guideline de apoio em autorização crítica: precisam de fonte/decisão responsável aplicável à região, manejo e escopo da tarefa.

## Demonstração funcional

A fixture Chromium `?integral` usa o mesmo payload normalizado, 4 animais sintéticos e 4 Eventos históricos de entrada. O produtor ativa uma única vez um plano com 14 regras e contextos por item. Em julho, **12 itens aplicáveis** geram intenções de vários protocolos; maio e setembro são avaliados separadamente nos meses correspondentes. O teste verifica os 20 itens na interface, as 3 sugestões de raiva e os 3 bloqueios, identidades sem duplicação, reavaliação offline, recarga, reconnect e farm-switch. O planejamento mantém exatamente os 4 fatos de entrada e zero consumo de estoque.

## Validação

- `pnpm exec vitest run` com 9 arquivos diretamente afetados: **192/192 PASS**, incluindo **53/53** da matriz integral e **18/18** do plano/concorrência/rollback.
- Chromium: **5/5 PASS**, incluindo a demonstração integral. Lint e build: PASS; build mantém aviso de chunks grandes/Browserslist. Fallow `--base origin/main --gate new-only`: zero achados introduzidos. TypeScript: os mesmos 240 diagnósticos herdados, comparação normalizada por mensagem/arquivo sem novos diagnósticos.
- Reexecução final dos módulos de plano e matriz após versionar os contextos: **71/71 PASS** (53 da matriz + 18 do plano), incluindo leitura V1 e gravação V2.
- Testes novos também cobrem segunda dose de outro produto, segunda dose já executada sem Agenda local, variante aprovada de leptospirose, cancelamento por janela, recorrência em outro ano, alvos/data de manejo e pré-parto excluindo machos.

## Arquivos alterados

- [docs/domain/SANITARIO.md](../../../docs/domain/SANITARIO.md)
- [e2e/fixtures/sanitary-planning.tsx](../../../e2e/fixtures/sanitary-planning.tsx)
- [e2e/sanitary-planning.spec.ts](../../../e2e/sanitary-planning.spec.ts)
- [src/components/sanitario/SanitaryAutomaticPlanPanelV2.tsx](../../../src/components/sanitario/SanitaryAutomaticPlanPanelV2.tsx)
- [src/lib/sanitario/agenda/__tests__/sanitaryAutomaticGenerationV2.test.ts](../../../src/lib/sanitario/agenda/__tests__/sanitaryAutomaticGenerationV2.test.ts)
- [src/lib/sanitario/agenda/sanitaryAutomaticGenerationV2.ts](../../../src/lib/sanitario/agenda/sanitaryAutomaticGenerationV2.ts)
- [src/lib/sanitario/agenda/sanitaryAutomaticIdentityV2.ts](../../../src/lib/sanitario/agenda/sanitaryAutomaticIdentityV2.ts)
- [src/lib/sanitario/agenda/sanitaryAutomationPlanV2.ts](../../../src/lib/sanitario/agenda/sanitaryAutomationPlanV2.ts)
- [src/lib/sanitario/checks/sanitaryProtocolPrecheckV2.ts](../../../src/lib/sanitario/checks/sanitaryProtocolPrecheckV2.ts)
- [src/lib/sanitario/preview/sanitaryWindowPlanningPreviewV2.ts](../../../src/lib/sanitario/preview/sanitaryWindowPlanningPreviewV2.ts)
- [src/lib/sanitario/windows/__tests__/sanitaryProtocolWindowsV2.test.ts](../../../src/lib/sanitario/windows/__tests__/sanitaryProtocolWindowsV2.test.ts)
- [src/lib/sanitario/windows/sanitaryProtocolWindowsV2.ts](../../../src/lib/sanitario/windows/sanitaryProtocolWindowsV2.ts)
- [docs/review/evidence/SANITARIO_V2_COBERTURA_INTEGRAL_20261016.md](../../../docs/review/evidence/SANITARIO_V2_COBERTURA_INTEGRAL_20261016.md)
- [docs/review/evidence/SANITARIO_V2_MATRIZ_AUTOMACAO_20_ITENS_20261016.csv](../../../docs/review/evidence/SANITARIO_V2_MATRIZ_AUTOMACAO_20_ITENS_20261016.csv)
- [docs/review/evidence/SANITARIO_V2_PROMOCOES_PREPARADAS_20261016.json](../../../docs/review/evidence/SANITARIO_V2_PROMOCOES_PREPARADAS_20261016.json)
- [src/components/sanitario/SanitaryAutomationCoveragePanelV2.tsx](../../../src/components/sanitario/SanitaryAutomationCoveragePanelV2.tsx)
- [src/components/sanitario/SanitaryPlanContextFieldsV2.tsx](../../../src/components/sanitario/SanitaryPlanContextFieldsV2.tsx)
- [src/components/sanitario/SanitaryRuleContextEditorV2.tsx](../../../src/components/sanitario/SanitaryRuleContextEditorV2.tsx)
- [src/lib/sanitario/agenda/__tests__/fixtures/sanitaryNormalizedFixtureV2.ts](../../../src/lib/sanitario/agenda/__tests__/fixtures/sanitaryNormalizedFixtureV2.ts)
- [src/lib/sanitario/agenda/__tests__/sanitaryNormalizedAutomationV2.test.ts](../../../src/lib/sanitario/agenda/__tests__/sanitaryNormalizedAutomationV2.test.ts)
- [src/lib/sanitario/agenda/sanitaryAutomationReadinessV2.ts](../../../src/lib/sanitario/agenda/sanitaryAutomationReadinessV2.ts)
- [src/lib/sanitario/agenda/sanitaryContextualPlanningV2.ts](../../../src/lib/sanitario/agenda/sanitaryContextualPlanningV2.ts)

## Contratos e limites

Configuração continua no payload canônico da fazenda via gesture; planos V1 continuam legíveis. Contextos avançados usam schemaVersion 2, rejeitado por clientes antigos que aceitavam somente V1, preservando os novos guards sem regravar Agendas/gestures anteriores. Writers e snapshots anteriores são preservados. A automação usa o writer local de Agenda, não cria Eventos/estoque/carência e não habilita push. Agrupamento polivalente permanece informativo quando o contrato factual não permite persistir cobertura múltipla: bloqueia duas aplicações equivalentes.

Pendências reais: aprovação técnica versionada por item/escopo e vínculos de campo/produto identificados na matriz; integração/publicação autorizada; homologação da sincronização de Agendas e planos concorrentes entre dispositivos. Nenhum teste local prova essa convergência remota. Não houve push, merge, deploy, migration remota, importação ou alteração de flags operacionais.
