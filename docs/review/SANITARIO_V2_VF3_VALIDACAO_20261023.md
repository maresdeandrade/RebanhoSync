# Sanitário V2 — VF3: recovery, sessão e farm-switch — 23/10/2026

**Estado funcional: `VALIDATED_WITH_CAVEATS`. Gate do patch: `READY WITH CAVEAT`.**

Os cenários locais demonstraram preservação da intenção e da fila, bloqueio do cliente sem sessão utilizável e recuperação após troca de fazenda/reinício. Foi reproduzido e corrigido um defeito HIGH: resposta antiga de `refreshSettings` restaurava a Fazenda A após seleção explícita da B. Não há conclusão de prontidão para produção nem de convergência remota.

## Baseline e ambiente verificados

- Repositório local: `C:/Users/mares/dyad-apps/GestaoAgro`.
- Branch: `codex/sanitario-v2-functional-validation`; HEAD: `4b43fc10ec9dfd0c19527c22c4d725799d9e7969`.
- Worktree principal existente, reutilizado; outros quatro worktrees foram listados e preservados. Nenhum commit, push ou merge foi realizado.
- Working tree já continha entregas VF1/VF2 e trabalho concorrente em governança, reprodução, importação/publicação, catálogo e testFarm. Esses arquivos não são atribuídos à VF3. Não havia staging; não houve descarte ou limpeza.
- Catálogo: reutilizado o snapshot somente leitura da VF2, sem nova homologação ou consulta remota. SHA-256: `c9744cf2e6b6a9b95e11e68d74990cdb0af887f849c9acde9421bb720d80fdcc`.
- Chromium/Playwright e Vite local, configuração existente `e2e/sanitary-planning.config.ts`; API sintética em `127.0.0.1:59997`, interceptada. Requisições externas são abortadas e contabilizadas como inesperadas. Nenhuma foi observada nos casos aprovados.
- Páginas, `AuthProvider`, `RequireAuth`, `RequireFarm`, Dexie, writers e worker são os existentes. Apenas identidade/respostas HTTP são sintéticas. O modo de sessão mutável é opt-in (`recovery`) na fixture existente; não foi criada infraestrutura paralela.
- Relógio funcional da fixture: `2026-07-04T12:00:00Z`. Não representa a data de execução nem o relógio de um servidor real.
- Gates remotos OFF são evidência herdada da VF2, sem reconsulta nesta fase. Não foram ativados gates locais/remotos; a chave local de push permaneceu ausente. O teste de fila salva configuração **desativada**, sem regras e sem confirmação de ativação.

## Matriz funcional e evidências

As evidências JSON extraídas das execuções aprovadas estão em [SANITARIO_V2_VF3_RECOVERY_RESULT_20261023.json](evidence/SANITARIO_V2_VF3_RECOVERY_RESULT_20261023.json). Os caminhos `scratch/` abaixo são logs locais auxiliares ignorados pelo Git; o JSON consolidado contém os snapshots dos seis casos.

| Cenário | Resultado final | Evidência observada e limite |
|---|---|---|
| Sessão expirada durante preview, confirmação offline, consulta local do catálogo e reconexão | PASS | Agenda manual persistida; uma operação pendente da configuração desativada preservada; zero chamadas de sync enquanto a sessão é conhecida como expirada. Logout redireciona pela guarda real e o boundary de escrita lança `LocalOwnershipError`. Restauração explícita da mesma conta sintética e recuperação canônica de gestos permitem uma tentativa, respondida com 503. IDs permanecem; nenhum gesto é marcado DONE. |
| Região e `user_settings` de A atrasados durante seleção e preview, troca para B | PASS após correção | Respostas HTTP retidas e liberadas depois da troca. Preview e animal A desaparecem; animal B fica desmarcado; B e papel manager permanecem após conclusão da resposta A. Nenhuma Agenda é gravada. |
| Encerramento/reinício real do contexto Chromium | PASS | `launchPersistentContext` com perfil temporário, `context.close()`, browser original desconectado e novo contexto com o mesmo perfil. Agenda e operações completas são iguais antes/depois; não há nova identidade no reconnect. Seleção é refeita; animal já planejado fica desabilitado. Não foi usado reload como substituto. |
| Papel de A atrasado, seleção de B e logout | PASS | B recebe manager; após logout e liberação da resposta antiga, fazenda e papel continuam vazios. Nenhum dado operacional é criado. |
| 401 sintético no envio, refresh recusado e retry após autenticação explícita | PASS no cliente | Uma tentativa recebe 401, gesto vira ERROR com `AUTH_UNAVAILABLE`; nova tentativa sem sessão não envia HTTP. Após recuperação canônica, segundo envio tem corpo exatamente igual ao primeiro e recebe 503. Isso prova identidade estável do replay no cliente, sem comprovar deduplicação do servidor. |
| HTTP de catálogo atrasado durante preview A e troca para B | PASS | Consulta existente é iniciada, retida e liberada depois da troca. B permanece ativa; preview fecha; consulta de animais B vazia não exibe animal A; nenhuma operação/Agenda é criada. Catálogo é global e pode ser atualizado; contexto da fazenda anterior não é restaurado. |
| Invariantes sanitárias nos snapshots dos casos | PASS no escopo local | Zero Eventos e zero movimentações de estoque; Agenda continua intenção. Os três itens ativos de raiva mantêm `allows_agenda_auto=false` e `no_agenda_auto`. Sem reconstrução de histórico a partir de `state_*`. |
| Convergência real, deduplicação no servidor, aceitação parcial e recuperação | BLOCKED | `config/backend-targets.json` identifica projeto de produção e lista de homologação vazia; nenhum backend descartável exclusivo foi disponibilizado/identificado com autorização para escrita. Nenhuma resposta de sucesso/ACK foi fabricada para alegar convergência. |
| Supabase Auth/JWT/refresh reais, RLS e gates no servidor | NOT_RUN | Fixture não valida esses serviços. Sem ambiente descartável autorizado; nenhuma chamada remota foi executada. |
| Inicialização PWA totalmente offline e crash abrupto do processo | NOT_RUN | Vite local fornece shell/assets antes de voltar offline após reinício. Foi executado encerramento real e regular do contexto, autorizado pelo critério C; não se alegam cold start de service worker nem resistência a kill abrupto. |

**Limite da fila:** o planejamento manual de Agenda permanece no contrato local existente com gates OFF. Para exercitar persistência/retry/replay, o cenário adiciona pelo writer canônico uma operação da configuração sanitária desativada. Isso não demonstra envio remoto de Agenda manual nem habilita esse envio. Agenda e operação da configuração são verificadas separadamente.

**Limite da sessão:** a transição para sessão válida é uma ação explícita do teste para a mesma identidade sintética, após refresh recusado. Não há refresh que converta automaticamente sessão inválida em válida. A autenticação real continua fora da evidência.

## Defeito reproduzido e correção mínima

**HIGH — resposta obsoleta restaura contexto da fazenda anterior.**

Reprodução: com A ativa e preview aberto, suspender GET de `user_settings` iniciado por `refreshSettings`, selecionar B pelo setter real do contexto e liberar a resposta antiga contendo A. Antes do patch, a asserção de fazenda ativa esperava B e recebeu A (`scratch/sanitary-vf3-recovery-red.json`). O mecanismo podia invalidar o isolamento funcional da interface ao restaurar um contexto que o usuário já havia substituído; não foi demonstrada gravação cruzada no banco.

Correção em `src/hooks/useAuth.tsx`: revisão monotônica do contexto invalida leituras antigas de settings, papel e metadados. Troca explícita de fazenda invalida no início e no commit da seleção; logout e evento sem sessão também invalidam. Após awaits relevantes, respostas antigas não aplicam estado. Não foram alterados writers, fila, RLS, permissões, schema ou regras sanitárias.

Evidência verde do mesmo cenário: `scratch/sanitary-vf3-green.json`, incorporada ao JSON consolidado. Revisão independente read-only do diff de `useAuth.tsx` não encontrou findings acionáveis introduzidos pelo patch. Essa revisão não substitui os limites de backend desta fase.

## Arquivos da VF3

| Arquivo | Delta desta fase |
|---|---|
| `src/hooks/useAuth.tsx` | Correção de resposta obsoleta após farm-switch/logout; arquivo sem alterações locais no início da VF3. |
| `e2e/fixtures/sanitary-planning.tsx` | Modo opt-in de sessão mutável, guardas reais e observação do contexto. Preservados seed/snapshot e modos VF1/VF2. |
| `e2e/sanitary-planning.spec.ts` | Interceptador parametrizável, helpers de recovery e seis cenários VF3. Arquivo já continha alterações VF1/VF2, preservadas. |
| `docs/review/SANITARIO_V2_VF3_VALIDACAO_20261023.md` | Este relatório. |
| `docs/review/evidence/SANITARIO_V2_VF3_RECOVERY_RESULT_20261023.json` | Snapshots dos seis casos aprovados, proveniência das execuções e limites. |

Arquivos temporários de perfil Chromium, logs e script de consolidação estão em `scratch/`, ignorado pelo Git. Nenhum perfil ou fila de usuário real foi aberto ou removido.

## Validação proporcional executada

Seis cenários distintos de browser aprovados em execuções focadas, sem reexecução da suíte VF1/VF2:

- `pnpm exec playwright test --config e2e/sanitary-planning.config.ts --grep 'VF3 sessão' --reporter=json` → PASS; `scratch/sanitary-vf3-session-final.json`.
- `pnpm exec playwright test --config e2e/sanitary-planning.config.ts --grep 'VF3' --reporter=json` durante o ciclo de diagnóstico/correção → cenário farm-switch e restart aprovados em `scratch/sanitary-vf3-green.json`; a falha intermediária de setup do cenário de sessão foi corrigida no teste e reexecutada no comando focado acima. Não se declara esse arquivo intermediário como suíte inteira verde.
- Execução focada dos casos de sessão/papel → papel atrasado PASS em `scratch/sanitary-vf3-auth-final.json`.
- `pnpm exec playwright test --config e2e/sanitary-planning.config.ts --grep 'VF3 HTTP 401' --reporter=json` → PASS; `scratch/sanitary-vf3-http401-final.json`.
- `pnpm exec playwright test --config e2e/sanitary-planning.config.ts --grep 'VF3 catálogo HTTP' --reporter=json` → PASS; `scratch/sanitary-vf3-catalog-final.json`.
- `pnpm test -- src/hooks/__tests__/useAuth.ownershipRecovery.test.tsx` → 1/1 PASS.
- `pnpm test -- src/pages/ProtocolosSanitarios/helpers/__tests__/useSanitaryFarmLocationV2.test.tsx` → 2/2 PASS.
- `pnpm exec eslint src/hooks/useAuth.tsx e2e/fixtures/sanitary-planning.tsx e2e/sanitary-planning.spec.ts` → exit 0, zero diagnósticos.
- `pnpm exec tsc --noEmit --project e2e/tsconfig.json` → exit 1, 38 diagnósticos. Comparação textual com `scratch/sanitary-vf2-types-final.log`: 38 iguais, zero adicionados/removidos; nenhum nos arquivos VF3. É comparação com artefato local VF2, **não baseline Git isolado**. Não se declara TypeScript global aprovado nem se corrigiram diagnósticos externos.
- `git status --short --untracked-files=all`, `git diff --name-status`, `git diff --stat`, equivalentes cached, inspeção do diff VF3 e conteúdo dos dois artefatos untracked → escopo identificado; sem staged.
- `git diff --check` → PASS.

Não foram executados build completo, regressão global ou nova homologação: escopo restrito à invalidação de respostas no provider e testes focados, conforme restrição de proporcionalidade. O gate registra essa validação parcial em `READY WITH CAVEAT`. Falhas intermediárias de infraestrutura do teste (módulo lazy indisponível no Vite offline e gesto ERROR que exige `recoverErroredGesturesOnce`) foram tratadas na preparação/exercício do fluxo existente; não motivaram mudanças de runtime.

## Decisão e próxima etapa

**FATO CONFIRMADO:** seis cenários locais de browser e três unitários passaram; o bug de contexto obsoleto foi reproduzido e corrigido. O retry mantém payload/identidade local e não fabrica confirmação de sucesso diante de 401/503. Nenhuma mutação remota foi executada.

**INFERÊNCIA LIMITADA:** o patch reduz o risco de contaminação do contexto por respostas antigas nos caminhos exercitados. Os testes sintéticos não comprovam segurança RLS, idempotência do servidor ou integridade após aceitação parcial real.

**Pendências prioritárias:** (1) backend descartável autorizado para convergência/deduplicação/aceitação parcial; (2) autenticação real, RLS e gates no mesmo ambiente; (3) cold start PWA offline e crash abrupto, se exigidos para a próxima liberação.

**RECOMENDAÇÃO:** próxima etapa focada nessas pendências, em backend exclusivo descartável com credenciais de teste e duas fazendas sintéticas. Exercitar Auth real, replay de IDs já aceitos, falha parcial e reconciliação, mantendo gates operacionais conforme o cenário autorizado. Preservar produção OFF. Não repetir VF1/VF2 nem declarar produção pronta com base nesta VF3 local.
