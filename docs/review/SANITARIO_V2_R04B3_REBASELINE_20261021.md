# R04B.3 — rebaseline operacional aceito e retomada condicionada

**PREFLIGHT_READY_FOR_RESUMPTION.** O bloqueio anterior baseado na existência dos três Eventos B19 e da operação comercial F001 está superado pela decisão expressa do proprietário nesta etapa. São alterações operacionais posteriores identificadas; não se exige que a fazenda inteira permaneça congelada para publicar catálogo global.

**Publicação não executada.** A última autorização expressa concedida para operações remotas foi somente leitura e excluiu migration/publicação. O pedido atual condiciona essas escritas a autorização expressa válida já existente e determina solicitar a autorização faltante. Não se reinterpretou a autorização de leitura como autorização de escrita.

## Baseline confirmado

Projeto `zqloazqzhwauamcejmuz` (RebanhoSync, ACTIVE_HEALTHY). Branch `codex/sanitario-v2-convergencia`, HEAD `b5b6ffc9f515874577003efd2cce3ef4492bdb74`. Worktree `C:/Users/mares/.codex/worktrees/r04b2-certificacao/GestaoAgro`.

Snapshot read-only: **21/10/2026 10:55:24 UTC**.

- [Baseline aceito, com read-set curatorial e dados operacionais separados](evidence/SANITARIO_V2_R04B3_ACCEPTED_OPERATIONAL_BASELINE_20261021.json).
- [Comparações, política de concorrência, recibos e autorização faltante](evidence/SANITARIO_V2_R04B3_REBASELINE_RESULT_20261021.json).

Os 36 arquivos do manifesto R04B.2 e os oito inputs do delta continuam íntegros. Migration SHA256: `c490630d646a9d99a8fc424c07cc73f73485b6e6bd5ae2d5b6a5582f06e29e59`. Digest do delta: `55a71d9f4adb6b4fcbbfe9cd5d26ee8c15fd4fc99f1106b50d02dc830ca877e4`.

Nenhum código, migration, publicador, guard ou input certificado foi alterado. O arquivo canônico continua com `import_real_authorized=false`. A validação pública local `--validate --incremental` passou para o pacote exato.

## Read-set curatorial protegido

| Conjunto | Comparação observada |
|---|---|
| Migrations | 63 versões/nomes iguais ao esperado; `20261020232807` ausente |
| Funções/ACLs | Quatro definições curatoriais, owners, ACLs e configurações iguais ao snapshot anterior |
| Protocolos/versões | Dez protocolos e 20 itens com todas as linhas iguais; sete aprovações preservadas; zero candidatas publicadas |
| Fontes/coberturas | 16 fontes e 71 coberturas com linhas completas iguais |
| Classes/produtos/vínculos | Oito classes, três produtos e zero vínculos produto/fonte, sem mudança de conteúdo |
| Decisões | Cinco recibos e requests iguais à execução R04 original; IDs e digests conferidos individualmente |
| Triggers aplicáveis | Sete definições capturadas e inspecionadas; timestamps da própria linha e validações de parent/scope/grupo, sem escrita operacional ou recálculo |
| Pacote | Hashes e digest certificados exatos; nenhuma alteração para acomodar o novo baseline operacional |

Mudança nesse read-set que possa invalidar CAS, autorização, evidência, compatibilidade ou integridade deve interromper a tentativa de publicação. Não substituir versões ou digests silenciosamente. A reconfirmação deve ocorrer imediatamente antes da futura escrita; esta leitura não promete imutabilidade futura do servidor.

## Dados operacionais preservados

Os quatro Eventos e quatro animais reconhecidos pelo proprietário permanecem com IDs, timestamps e conteúdo completo. Não se presume execução física, autoria humana ou finalidade de teste e não se marca F001 como sintético.

Desde o snapshot de 10:26:49 UTC, foram observadas linhas iguais para:

- quatro animais e quatro Eventos;
- três detalhes sanitários e três casos associados;
- sete Agendas e sete vínculos de animal/Agenda;
- um fechamento original e 15 recibos da R05;
- gates OFF, configuração observada, zero Agendas legadas e zero movimentos de estoque.

As sete Agendas também coincidem integralmente com o baseline histórico R04B. O histórico R05 original permanece preservado em seus arquivos; os relatórios anteriores registram o que era conhecido em cada momento e não foram reescritos. Este documento altera a classificação vigente do impedimento, conforme a nova decisão do proprietário.

Novas operações independentes em outras tabelas serão registradas como diferenças observadas. Elas só exigem investigação adicional quando houver dependência técnica ou efeito concreto no read-set protegido, no escopo de escrita ou nas invariantes desta publicação. Contagem de Eventos/animais diferente de zero ou da R05 histórica não é bloqueio automático.

## Escritas e efeitos efetivamente previstos

Leitura do caminho público `--incremental`, `applyTransaction`/`writeOperation`, migration e triggers remotos confirmou:

1. **Migration:** define/substitui três funções curatoriais. O lote certificado registra exclusivamente a versão `20261020232807`, mantendo histórico 63→64. Não executa a função de decisão, não altera grants/RLS e não atualiza animais, Eventos, Agendas ou produtos. DML dentro do corpo de `sanitario_catalog_decide_v2` só ocorre se a RPC for chamada; sua chamada continua proibida.
2. **Delta:** o writer canônico escreve somente em `sanitario_protocolo_itens_versions_v2`, `sanitario_fonte_cobertura_campos_v2`, `sanitario_product_classes_v2` e `sanitario_produto_fontes_v2`. São esperadas 15 criações e sete atualizações: cinco candidatas, oito coberturas, dois vínculos, duas revisões de classe e cinco supersessões draft. Isso é plano, não recibo de execução.
3. **Pais:** fontes, produtos comerciais e protocolos são referências existentes somente leitura na importação incremental. Não há seed completo, seleção antecipada de produto ou autorização de execução para a classe inteira.
4. **Operacional:** não existe comando de recálculo, chamada ao writer de Evento/animal/Agenda ou execução do plano de fazenda nesse caminho. Triggers dos alvos não recalculam nem modificam os novos registros operacionais. Não há alteração de sync ou schema de tabelas.
5. **Contratos preservados:** advisory lock, locks/CAS dos pais e versões, identidade física, preservação dos snapshots anteriores, rollback transacional, integridade referencial, gates OFF e replay continuam no mesmo código certificado. Evidência local R04B.2 de 17 cenários foi reutilizada; não houve reexecução da auditoria ou da R05.

## Comparação proporcional antes/depois da futura publicação

- Migration: exigir somente as três alterações esperadas de definição e o registro exato de histórico, com ACLs/autenticação preservadas e sem DML operacional.
- Delta: conferir os IDs/versões e valores esperados nas quatro tabelas de escrita, incluindo cinco supersessões e ausência de duplicidade. Pais somente leitura, sete aprovações e cinco decisões anteriores permanecem iguais. Replay deve produzir zero novas criações/atualizações.
- Operacional: preservar os registros conhecidos e suas referências; conferir que o publicador não escreveu/recalculou dados operacionais. As sete Agendas e gates seguem protegidos. Novas linhas independentes fora do escopo são observações, sem exigência de uma fazenda globalmente imutável.
- Previews: cinco individuais e dois grupos, obtidos por sessão real do curador, depois da publicação; não usar claims fabricadas nem produzir digests remotos antes da execução.

O lote SQL certificado mantém uma guarda conservadora de igualdade de dados **dentro de sua própria transação**. Ela aceita os quatro Eventos existentes; não compara a contagem atual com o antigo zero. Um commit operacional independente no breve intervalo pode abortar essa tentativa por concorrência. Nesse caso, preservar os fatos, reconfirmar o read-set protegido e classificar a tentativa/retry corretamente; não chamar isso de corrupção, não remover a guarda nem reabrir investigações sem efeito técnico. Não se exige congelamento entre as etapas da publicação.

## Estado final e autorização estritamente faltante

Pré-condições técnicas protegidas coincidiram. **Não resta bloqueio curatorial ou operacional demonstrado para preparar a retomada.** A autorização remota expressa para migration/publicação é a pendência atual.

Autorizar exclusivamente, no projeto `zqloazqzhwauamcejmuz`:

1. Reconfirmar o read-set protegido imediatamente antes de escrever.
2. Executar dry-run e aplicação do lote da migration `20261020232807`, SHA256 acima, sem outras migrations.
3. Publicar apenas o delta de digest acima pelo importador canônico incremental.
4. Conferir integridade, preservação e replay; obter cinco previews individuais e dois agrupados por autenticação real; encerrar em `AWAITING_CURATORIAL_APPROVAL`.

Essa autorização exclui decisões CLO/LEP, chamada a `sanitario_catalog_decide_v2`, gates ON, homologação R05, correção de dados operacionais, deploy, push e merge. Aprovações continuarão dependentes dos digests reais e de autorização específica posterior.

Nesta etapa foram feitas uma consulta SQL read-only, uma leitura dos dados do projeto, validação local do pacote e inspeção dirigida dos efeitos. Nenhuma escrita remota foi realizada; nenhuma candidata foi publicada/aprovada e nenhum preview autenticado remoto novo foi obtido. `git diff --check` e links locais foram conferidos no fechamento.
