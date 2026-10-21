# Sanitário V2 — simplificação da Central

Data: 2026-10-20. Branch: `codex/sanitario-v2-convergencia`.
Baseline local verificado: `9a4977bf1e8c932ea76714a43496bc779761fee0`; worktree inicialmente limpo.
Worktree: `C:/Users/mares/.codex/worktrees/sanitario-v2-convergencia/GestaoAgro`.

## Entradas confirmadas

- Curadoria global: `src/pages/Admin/index.tsx`, única montagem de `AdminSanitaryReviewTab`, em `/admin`; `src/App.tsx` aplica `RequireAuth` e `RequireSuperAdmin`.
- Meu Perfil: um botão administrativo condicionado a `isSuperAdmin`, com destino `/admin`. Não contém formulário curatorial. Nenhuma alteração funcional nesses arquivos.
- Central: `/protocolos-sanitarios`, com abas Janelas, Agenda, Histórico, Catálogo e Conformidade. O plano automático é montado somente nessa página.
- Catálogo consultivo: `/protocolos-sanitarios/catalogo-v2`, sem comandos de aprovação ou execução.
- Entradas para a Central preservadas: navegação lateral, Home, Dashboard, Agenda, Eventos, Configurações, detalhe do lote, relatórios, onboarding e links contextuais do domínio. Os filtros de animal/lote e os links da Agenda continuam existentes.
- `FarmProtocolManager` e `OfficialSanitaryPackManager` não têm montagens nas páginas ativas encontradas pela busca de referências TSX; não foram alterados.

## Alterações

O formulário automático começa recolhido. Abrir/fechar mantém o rascunho; a troca de fazenda descarta o rascunho da fazenda anterior. O hook existente de geração permanece montado e seus gatilhos não foram alterados.

As opções de ativação usam `sanitaryPlanningBlockersV2` e respeitam o escopo da fazenda já exigido pelo writer canônico. Seleções salvas com bloqueio ou versão indisponível permanecem identificadas para remoção explícita; não são migradas ou descartadas automaticamente. A desativação de um plano existente continua disponível.

O contexto geral é o padrão. Os campos específicos só são montados ao selecionar e expandir uma regra; abrir o ajuste não cria override. Alterar um campo cria o contexto próprio pelo contrato existente. “Usar contexto geral” remove esse override. Calendário regional, indicação pré-desmama e contexto programado continuam acessíveis, sem preenchimento ou adoção automática.

O formulário deixa de repetir a cobertura de todo o catálogo: regras pendentes, restrições e fontes permanecem no catálogo consultivo existente. A revisão manual mostra os cuidados técnicos em detalhes expansíveis, preservando os motivos por animal e as informações sobre intenção futura e execução.

## Evidências de custo e carregamento

Ensaio local com React Profiler e Testing Library/JSDOM, catálogo sintético com 20 regras e sem animais. Writers e transporte interceptados. As durações são observações de execuções distintas, não um benchmark de navegador ou de rede.

| Observação | Antes | Depois |
| --- | ---: | ---: |
| Selects montados na entrada do painel automático | 105 | 0 |
| Opções de ativação montadas na entrada | 20 | 0 |
| Chamadas ao preview na entrada | 1 | 0 |
| Profiler, soma de actualDuration na montagem | 104,75 ms | 8,33–14,62 ms nas repetições observadas |
| Avaliações documentais na entrada da Central | 1 | 0 |
| Avaliações documentais acumuladas ao abrir Histórico | 3 | 1 |
| Avaliações após digitar `B19` no Histórico | não medidas | 1 |

O gargalo demonstrado é trabalho de renderização e avaliação local desnecessário. As pendências agora são calculadas somente na aba Histórico, com memoização por fonte e data; filtros continuam locais.

Os testes de carregamento observaram zero chamadas aos três pulls ao entrar e navegar/filtrar; “Atualizar catálogo” manteve exatamente uma chamada a cada pull de classes, produtos técnicos e protocolos. Os dois `useLiveQuery` e seus loaders foram preservados. Não foi medida latência real de IndexedDB ou Supabase; não há evidência para alterar consultas, transporte ou rede.

## Validação observada

Executado `node node_modules/vitest/vitest.mjs run` sobre os arquivos abaixo. O conjunto inicial passou 61 testes; a atualização dos dois testes de componentes passou 13 testes (incluindo dois novos), totalizando 63 casos distintos nos oito arquivos:

| Arquivo de teste | Casos |
| --- | ---: |
| `src/components/sanitario/__tests__/SanitaryAutomaticPlanPanelV2.test.tsx` | 8 |
| `src/components/sanitario/__tests__/SanitaryProtocolWindowPanelV2.test.tsx` | 5 |
| `src/pages/__tests__/ProtocolosSanitarios.test.tsx` | 8 |
| `src/pages/__tests__/PerfilAdminNavigation.test.tsx` | 2 |
| `src/pages/__tests__/SanitarioCatalogoV2.test.tsx` | 13 |
| `src/components/auth/__tests__/RequireSuperAdmin.test.tsx` | 4 |
| `src/pages/Admin/__tests__/AdminSanitaryReviewTab.test.tsx` | 5 |
| `src/lib/sanitario/agenda/__tests__/sanitaryAutomaticGenerationV2.test.ts` | 18 |

Os testes usaram configuração sintética para Supabase (`127.0.0.1`, sem credenciais reais). A primeira execução sem essas variáveis não coletou testes; após fornecer a configuração sintética, as suítes executaram. Permanecem avisos de migração futura do React Router.

ESLint focado nos oito arquivos TS/TSX alterados: sem erros ou avisos.

`node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit`: falhou no projeto. Comparação adicional com a API TypeScript, substituindo em memória os arquivos modificados pelo conteúdo de HEAD: **241 diagnósticos antes e 241 depois, sem novos diagnósticos**. O erro já existente de tipo de `Tabs.onValueChange` na Central também permanece; não foi corrigido fora do escopo.

## Limites e preservação

Nenhum RPC, migration, sync, RLS, regra técnica, catálogo persistido ou gate foi alterado. Nenhuma operação remota, aprovação R04, homologação R05, deploy, push ou merge foi executada. Os testes curatoriais usam mocks; não representam aprovações reais.

Não foram executados build completo, regressão global ou homologação com sessão real. A medição demonstra a redução de trabalho no ensaio local; o tempo percebido em um dispositivo com rebanho real ainda não foi medido.

Revisão final do diff: quatro arquivos de apresentação, quatro arquivos de teste e este registro; nenhum arquivo remoto ou de domínio modificado. `git diff --check` sem erros. Classificação: **READY WITH CAVEAT**, pelas falhas globais de TypeScript preexistentes e pela ausência de medição em navegador real. Nenhum bloqueador novo identificado; a ressalva não condiciona R04/R05 a outro ajuste visual.
