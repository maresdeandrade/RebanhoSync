# Sanitário V2 — evidência local A–E

Atualizado em: 2026-10-16
Baseline funcional: `e72bf5004fe2bf8d6a7052dc57ee1167f64ccb7e`
Branch: `codex/sanitario-v2-politica-ae`
Verificação: **READY WITH CAVEAT** — TypeScript global herdado; restrições externas não liberadas.

## Baseline e documentação

FATO CONFIRMADO: checkout original em `4be6723`, com mudanças concorrentes em .codex/config.toml, .fallowrc.json e tsconfig.node.json, preservadas. Worktree sanitária funcional limpa em e72bf50; criada worktree própria baseada nesse commit. ls-remote/fetch confirmou `origin/main@1a3ee9e3a540492e6b4ac840b0c62c890db36f7a`: correção posterior de sync não incorporada aqui. Não houve merge.

ZIP revisado localizado em Downloads, extraído temporariamente; LEIA_ME e aplicador inspecionados. --check mostrou 11 destinos e --apply concluiu: nove documentos atualizados e dois novos, sem duplicar adendos. CSV com 20 chaves únicas, todas allows_agenda_auto_payload=false. Payload canônico continua com 20 itens sem autorização automática. Fontes normativas são as do pacote; não foram pesquisadas novamente na internet nesta execução.

## Resultado por área

| Área | Implementado | Testado | Restrição residual |
|---|---|---|---|
| Raiva A | no_agenda_auto em limitations/snapshot prevalece sobre flag; alteração exige nova versão | Três chaves no domínio e writer | Nenhum item liberado automaticamente |
| Polivalentes B | Identidade comercial, composição/fontes, esquema e versões em grupos informativos; bloqueio de dupla intenção de aplicação compartilhada | Fertiguard sintético; produtos/fontes/janelas/doses distintas; writer sem escrita parcial | Agenda e detalhe factual têm uma única referência de item; cobertura factual múltipla não persistida |
| B19 C | UF obrigatória; SC bloqueada sem depender de metadata; espécie/sexo/idade; fato comprovado evita repetição; avaliação genérica sem produto | Elegível, inelegível, UF restrita/ausente, já executada, fixture aprovada offline | Não autoriza produto para bubalinos; não acrescenta cálculo de prazo estadual de comprovação |
| Tipos D | planningKind em JSON existente; callers manuais legados criam avaliação; esquema exige produto/formulação/dose/via/fontes e autorização por espécie/sexo/idade | Genérica sem produto/dose; catálogo não converte intenção; dose 2 exige fato do mesmo produto | Troca de tipo exige cancelar avaliação e realizar nova seleção, validação e confirmação |
| Rastreabilidade E | Pacote, matriz, fontes por campo no snapshot de planejamento, baseline e quatro findings reais | CSV/payload/diffs | Aprovações propostas permanecem propostas |
| Geração condicional | Modo na Central, demanda → preview → materialização → writer Dexie, revalidação transacional | Concorrência/clique duplo/retry, rollback, reabertura, offline/reconnect e farm-switch | Aprovação real por item/versão/fontes ainda necessária |
| Documentação | Pacote e notas posteriores normativas/evidências | gates:docs e diff --check | Não promove política em autorização |
| Fallow | Quatro findings introduzidos no baseline corrigidos; herdados preservados | new-only: exit 0 | Sem enfraquecer configuração ou adicionar supressões |

Planejamento permanece intenção: sem Evento, estoque, carência ativa ou fila remota. Stores/transações existentes preservadas; deduplicação persistente por animal/regra. Nenhuma migration, tabela, RPC, policy, seed, dependência ou flag alterada. Campos novos são opcionais em JSON; Agendas antigas permanecem legíveis. Conformidade histórica consulta bloqueios factuais, sem transformar ausência de aprovação prospectiva em ausência de execução.

O modelo canônico só oferece protocolo_id/protocol_item_version_id singulares por Agenda/detalhe factual. O grupo multiprotocolo é informativo e impede materialização ambígua; não inventa relação persistente nem duplica Eventos/baixas. Não certifica um Evento satisfazendo múltiplos protocolos.

## Validações observadas

Testes usaram endpoints/chave sintéticos locais, sem dados remotos.

| Comando/escopo | Evidência |
|---|---|
| pnpm test -- src/lib/sanitario src/components/sanitario/__tests__ src/pages/__tests__/ProtocolosSanitarios.test.tsx | 103 arquivos / 1169 testes executados: 1146 passaram e 23 falharam inicialmente. Não se alega resultado integral verde nessa execução |
| Teste compliance em e72bf50 | Mesmas 17 falhas reproduzidas no baseline, antes da correção da separação de capacidades |
| Reexecução dos cinco arquivos inicialmente falhos | 54/54 passaram após correção factual e UF explícita nas fixtures; assertions preservadas |
| Bateria posterior de política/janelas/versionamento/compliance/Central/painel | 89 passaram e uma fixture falhou por autorização de espécie ausente; fixture corrigida e janelas repetida com 29/29 aprovados |
| Bateria writer manual + janelas + preview manual | 56/56 passaram, incluindo default genérico dos callers legados |
| Pós-revisão: janelas + compliance | 49/49 passaram, incluindo escolha da versão exata entre itens com a mesma chave lógica |
| pnpm exec playwright test --config e2e/sanitary-planning.config.ts | Execução final: 3/3 Chromium passaram em 32,2 s. Cold start anterior expirou na navegação; não foi contado como aprovação |
| pnpm run lint | exit 0 |
| pnpm run build | exit 0; avisos de chunks >500 kB e Browserslist antigo |
| pnpm run gates:docs | exit 0 |
| pnpm exec fallow audit --base b7f475e589569a2d80843335dc7d60531c442e08 --gate new-only --format json | exit 0, zero findings introduzidos |
| pnpm exec tsc --noEmit -p tsconfig.app.json | exit 2; baseline e patch com 240 diagnósticos, comparados por arquivo/código/mensagem sem números de linha; nenhum novo |
| git diff --check | Sem erros na inspeção local |

Não executados: regressão global do repositório, banco/Edge/Postgres, homologação remota e kill físico/multi-device. Não houve mudança de contrato remoto. Reabertura é lógica/IndexedDB; não equivale a kill físico do dispositivo. Os resultados anteriores de 199 testes não foram usados como prova desta execução.

## Quatro findings Fallow reproduzidos

Logs não fornecem ID opaco individual; identidade verificável: regra + assinatura + arquivo/linha do baseline. [JSON com os findings originais completos e atribuição final](SANITARIO_V2_A_E_FALLOW_20261016.json).

| Regra | Assinatura | Arquivo no baseline | Linha |
|---|---|---|---|
| complexity/all | buildManualSanitaryAgendaRecordsV2 | src/lib/sanitario/agenda/sanitaryManualAgendaV2.ts | 206 |
| complexity/cognitive_crap | ProtocolosSanitarios | src/pages/ProtocolosSanitarios/index.tsx | 54 |
| complexity/cognitive_crap | callback de transação (arrow) | src/lib/sanitario/windows/sanitaryProtocolWindowsV2.ts | 595 |
| complexity/crap | callback de interceptação HTTP (arrow) | e2e/sanitary-planning.spec.ts | 12 |

Extrações limitadas a snapshots, revalidação/materialização, apresentação e interceptação sintética. Configuração Fallow intacta e nenhum novo ignore.

## Estados e homologação

- IMPLEMENTADO_LOCALMENTE: sim, com limite explícito de cobertura factual múltipla.
- TESTADO: escopo local acima, TypeScript global com ressalva herdada.
- APROVADO_PARA_AUTOMAÇÃO: não; os 20 itens candidatos permanecem sem flag; fixtures são exclusivamente testes.
- PUBLICADO: não.
- SINCRONIZADO_REMOTAMENTE: não.

Próximo passo: revisão/aprovação técnica por item/versão/campo e contexto da fazenda; integrar a main atual e confirmar backend de homologação isolado. Importação, flags e publicação exigem autorização específica. Raiva mantém no_agenda_auto; aftosa permanece retirada/bloqueada; leptospirose dose 2 mantém bloqueio canônico até revisão de variante. Cobertura factual múltipla exige contrato próprio aprovado. O pacote informa uso do backend apelidado staging pela aplicação de produção; não foi acessado.

## Arquivos do patch

- `docs/architecture/OPERATIONAL_FLOWS.md`
- `docs/domain/SANITARIO.md`
- `docs/review/SANITARIO_V2_CONTENT_CURATION_C0_1_INVENTORY.md`
- `docs/review/SANITARIO_V2_POLITICA_AGENDA_CONDICIONAL_20261015.md`
- `docs/review/SANITARIO_V2_TECHNICAL_VALIDATION_QUEUE.md`
- `docs/review/evidence/MATRIZ_ITENS_PROTOCOLO_SANITARIO_V2.md`
- `docs/review/evidence/MATRIZ_PROTOCOLOS_SANITARIOS_CANDIDATOS_V2.md`
- `docs/review/evidence/PROTOCOLO_ITENS_NORMALIZADOS_12F1.md`
- `docs/review/evidence/SANITARIO_PROTOCOLS_V2_DECISION_RECORD_12F10.md`
- `docs/review/evidence/SANITARIO_V2_A_E_FALLOW_20261016.json`
- `docs/review/evidence/SANITARIO_V2_A_E_IMPLEMENTACAO_LOCAL_20261016.md`
- `docs/review/evidence/SANITARIO_V2_MATRIZ_DECISAO_AGENDA_20261015.csv`
- `docs/review/evidence/SANITARIO_V2_RESEARCH_REMEDIATION_20261014.md`
- `e2e/fixtures/sanitary-planning.tsx`
- `e2e/sanitary-planning.spec.ts`
- `src/components/sanitario/SanitaryProtocolWindowPanelV2.tsx`
- `src/components/sanitario/__tests__/SanitaryAnimalSummaryPanelV2.test.tsx`
- `src/components/sanitario/__tests__/SanitaryLotSummaryPanelV2.test.tsx`
- `src/components/sanitario/__tests__/SanitaryManualPreviewV2.test.tsx`
- `src/components/sanitario/__tests__/SanitaryPrecheckPanelV2.test.tsx`
- `src/components/sanitario/__tests__/SanitaryProtocolWindowPanelV2.test.tsx`
- `src/lib/sanitario/agenda/__tests__/sanitaryManualAgendaV2.test.ts`
- `src/lib/sanitario/agenda/__tests__/sanitaryPlanningPolicyV2.test.ts`
- `src/lib/sanitario/agenda/sanitaryManualAgendaV2.ts`
- `src/lib/sanitario/agenda/sanitaryPlanningPolicyV2.ts`
- `src/lib/sanitario/checks/__tests__/sanitaryProtocolPrecheckV2.test.ts`
- `src/lib/sanitario/checks/sanitaryProtocolPrecheckV2.ts`
- `src/lib/sanitario/compliance/__tests__/sanitaryComplianceV2.test.ts`
- `src/lib/sanitario/compliance/sanitaryComplianceV2.ts`
- `src/lib/sanitario/execution/sanitaryProtocolExecutionAuthorizationV2.ts`
- `src/lib/sanitario/preview/sanitaryMultiProtocolPlanningV2.ts`
- `src/lib/sanitario/preview/sanitaryWindowPlanningPreviewV2.ts`
- `src/lib/sanitario/rules/__tests__/sanitaryProtocolV2.test.ts`
- `src/lib/sanitario/rules/sanitaryProtocolV2.ts`
- `src/lib/sanitario/windows/__tests__/sanitaryProtocolWindowsV2.test.ts`
- `src/lib/sanitario/windows/sanitaryProtocolWindowsV2.ts`
- `src/pages/ProtocolosSanitarios/index.tsx`
- `src/pages/__tests__/ProtocolosSanitarios.test.tsx`
