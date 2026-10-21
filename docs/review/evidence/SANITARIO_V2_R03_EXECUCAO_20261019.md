# R03 — catálogo Sanitário V2 importado

**Decisão: R03 CONCLUÍDA.** Importação transacional executada no projeto
`zqloazqzhwauamcejmuz` em 19/10/2026, sem aprovação curatorial ou ativação operacional.
Baseline local: `fda6f0e8c6d0d72f81746d5c4da784012e59e438`, branch
`codex/sanitario-v2-convergencia`, worktree inicialmente limpo. O importador canônico
`scripts/codex/import-sanitario-protocols-v2.mjs` não foi modificado.

## Promoção e autorização

| Artefato | SHA256 |
|---|---|
| Canônico anterior, preservado como fixture histórica | `51df1c3884f463992113d0d3ac89e3c9534ce68726e9829972838cae2132cf73` |
| Candidato autorizado | `2b3adab34d0eb58dcc5d8fa976d1cd852d41f204e00063b776e2271d60753fe6` |
| Canônico promovido | `d38da283e9114344c6bacea26b527b3da8cfc1ab1a27737458cad9b8bd4270c0` |

As coleções `payload` e as quatro rejeições foram preservadas exatamente do candidato.
Somente metadados de promoção/autorização mudaram: remoção de `review_only`, autorização
de importação R03 com projeto/hash/escopo explícitos e remoção do bloqueio de importação.
`execute_import=false` permanece. Não foram alterados IDs, versões, fontes, regras,
restrições ou permissões operacionais. O arquivo canônico continua sendo a única entrada
de escrita do importador; a fixture anterior serve somente aos testes históricos.

## Escrita efetivamente observada

| Tabela | Criados | Atualizados |
|---|---:|---:|
| sanitario_protocolos_v2 | 10 | 0 |
| sanitario_protocolo_itens_versions_v2 | 20 | 0 |
| sanitario_fontes_tecnicas_v2 | 16 | 0 |
| sanitario_fonte_cobertura_campos_v2 | 71 | 0 |
| sanitario_produtos_v2 | 3 | 0 |
| sanitario_product_classes_v2 | 8 | 0 |
| sanitario_product_class_groups_v2 | 4 | 0 |
| sanitario_product_class_group_members_v2 | 12 | 0 |
| **Total** | **144** | **0** |

Os outros seis publishers de regras/autorizações de produto permaneceram sem linhas.
As quatro rejeições `NOT_A_CLASS_CONFIRMED` foram os membros
`spcgmem_recria_associacoes`, `spcgmem_pre_desmama_associacoes`,
`spcgmem_pre_confinamento_associacoes` e `spcgmem_matrizes_associacoes`.
Nenhuma rejeição foi incorporada como registro.

O dry-run canônico remoto retornou `{create:144, update:0, skip:0, reject:4}`.
O `--apply` retornou exit 0 com a mesma contagem. O engine existente executou BEGIN,
timeouts locais, advisory lock, reconstrução/validação do plano, escrita em ordem de FKs,
verificação de convergência e COMMIT. Não ocorreu falha parcial durante a aplicação.
O dry-run canônico posterior retornou **`{create:0, update:0, skip:144, reject:4}`**.
Isso compara as identidades e os campos projetados das 144 linhas, incluindo fontes/regras,
sem propor nova criação ou atualização.

## Estado remoto preservado

- 20 itens **draft**, zero `allows_agenda_auto`; três produtos **precisa_validar**.
- Protocolos: nove draft e um retired, preservando o bloqueio preexistente de febre aftosa.
  Zero protocolos aprovados, `approved_by` ou `approved_at` preenchidos.
- Sete itens preparados para R04, sete comerciais pendentes e seis restritos preservados
  em suas versões. Zero duplicações de identidade lógica/versionada.
- Zero referências quebradas em coberturas/fontes, itens/protocolos e vínculos de grupos;
  protocolos exclusivamente globais, sem `fazenda_id`.
- 63 migrations; todas as Functions inalteradas, incluindo `sync-batch` v28.
- Gates sem registros e **OFF**; zero Agendas V2/legadas, planos, ledger e estoque.
  Os **três Eventos anteriores** foram preservados, com digest igual antes/depois.
  Configurações sanitárias também mantiveram seu digest.
- Zero superadmins e zero decisões curatoriais/auditoria. Digests de memberships,
  RLS e ACLs iguais antes/depois. Nenhuma concessão curatorial foi realizada.

## Conexão e efeitos auxiliares

Foi utilizado o próprio CLI canônico `--validate`, `--dry-run`, `--apply`, `--dry-run`,
com credencial temporária mantida somente em memória/ambiente dos processos. A URL de
conexão não continha credenciais. Um launcher fora do repositório apenas preparou conexão,
verificou o plano e chamou o importador existente; não implementou outro writer.

A conexão validou CA e hostname com `verify-full`, usando o certificado público
Supabase Root 2021 CA obtido por HTTPS no endereço oficial registrado no JSON de evidência.
A associação existente de `cli_login_postgres` permite `SET ROLE postgres`, sem herança
automática. Foi necessário inicializar explicitamente esse papel em cada sessão; nenhum
GRANT foi emitido. A tentativa por opção de startup foi ignorada pelo pooler.

Houve **cinco inicializações de autenticação da CLI**, que renovaram/rotacionaram o login
temporário existente. As três primeiras falharam antes do dry-run (CA e inicialização do
papel); a quarta concluiu somente dry-run; a quinta concluiu dry-run/aplicação/convergência.
As falhas não alteraram o catálogo. Última validade: **19/10/2026 22:00:26.814517 UTC**.
A conferência final às **22:00:41.5491 UTC** confirmou o login temporário **expirado**.
Não se declara ausência desse efeito auxiliar de autenticação.

## Testes e limite de escopo

**261 testes aprovados em quatro arquivos**: publisher (153), aprovação/preparação (13),
promoção R03 (3) e contrato canônico (92). Incluem identidade, isolamento, conflitos,
ordem referencial, rollback simulado de falha parcial, retry e replay idempotente.
Os cenários históricos passaram a usar a fixture anterior imutável; testes novos exercitam
o canônico promovido. Foi corrigido apenas o mock que decodificava conteúdo JSON de uma
coluna TEXT (`apresentacao`); o schema e o importador não mudaram.
`--validate` canônico também aprovado. Não houve regressão global, build, migration,
deploy, criação de fazenda/usuário, alteração de fila, push ou merge remoto.

Evidência completa: [relatório estruturado R03](SANITARIO_V2_R03_EXECUCAO_20261019.json).
Próximo passo: [R04 preparada para sete itens](SANITARIO_V2_R04_PREPARADA_20261019.md),
dependente de autorização separada. R04 e R05 não foram executadas.
