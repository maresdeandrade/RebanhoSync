# Sanitário V2 — VF2: catálogo homologado e planejamento manual

Data: 23/10/2026. **Estado final: VALIDATED_WITH_CAVEATS.** Os cinco cenários funcionais VF2 passaram; a checagem TypeScript do projeto E2E permanece com diagnósticos fora dos arquivos desta entrega. Esta conclusão não declara prontidão para produção.

## Baseline real e limites

- Branch reutilizada: `codex/sanitario-v2-functional-validation`.
- HEAD: `4b43fc10ec9dfd0c19527c22c4d725799d9e7969`, merge do PR #239.
- A entrega da primeira rodada, inclusive testes, relatório e capturas, foi preservada. Alterações concorrentes de governança, reprodução, importador, fazenda de teste e evidências F6–F9/UI_STRUCT não pertencem à VF2 e não foram sobrescritas.
- Não foi criado outro worktree. Outros worktrees existentes não foram utilizados.
- Backend de referência consultado somente por SELECT no projeto `zqloazqzhwauamcejmuz`. Dados exportados: catálogo global, fontes, coberturas, grupos e membros globais; gates somente como contagens agregadas. Nenhum animal, Agenda ou Evento remoto foi lido ou criado.
- Gates observados: um registro, zero habilitados. Nenhuma aprovação, gate, migration, bootstrap ou deploy foi alterado. Sem push ou merge.
- Chromium, páginas e serviços reais, IndexedDB real, identidade/HTTP sintéticos restritos a localhost. Relógio da fixture: 04/07/2026; datas factuais dos reforços são dados sintéticos explícitos. Não há validação de sessão real, backend operacional ou aplicativo publicado.

## Origem dos dados e divergências corrigidas na fixture

A nova entrada `?homologado` reutiliza o shell `e2e/fixtures/sanitary-planning.tsx` e o helper de dados já existente. Carrega o snapshot somente leitura em `evidence/SANITARIO_V2_VF2_CATALOG_READONLY_20261023.json`; o SQL da captura está versionado ao lado. Esse arquivo é evidência derivada do remoto para testes, não publicador nem fonte canônica concorrente.

| Representação anterior | Representação VF2 |
|---|---|
| Aprovações e fontes fortes sintéticas, incrementando versões dos itens normalizados | Linhas exportadas sem promover estados, alterar IDs, versões, regras ou metadata |
| 20 itens normalizados e três produtos fictícios | 32 versões físicas: 19 ativas, 10 retiradas, três draft; produtos sintéticos removidos do modo homologado |
| Aftosa recebia `approved` sintético, embora retirada | `retired/draft`, conforme o remoto |
| Referências e IDs de cobertura de teste | 18 fontes globais, 91 coberturas, quatro grupos e 12 membros exportados |
| Raiva baseada no payload anterior à homologação manual | Três versões 2 homologadas, `manual_planning`, `allows_agenda_auto=false` e `no_agenda_auto` preservados |

Os 12 itens do manifesto `SANITARIO_V2_INITIAL_BOOTSTRAP_20261022.json` foram confrontados por ID, chave lógica e versão, além da existência das fontes e dos vínculos de cobertura. As linhas de protocolos/itens persistidas na fixture foram comparadas integralmente com o snapshot. As sete etapas ativas anteriores também permanecem na entrada; não se confundem com os 12 itens do bootstrap.

| Família do bootstrap | Versões homologadas verificadas |
|---|---|
| Clostridioses | dose 1 v3, dose 2 v4, reforço anual v3 |
| Leptospirose | dose 1 v3, reforço anual/semestral v3 |
| IBR/BVD | dose 1 v3, dose 2 v4; variantes V4J5 de dose 1/dose 2 v1 |
| Raiva | primovacinação v2, reforço de 30 dias v2, reforço anual v2 |

Versões retiradas e variantes incompletas permanecem no snapshot como evidência, sem liberação operacional fabricada. O teste dos 15 casos passou a contar restrições correntes sem duplicar as versões históricas de raiva; continua exigindo as seis restrições, todas sem automação.

## Matriz funcional executada

Todos os PASS abaixo correspondem a execução observada; nenhuma linha foi aprovada apenas por leitura de código.

| Cenário | Resultado | Evidência |
|---|---|---|
| Snapshot representa os 12 itens do bootstrap | PASS | IDs/versões/status confrontados com manifesto; fontes e coberturas resolvidas; IndexedDB conserva protocolos e itens integralmente |
| Consulta das nove famílias aprovadas | PASS | Navegação pelos nove protocolos na tela real do catálogo, com dados exportados |
| Versões, títulos de fontes, IDs de cobertura e limitações dos 12 itens | PASS após correção | Detalhes expandidos e asserções por item/versão no Chromium |
| Aftosa não autoriza operação | PASS | Ausência na escolha automática; seleção informativa da etapa não habilita animal nem seleção coletiva |
| Variante incompleta `lepto_primovac_dose2` não é liberada | PASS | Seleção informativa da variante permanece sem alvo selecionável |
| Raiva não ganha elegibilidade automática | PASS | Não aparece entre escolhas automáticas; mudança explícita para modo automático bloqueia a seleção |
| Nascimento ausente | PASS | Animal antes selecionável fica bloqueado ao remover a data no IndexedDB sintético; nenhuma intenção/fato gravado |
| Raiva — primovacinação manual, com dados regionais ausentes | PASS | Item homologado v2; UF ausente; revisão exibe cobertura regional não comprovada; confirmação cria uma Agenda e zero Eventos |
| Raiva — reforço de 30 dias | PASS | Sem Evento anterior fica bloqueado. Evento sintético compatível de 04/06/2026 habilita planejamento em 04/07/2026; Agenda não cria outro Evento |
| Raiva — reforço anual condicionado ao contexto declarado | PASS | Sem histórico fica bloqueado. Evento sintético da etapa anterior em 04/07/2025, com compatibilidade de classe documentada, e área de risco declarada permitem planejamento manual em 04/07/2026 |
| Contexto regional não vira obrigação individual | PASS | Para DF, a revisão informa regra regional identificada e explicita que isso não comprova obrigação individual. Nenhuma inferência de foco/perifoco foi criada |
| Associação e persistência dos três planejamentos de raiva | PASS | Agenda referencia fazenda, item físico homologado e animal `adult`; snapshot `generationMode=manual`, sem Evento de execução; reload preserva os dados |
| Os 15 testes antes ignorados | PASS | 15 executados, zero ignorados, com `SANITARIO_APPROVED_CATALOG` apontando para o snapshot capturado |
| Compatibilidade da tela de catálogo alterada | PASS | 13 testes existentes do componente aprovados |
| Lint dos cinco arquivos de código VF2 | PASS | ESLint focado, saída 0 |
| TypeScript do projeto E2E | FAIL fora dos arquivos VF2 | 38 diagnósticos em 11 arquivos sem alteração nesta entrega; nenhum diagnóstico restante nos arquivos VF2 |
| Sessão expirada, resposta atrasada em farm-switch e kill/restart | NOT_RUN | Fora do escopo VF2; recomendados para VF3 |
| Frontend publicado e convergência com backend real | NOT_RUN | Esta rodada usa ambiente local; não houve deploy nem envio operacional remoto |

Não houve BLOCKED por indisponibilidade do ambiente. Os testes de reforço incluem somente fatos sintéticos anteriores: o Evento preexistente continua sendo um após a confirmação da Agenda. Não houve execução sanitária, consumo de estoque ou carência ativa gerados pelo planejamento.

## Bug demonstrado e correção

**MEDIUM — rastreabilidade na consulta:** o catálogo carregava versões e referências por campo, mas o detalhe apresentado ao usuário não mostrava a versão do item/protocolo nem as fontes/coberturas. A expectativa `Versão do item` falhou no navegador antes da correção. O detalhe anterior terminava em chave técnica, requisito, classe, automação e limitações.

Patch mínimo em `src/pages/SanitarioCatalogoV2.tsx`:

- versões do protocolo e item nos detalhes;
- fontes por campo com título, estado de evidência, referência e IDs de cobertura quando informados;
- estado explícito para ausência de fontes;
- identificação semântica de cada cartão por chave e versão.

O teste final verifica esses dados nos 12 itens homologados. Nenhuma regra sanitária, autorização, cálculo de elegibilidade, writer ou fluxo operacional foi alterado.

As falhas intermediárias dos testes de raiva eram expectativas incorretas: modo de geração pertence a `protocol_item_snapshot`, e o overlay de DF é compatível com a data simulada. Foram corrigidas as asserções, preservando os contratos reais. O fluxo manual existente completou os três cenários; não foi necessário criar implementação paralela.

## Arquivos desta entrega

- `e2e/fixtures/sanitary-planning.tsx`: modo homologado no shell existente, preservando modos da primeira rodada.
- `e2e/sanitary-planning.spec.ts`: cinco cenários VF2 e helpers locais de interação, sem duplicar servidor/auth/HTTP.
- `src/lib/sanitario/agenda/__tests__/fixtures/sanitaryNormalizedFixtureV2.ts`: helper compartilhado para carregar publicação/evidência sem mudar aprovações.
- `src/lib/sanitario/agenda/__tests__/sanitaryPublishedCatalogV2.test.ts`: reutilização do helper e distinção entre versões históricas/correntes na contagem de restrições.
- `src/pages/SanitarioCatalogoV2.tsx`: apresentação técnica corrigida.
- Este relatório e quatro artefatos VF2 em `docs/review/evidence/`: snapshot JSON, SELECT SQL, resultado JSON e captura PNG.

## Validações e evidências

Comandos executados:

```powershell
$env:SANITARIO_APPROVED_CATALOG = (Resolve-Path 'docs/review/evidence/SANITARIO_V2_VF2_CATALOG_READONLY_20261023.json').Path
pnpm test -- src/lib/sanitario/agenda/__tests__/sanitaryPublishedCatalogV2.test.ts
# 15 aprovados, zero ignorados

pnpm exec playwright test --config e2e/sanitary-planning.config.ts --grep VF2 --reporter=json
# Primeira execução: catálogo e restrições passaram; três casos de raiva falharam por expectativas dos testes.
pnpm exec playwright test --config e2e/sanitary-planning.config.ts --grep 'VF2 raiva' --reporter=json
# Três casos corrigidos aprovados, sem alteração do fluxo de produção.
pnpm exec playwright test --config e2e/sanitary-planning.config.ts --grep 'VF2 catálogo' --reporter=json
# Um caso aprovado após adicionar asserções de cobertura e ajustar a tipagem do teste.

pnpm test -- src/pages/__tests__/SanitarioCatalogoV2.test.tsx
# 13 aprovados
pnpm exec eslint e2e/sanitary-planning.spec.ts e2e/fixtures/sanitary-planning.tsx src/lib/sanitario/agenda/__tests__/fixtures/sanitaryNormalizedFixtureV2.ts src/lib/sanitario/agenda/__tests__/sanitaryPublishedCatalogV2.test.ts src/pages/SanitarioCatalogoV2.tsx
# Saída 0
pnpm exec tsc --noEmit --project e2e/tsconfig.json
# Saída 1; após corrigir três diagnósticos novos no teste, restam 38 fora dos arquivos VF2.
git diff --check
# Sem diagnóstico
```

O TypeScript alcançou módulos importados de animais, eventos comerciais, insights, offline/sync, reprodução, biossegurança e simulação, além de outro teste E2E. Esses arquivos não foram alterados por esta entrega; não foi executado checkout isolado para revalidar temporalmente o baseline desses diagnósticos. Não foram mascarados nem corrigidos fora do escopo.

Não foram repetidos os oito cenários completos da primeira rodada, os 224 testes anteriores, build global, lint global ou bootstrap. Os testes afetados foram repetidos somente após mudanças nas respectivas asserções/tipagem/cobertura. Não houve revisão independente por outro agente.

- [Snapshot remoto somente leitura](evidence/SANITARIO_V2_VF2_CATALOG_READONLY_20261023.json).
- [Consulta usada na captura](evidence/SANITARIO_V2_VF2_CATALOG_READONLY_20261023.sql).
- [Resultados consolidados e hash do snapshot](evidence/SANITARIO_V2_VF2_FUNCTIONAL_RESULT_20261023.json).
- [Detalhe homologado de raiva v2](evidence/SANITARIO_V2_VF2_RAIVA_CATALOGO_20261023.png), inspecionado visualmente.

Os cinco cenários distintos de navegador passaram em suas últimas execuções; reexecuções não são contadas como cenários adicionais. As saídas brutas estão em `scratch/sanitary-vf2-*.json` e `scratch/sanitary-vf2-*.log`, ignoradas pelo Git.

## Conclusão e VF3

**VALIDATED_WITH_CAVEATS:** as lacunas funcionais de catálogo homologado e planejamento manual desta VF2 foram fechadas no ambiente local. O patch recebe **READY WITH CAVEAT**, pela checagem TypeScript compartilhada ainda falhando fora dos arquivos da entrega. Isso não equivale a aprovação global do working tree concorrente nem a autorização de produção.

Pendências reais:

1. Diagnósticos TypeScript compartilhados precisam de triagem própria; a VF2 não afirma uma compilação tipada integral aprovada.
2. Sessão expirada, resposta atrasada durante farm-switch e encerramento/reabertura completa continuam sem execução nesta rodada.
3. Versão do frontend publicado e convergência operacional com backend real permanecem não confirmadas.

**Recomendação para VF3:** usar o mesmo modo homologado e dados sintéticos para testar expiração/recuperação de sessão, respostas atrasadas de outra fazenda e kill/restart seguido de reconexão. Caso seja necessário testar convergência remota, usar backend descartável explicitamente autorizado. Manter gates de produção OFF e verificar a versão publicada antes de qualquer proposta de ativação.
