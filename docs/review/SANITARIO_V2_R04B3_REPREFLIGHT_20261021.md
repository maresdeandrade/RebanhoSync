# R04B.3 — novo preflight somente leitura e proveniência

**Resultado: BLOCKED_PREFLIGHT.** Os três Eventos sanitários reconhecidos foram identificados como registros posteriores independentes das cinco candidatas CLO/LEP, sem presumir corrupção. Entretanto, o ambiente apresenta também **um Evento comercial e um quarto animal**, posteriores ao snapshot anterior. A condição “único desvio = três Eventos preservados e independentes” não foi atendida.

Escopo executado: consultas SQL em transações read-only, logs por janela de tempo e projeção local pura do domínio sobre snapshot congelado. Zero escrita remota. Não houve migration, publicação, decisão curatorial, correção/tombstone, alteração de Agenda, gate ON, homologação, deploy, push ou merge.

## Evidências e baseline

- [Proveniência completa, detalhes, casos, logs e telemetria](evidence/SANITARIO_V2_R04B3_REPREFLIGHT_PROVENANCE_20261021.json).
- [Baseline observado atualizado — 21/10/2026 10:26:49 UTC](evidence/SANITARIO_V2_R04B3_UPDATED_BASELINE_20261021.json).
- [Consulta read-only usada no snapshot](evidence/SANITARIO_V2_R04B3_UPDATED_BASELINE_QUERY_20261021.sql).
- [Verificações e classificação estruturadas](evidence/SANITARIO_V2_R04B3_REPREFLIGHT_RESULT_20261021.json).
- [Projeção executada pelo código de domínio](evidence/SANITARIO_V2_R04B3_HISTORY_PROJECTION_20261021.json).

Projeto `zqloazqzhwauamcejmuz`, branch `codex/sanitario-v2-convergencia`, HEAD `b5b6ffc9f515874577003efd2cce3ef4492bdb74`. Worktree `C:/Users/mares/.codex/worktrees/r04b2-certificacao/GestaoAgro`.

O novo baseline é um **snapshot observacional**, com IDs, timestamps, payloads e linhas completas. Não substitui o pacote certificado, não reescreve a evidência original da R05 e não autoriza publicação. Os quatro arquivos originais R05 conferem por SHA256 com o HEAD; os 36 arquivos do manifesto R04B.2 também permanecem íntegros. O relatório do primeiro preflight bloqueado permanece preservado.

## Origem dos três Eventos sanitários

**Fatos confirmados:**

- Transação comum `6dc95ada-c842-4b9c-b382-1f42eb5f761f`.
- Cliente declarado `browser:1fec66b3-adaf-4ea6-a8df-594ce4354b06`, diferente dos clientes A/B utilizados na homologação R05 original.
- Três Eventos, três detalhes `eventos_sanitario` e três casos `sanitario_casos`: nove operações distintas com o mesmo `client_tx_id` e timestamps de servidor entre `05:59:58.289463` e `05:59:58.871908` UTC.
- Casos com `payload.source=registrar`; detalhes declaram `tipo=vacinacao`, produto genérico legado “Vacina Brucelose B19”, uma dose, via subcutânea, rastreabilidade manual e ausência de insumo estruturado.
- Produto legado `fe387f63-682b-4f11-96e8-ab442302c13c`; `produto_sanitario_v2_id`, referência/versão/snapshot do item de protocolo, `sanitario_contract_version`, `domain_op_id` e vínculo com Agenda v2 ausentes. Não se infere marca, registro MAPA, validade comercial ou autorização a partir do nome genérico.
- Nenhum consumo de estoque, carência datada ou Agenda derivada foi encontrado para a transação. Os três casos continuam abertos, sem código de doença, notificação imediata ou bloqueio de movimentação; isso não atesta condição clínica.

**Confirmação do transporte:** logs do gateway em janela delimitada mostram nove POSTs HTTP 201 nas três tabelas, vinculados à conta `0f00a75c-32a9-4555-a840-cb0f13f2d3f7`. A chamada pai a `/functions/v1/sync-batch`, versão 28, retornou HTTP 200; request `01a15d0b-82f4-73d1-a3f2-e09dd426fef6`, execução `74b9656c-9b80-4e03-a962-5e92b6840a8d`. User agent Chrome/155 em Windows. A telemetria registra navegação `/registrar`, retorno `/home` e `sync_success` com nove operações nas tabelas correspondentes.

A membership atual é `owner`, existente desde a criação da fazenda. O principal autenticado dos logs identifica **a conta usada**, sem provar qual pessoa ou automação a utilizou nem a autorização original do ato. `responsavel_nome` no detalhe é declarativo e não comprova responsabilidade veterinária.

**Limites dos recibos:** não há recibos dessas operações no ledger sanitário v2, compatível com seus envelopes legados. O corpo original do ACK legado não está disponível nos dados consultados. Os HTTP 201, linhas persistidas e a telemetria comprovam persistência; não foram transformados em um recibo canônico inexistente. Os horários do cliente estão aproximadamente seis segundos à frente dos horários do servidor, sem inferir fraude ou corrupção dessa diferença.

## Teste versus execução física

Os três animais foram criados na R05 com `payload.homologacao.synthetic=true` e finalidade explícita `sanitary assessment planning only; no real execution`. IDs, sexo, nascimento e esse marcador coincidem com o seed preservado do cliente A da R05.

Isso confirma o uso de fixtures da homologação. **Não foi comprovado que a transação posterior de vacinação integrou um teste independente formalmente autorizado.** Não há marcador de teste no Evento ou em seu detalhe, referência a laudo/comprovante de aplicação ou evidência independente de execução física. A conta autenticada, o nome do responsável e os ACKs de transporte não resolvem essas lacunas.

**Classificação:** gravação legada posterior em animais sintéticos, independente da publicação canônica CLO/LEP. Finalidade de teste e execução física permanecem não confirmadas. São declarações eletrônicas preservadas; não se promove seu conteúdo a vacinação clinicamente válida nem se presume corrupção dos registros.

## Elegibilidade B19 e impacto histórico

Referência: `b19_femeas_3_8_meses`, v3 aprovada, pré-checagem B19 implementada e fonte vigente já vinculada ao catálogo. Avaliação na data declarada dos Eventos, `2026-10-21`, contexto DF.

| Animal / Evento | Cadastro | Resultado objetivo |
|---|---|---|
| `R05-M6M-SINTETICO` / `8993273e-d735-4c97-9171-06b591433927` | Bovino macho, nascimento 20/04/2026 | Fora da elegibilidade por sexo; pré-checagem `not_applicable` |
| `R05-F6M-SINTETICA` / `fc5d058f-058b-4d5a-b650-c5d4c682d585` | Bovina fêmea, nascimento 20/04/2026 | Sexo/idade na janela; `in_action_window`. Isso não certifica produto, MV, registro oficial ou aplicação física |
| `R05-MATRIZ-SINTETICA` / `14500307-5fa2-482e-938b-f96832979f58` | Bovina fêmea, nascimento 01/01/2023 | Adulta fora da janela de vacinação; `insufficient_data` e pendência documental, sem nova vacinação automática |

As duas incompatibilidades são do conteúdo declarado dos registros legados; não são evidência de alteração da regra B19 aprovada nem autorização para corrigi-los. Todos permanecem íntegros.

Foi executada uma projeção local com as linhas reais congeladas e as funções existentes `buildSanitaryExecutedHistoryV2`, `precheckSanitaryProtocolsForAnimalV2` e `sanitaryClassHistoryMatchesV2`: **um cenário passou**, sem persistência e com o acesso a banco mockado exclusivamente para impedir efeitos.

Resultado:

- Nenhum dos três detalhes resolve para item de protocolo canônico, pois não contém identidade/chave/snapshot do item. O builder retorna **zero Eventos no histórico canônico**; não faz associação por semelhança do nome do produto.
- Nenhuma das cinco candidatas aceita esses detalhes como evidência de dose anterior/compatibilidade de classe.
- As regras B19 mantêm os resultados da tabela. A fêmea jovem continua na janela de avaliação; o registro legado não vira comprovação canônica de conclusão.
- O histórico legado continua exibindo declarações de vacinação e casos. O snapshot atualizado reconhece essa diferença factual, sem apagar dados ou reescrever o baseline histórico R05.

Não foi observado conflito desses três registros com a **publicação de configuração** CLO/LEP. Eles não podem ser usados como homologação de execução, prova de elegibilidade B19 ou conclusão da R05 original. Homologação operacional futura exige seu próprio escopo e dados adequados.

## Integridade reexecutada

| Verificação | Resultado |
|---|---|
| Migration SHA256 | `c490630d646a9d99a8fc424c07cc73f73485b6e6bd5ae2d5b6a5582f06e29e59`, exato |
| Digest do delta | `55a71d9f4adb6b4fcbbfe9cd5d26ee8c15fd4fc99f1106b50d02dc830ca877e4`, exato; oito inputs íntegros |
| Catálogo completo desde o primeiro preflight R04B.3 | 20 itens, dez protocolos, 16 fontes, 71 coberturas, três produtos, oito classes e vínculos produto/fonte iguais em todas as linhas |
| Curadoria | Sete aprovações anteriores e cinco decisões preservadas; zero candidatas publicadas |
| Contratos SQL | Quatro definições, owners, ACLs e configurações iguais ao snapshot anterior |
| Migrations | 63 versões/nomes exatos; migration `20261020232807` continua ausente |
| Agendas/gates | Sete Agendas completas iguais ao baseline R04B; gates completos iguais e OFF |
| R05 v2 | Ledger de 15 recibos e fechamento original completos iguais; cancelamento existente é de 20/10, não foi criado pela transação posterior |
| Três Eventos reconhecidos | Eventos, detalhes e casos completos iguais nas leituras desta investigação |
| Estoque | Zero movimentos na fazenda de homologação |
| CLI canônico local | `--validate --incremental` aceitou o pacote exato; nenhum dry-run/apply remoto foi executado |
| Evidência original | Quatro arquivos R05 iguais ao HEAD e manifesto R04B.2 sem divergência |

A primeira consulta ampliada do snapshot encontrou coluna `id` inexistente em uma relação composta. Foi corrigida somente a ordenação da consulta para a representação JSON da linha; a consulta read-only foi repetida com sucesso. Nenhum schema foi alterado para acomodar o diagnóstico. Não se repetiram baterias globais, builds ou R05.

## Impedimento adicional

O snapshot anterior R04B.3, de `08:16:39 UTC`, continha três Eventos R05. O novo snapshot contém quatro Eventos e quatro animais, preservados integralmente:

- Evento comercial **`b8e1aadb-0df6-4d0f-8a7c-23f1bda5fdd3`**, criado em `2026-10-21T10:02:14.836115Z`, `payload.kind=commercial_operation_v2`.
- Animal **`4cfe67bd-e318-4c9d-847f-f11e7dc5e32f`**, identificação **F001**, criado no mesmo timestamp.
- Transação `07bd224c-b299-4903-b128-8e112f1d88fc`; mesmo cliente de navegador dos registros B19. O novo animal não declara o marcador sintético R05 dos três fixtures originais.

Não se presume irregularidade da operação comercial. Contudo, ela é outra mudança factual não abrangida pelo reconhecimento dos três Eventos, e amplia o universo de animais sobre o qual regras futuras poderão ser avaliadas. Sua finalidade/aceitação não foi estabelecida nesta autorização. Nenhuma classificação de “execução real” é inferida do nome F001 ou da ausência de marcador sintético.

Por essa diferença adicional, **não se emite `PREFLIGHT_READY_FOR_RESUMPTION`**. O impedimento original relativo aos três registros foi tecnicamente esclarecido; o bloqueio remanescente é o baseline protegido ter outras alterações não avaliadas/reconhecidas, e não uma corrupção presumida ou uma mudança do digest.

Para uma retomada posterior, revisar a operação comercial e o novo animal, definir o baseline aceito preservando todos os fatos e revalidar ausência de alterações concorrentes. Esta entrega não solicita exclusão/correção automática e não autoriza escrita remota.
