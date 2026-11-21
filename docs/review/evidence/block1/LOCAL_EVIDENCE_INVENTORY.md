# Bloco 1 — Inventário do arquivo seletivo

Snapshot de 2026-11-21. [Matriz central](../../BLOCK1_CONSOLIDATED_MATRIX.md). Nenhum original foi removido ou sobrescrito para produzir este arquivo.

Rechecagem posterior: o usuário informou a exclusão de imagens. Das 230 entradas no [manifesto visual](screenshots-manifest.json), 111 permaneciam nos caminhos inventariados e 119 estavam ausentes; cinco cópias selecionadas mantinham o hash original. Não há confirmação de outro acervo ou backup externo para as imagens ausentes. Classificações pelo nome são inferências, e 121 imagens não tiveram cenário específico identificado automaticamente.

**Recuperação verificada em 2026-11-21:** as 230 imagens voltaram a estar presentes nos caminhos inventariados e todas corresponderam em tamanho e SHA-256, inclusive as 119 anteriormente ausentes. O diretório `workspace_original/.work/evidence/` contém 256 arquivos: 217 imagens (216 PNG e um JPEG), 26 JSON e 13 logs; não há outros tipos. As 13 capturas adicionais de `worktree_PR/.work/block1/screens/` elevam o total preservado para 269 arquivos: 230 imagens, 26 JSON e 13 logs.

Foi criada uma cópia local independente em `C:/Users/mares/RebanhoSync-acervo/bloco1-20261121`, fora do Git e das worktrees. Os 269 arquivos foram comparados à origem por tamanho e SHA-256; o arquivo `backup-hashes.json` nesse diretório registra os resultados. Os originais não foram modificados. Trata-se de cópia no mesmo computador, não de backup externo nem de proteção contra perda do dispositivo. Não foram copiadas sessões ou perfis Chromium.

## Seleção versionada

- Seis relatórios revisados: J01, J02, J03, J04 inicial, correção J04 e J05. Preservam observações/cenários/achados/recomendações/limites selecionados, separando estado original e avaliação posterior.
- [Manifesto dos originais](originals-manifest.json): nomes, bytes e SHA-256 para conferir o arquivo integral local. Não contém o conteúdo privado excluído.
- [Alteração da proteção Vercel](vercel-guard-change.json): somente projeto/equipe, campo antes/depois, ausência de builds ativos no preflight e deployment/SHA preservados.
- Evidências sintéticas de UI já selecionadas no pacote: [edição de fazenda](../../../manuals/images/block1/edit-desktop.png) e [onboarding](../../../manuals/images/block1/onboarding-desktop.png). Não houve nova cópia em massa de capturas.
- Snapshot anterior de integração: [BLOCK1_INTEGRATION_20261121.json](../BLOCK1_INTEGRATION_20261121.json). É evidência histórica, não certificação da produção.

## Evidência integral que permanece somente local

`workspace_original` é o checkout principal GestaoAgro em que J01–J05 foram executadas; `worktree_PR` é a worktree `j04-invites-members-auth/GestaoAgro`. Os aliases evitam publicar caminhos pessoais. Caminhos nesta seção são inventário local, não hyperlinks quebrados.

| Acervo | Arquivos no snapshot | Bytes | Conteúdo / disponibilidade |
|---|---:|---:|---|
| `workspace_original/.work/j01-result.json` a `j05-result.json`, incluindo `j04-correction-result.json` | 6 | 207715 | Originais integrais; hashes no manifesto; revisões sanitizadas no Git |
| `workspace_original/.work/evidence/j02/` | 32 | 2869706 | Capturas, inspeções e resultados completos; não copiados |
| `workspace_original/.work/evidence/j03/` | 63 | 6479845 | Capturas, inspeções e resultados completos; não copiados |
| `workspace_original/.work/evidence/j04/` | 36 | 2104322 | Capturas, inspeções e resultados completos; não copiados |
| `workspace_original/.work/evidence/j04-correction/` | 62 | 3466945 | Capturas, inspeções e resultados completos; não copiados |
| `workspace_original/.work/evidence/j05/` | 63 | 4147430 | Capturas, inspeções e resultados completos; não copiados |

Outros conjuntos completos locais:

- `worktree_PR/.work/block1/`: logs RED/GREEN, Chromium, concorrência, preservação e dumps de inspeção de jornadas; `screens/` guarda as capturas completas. A stack em `disposable/` inclui configuração e cópias locais de migrations, sem equivaler a produção.
- `worktree_PR/.work/block1-integration/`: inventários, logs de testes, preservação e preparação do PR.
- `worktree_PR/.work/block1-release/`: diagnósticos completos dos runs CI, proposta e snapshots de configuração Vercel, scripts locais de seleção e resultado de integração. O registro mínimo da proteção foi selecionado separadamente.
- Perfis Chromium das jornadas e estados de autenticação continuam no armazenamento local original, incluindo o perfil temporário de `rs-jornadas-20261120/chromium` indicado pelos relatórios. Não foram abertos, exportados ou copiados para este arquivo. Não há garantia de retenção de diretórios temporários.

Exceções históricas já rastreadas no Git sob `.work`, que não devem ser descritas como “somente local”: `.work/block1-integration/check-links.mjs`, `.work/block1/consolidated-matrix.json`, `.work/block1/consolidated-matrix.md`, `.work/block1/final-result.json`. Foram preservadas; a matriz canônica revisada está em `docs/review/BLOCK1_CONSOLIDATED_MATRIX.md`.

## Revisão e sanitização

As revisões usam seleção explícita de campos narrativos. Foram excluídos inputs completos, linhas de dados persistidos, identidades de conta/colaborador, sessões, payloads de autenticação e logs integrais. Contatos, UUIDs de fixtures, JWTs, credenciais em URLs, query strings e caminhos pessoais foram omitidos ou substituídos. Referências locais e nomes de arquivos são mantidos somente para rastreabilidade; não implicam publicação desses arquivos.

O status original é relato histórico. `currentAssessment` referencia os grupos da matriz local; não converte roadmap em implementação nem falha antiga em teste novo. A validação dos links e dos padrões sensíveis selecionados deve ser registrada no PR. O acervo local pode conter dados sensíveis: não anexar diretórios completos nem sessões a novas revisões.
