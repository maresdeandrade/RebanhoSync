# F24.6A1-G2 — Targeted Complexity Remediation

Data: 2026-10-11. Decisão local: **READY_FOR_CI_REVALIDATION**.
Não representa aprovação do CI remoto, merge ou fechamento da F24.6.

## Baseline e escopo

Branch `codex/f24-6a0-benchmark`, HEAD
`1a78ba1bafd67b9dac9892d43c4706bc8afc730c`, referência `origin/main`
`117f3bfe5fc88c57ae2c58bb25dab694567075da`, PR #196.
As alterações G1 não commitadas foram preservadas. G2 altera somente os dois
hotspots e registra este relatório. Nenhum commit ou publicação remota.

Em `syncWorker.ts`, extraídos predicados privados para receipt APPLIED,
operação elegível, allowlist/formato, identidade e metadados do cliente.
O seletor mantém uma operação/um resultado, UPDATE observacoes exclusivamente,
revisão válida, UUIDs/metadados consistentes e fallback null para os demais casos.
O record capturado é reutilizado; não há nova leitura de op.record nos helpers.

Em `pull.ts`, extraídos validadores privados para modos, observação obrigatória
e cobertura do snapshot. O modo já resolvido é reutilizado. Erros e checkpoints
preservados: modos/observação antes do fetch; cobertura após todos os fetches e
antes de qualquer instalação. Query ID+fazenda, proteção de pending, CAS,
fetch-all→install-all e transação única não foram alterados.
Nenhum replace parcial, efeito ou await foi acrescentado aos helpers.

## Complexidade e Fallow

Fallow 3.17.0; mesma configuração e base do CI, fixada por FALLOW_AUDIT_BASE.
Antes, Fallow reportava seletor 37/8 e pull 38/30 (ciclomática/cognitiva).
Depois, nenhum dos dois nem os helpers extraídos aparece como finding introduzido.
Não foram alterados gate, thresholds, baselines de supressão ou ignores.

Medição numérica auxiliar uniforme pelo ESLint core complexity, aplicado ao
texto HEAD e G2 com o mesmo parser (sem modificar a configuração do projeto):

| Função | Ciclomática E1 / HEAD | Ciclomática G2 |
|---|---:|---:|
| selectPostAckAnimalObservation | 37 | 9 |
| pullDataForFarm | 40 | 15 |

Não misturar os números ESLint com Fallow: os analisadores diferem na contagem
do pull. O diagnóstico auxiliar emite todas as métricas como warnings; não é
o gate de CI. O gate efetivo permanece Fallow new-only, com thresholds originais.

| Atribuição Fallow final | Introduzido | Herdado |
|---|---:|---:|
| Dead code | 0 | 5 |
| Complexidade | 0 | 6 |
| Duplicação | 0 | 5 |

Verdict **pass**, exit **0**. Findings herdados permanecem descritos em G1;
nenhuma correção transversal foi feita. A primeira extração gerou três findings
CRAP em helpers; sua decomposição adicional permaneceu localizada e os eliminou.

## Testes

148 testes aprovados em 14 arquivos focados, incluindo seletor/pull, ACK atômico,
pending/CAS, obrigações por geração, recovery, farm-switch, concorrência unitária,
retry, compras, movimento, reprodução e sanitário. Testes E1 não foram alterados.
A primeira bateria não carregou movementOffline por ausência de variável
sintética e omitiu o arquivo farm-switch por nome incorreto; a bateria final usou
os três valores VITE sintéticos e o nome real characterization, aprovando 148/148.
Não houve teste de concorrência real novo: fronteiras assíncronas/transacionais
permanecem iguais. Não houve regressão global ou repetição da série A/B E2.

ESLint direcionado e git diff --check aprovados. JSON final dos testes:
test-results/f24-6/f24-6a1-g2-vitest-final.json. JSON do gate:
test-results/f24-6/f24-6a1-g2-fallow-delivery.json.
Comando do gate: pnpm --config.verify-deps-before-run=false exec fallow audit
--gate new-only --format json, com a base fixa acima. A opção pnpm protege a
junction de dependências compartilhadas contra reinstalação; não altera Fallow.

## Prova operacional final, independente de E2

Série **F24_6A1_G2-f24-6a0b-344ba091**, um run otimizado, 100 gestos/animais,
uma operação por gesto, duas fazendas, agenda vazia. Hashes finais abaixo.
Foi usada uma worktree própria detached no baseline 3b3bc96, com as fontes G2,
para respeitar o guard histórico do harness sem sobrescrever manifests E1/E2.
O provisionador copiado limita a especificação a um único run de 100 gestos,
sem executar a série A/B ou as provas concorrentes pós-ACK. Essas adaptações
somente parametrizam a cópia de prova; o harness tracked não foi modificado em G2.
Worktree de prova mantida como proveniência: f24-6a1-g2-proof-dc42fc4e/GestaoAgro.

| Métrica final | Observado |
|---|---:|
| Duração / convergência do workload | 10936,20 ms |
| ACKs instalados | 100 |
| Requests / pulls | 306 / 104 |
| Bytes enviados / recebidos | 65000 / 287621 |
| Linhas de animais recebidas | 300 |
| Linhas esperadas / instaladas na fazenda alvo | 50 / 50 |
| Backlog final / obrigações finais | 0 / 0 |
| Erros / retries / timeouts | 0 / 0 / 0 |

Todos os valores finais foram validados pelo harness; isolamento e cleanup
de IndexedDB, fazendas e usuário verificados. Requests/pulls/linhas coincidem com
E2 otimizado; bytes recebidos coincidem com sua mediana. Uma amostra não prova
ganho geral de latência/memória, SLO, equivalência universal ou reconnect 1k.
ACK observado não é latência física de ACK.

60 migrations, schema/RLS/ACL e probes pequenos aprovados no backend próprio.
Cleanup dos recursos próprios e preservação do backend compartilhado verificados
por inventário/fingerprint. A prova intermediária f24-6a0b-f59f0401 (hash de pull
e75d06fc...) foi preservada e não agrupada com esta prova final.

Certificação final na worktree de prova:
test-results/f24-6/f24-6a0b-344ba091/certification.json.
Artifact final: test-results/f24-6/reconnect-warm-1791726136099.json.
Limites prévios: 240s, 4000 requests, 600MiB recebidos, heap aproximado 512MiB,
guard externo 300s por child; sem retry para substituir uma amostra.

## Hashes SHA-256 G2 finais

| Arquivo | SHA-256 |
|---|---|
| src/lib/offline/pull.ts | 06125a2bfb93f586687e3c235065f6851640d6fc9e8e4e675736f4c5f92eb678 |
| src/lib/offline/syncWorker.ts | 5433e3c6f8fb4a93378ab7c3e97e7b847d12c9d6dd59b03439b13834acd0e040 |
| src/lib/offline/__tests__/postAckPull.test.ts | 074e67d80247399c546ced88684eaa00a874a0249882b4ba55e89ff56c9b556c |
| src/lib/offline/__tests__/postAckSelector.test.ts | 3dc171b986a39326e0cd4d7f4f9d2c1835c4c3805db6e1656c132608775e882e |

Os dois módulos têm hashes novos autorizados; os dois testes conservam E1.
Manifest e relatórios históricos E1/E2 não foram reescritos. As medições históricas
continuam vinculadas aos seus hashes, não às fontes G2. Manifest final local:
test-results/f24-6/f24-6a1-g2-delivery-hashes.json.

## Pendências

PR #196 permanece no HEAD original e com o CI antigo reprovado. Publicação e nova
validação remota exigem etapa autorizada própria. F24.6 permanece ativa;
reconnect 1k não certificado. Os findings herdados não foram resolvidos por G2.
