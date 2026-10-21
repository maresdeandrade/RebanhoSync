# R04B.4 — revisão final e recomendação curatorial

## DECISÃO

- **Revisão técnica:** sem regressão de runtime confirmada não tratada no escopo prioritário. Código/dependências permanecem iguais ao HEAD certificado `000de171358c1be57804c31cbfe6ed6c5d194c86`; o delta desta etapa é documental.
- **Integração:** main atual `315fd86eb59f400b4b9cf7a5b4666bef9cd5a97b` contida na branch `codex/worktree-consolidation-20261021`. Integração/publicação remota não executada.
- **CLO:** recomendação **APPROVE**, somente para os três itens/versionamentos bovinos capturados e seu planejamento condicionado.
- **LEP:** recomendação **APPROVE**, somente para os dois itens/versionamentos bovinos capturados, com reforço anual.

As duas recomendações são juízo de revisão (**INFERRED**) apoiado em fatos confirmados, não autorização nem decisão técnico-veterinária de aplicação. R04B.3 permanece **AWAITING_CURATORIAL_APPROVAL**; cinco candidatas em draft e `allows_agenda_auto=false`. Nenhuma chamada de `sanitario_catalog_decide_v2` foi realizada.

[Evidência estruturada desta revisão](evidence/SANITARIO_V2_R04B4_FINAL_REVIEW_20261021.json) · [Conteúdos completos dos sete previews](evidence/SANITARIO_V2_R04B3_AUTHENTICATED_PREVIEWS_POSTCONSOLIDATION_20261021.json) · [Avaliação autenticada anterior](SANITARIO_V2_R04B3_PREVIEWS_POSTCONSOLIDATION_20261021.md).

## EVIDÊNCIAS

**CONFIRMED — rebaseline:** `git fetch origin main` não encontrou avanço da main; divergência inicial 0/28, principal limpo e seis worktrees existentes. Foram conferidas as 347 cópias do backup, os dois bundles pelos hashes já verificados e o objeto do stash de recuperação. Os 303 arquivos das origens F24/R04B2/C2 continuam idênticos aos snapshots preservados. Não houve checkout, merge, limpeza ou alteração de ambientes.

**CONFIRMED — catálogo remoto:** SELECT atual comparou as 19 linhas dos grupos com as capturas certificadas, sem drift. As definições das quatro rotinas curatoriais coincidem por fingerprint com o snapshot publicado; ACLs observadas mantêm as RPCs públicas em authenticated e os helpers fora do client. Contagens: 64 migrations, sete Agendas R05, quatro Eventos R05, cinco decisões e zero gates habilitados. Nenhum preview foi repetido. Isso confirma o conteúdo no instante do SELECT; não assegura que continuará igual até uma decisão futura.

**CONFIRMED — revisão do código:** foram reexaminados o diff `origin/main...HEAD`, as permissões dos comandos de planejamento, fila por fazenda, CAS/identidades imutáveis, proteção de pending, ACK/reconciliação, refresh único após HTTP 401, recuperação, vínculos factuais e autorização de produto/esquema. Os guards não foram enfraquecidos. As mudanças anteriores de testes/mocks e o vínculo à fixture histórica permanecem justificados pelo contrato implementado. Não surgiu defeito demonstrado que autorizasse um patch de runtime.

Não foram incorporados caches, node_modules, dist ou arquivos de ambiente. O cache `supabase/.temp/cli-latest` da R04B2 permanece fora do diff. Os grandes JSON e os dois gzip do histórico são evidência intencional; resultados de testes locais com claims de fixture não são apresentados como sessão humana remota. O único overlap histórico main/origem sanitária permanece `OPERATIONAL_FLOWS.md`, com texto normativo mais recente preservado.

**Validação proporcional:** rebaseline e fingerprints atuais, integridade dos backups, leitura das duas fontes oficiais e validações documentais desta entrega. `check-docs.mjs` aceitou o JSON, conferiu digests preservados e os três links locais; `node scripts/antigravity/run_bash.mjs scripts/antigravity/docs_gates.sh` retornou exit 0. Reutilizados 2.163 casos distintos, seis skips, 17 cenários PostgreSQL, baseline funcional local com 64 migrations, lint/build development e a avaliação dos sete previews. Não é uma execução global única verde. Os logs desta etapa estão na pasta privada R04B4.

**NOT_TESTED:** nova regressão global/E2E/build sem delta de runtime; dispositivos físicos; build de produção; transporte operacional remoto R05 contract v2; inventário completo de cwd/handles de programas externos. Ausência de achados na revisão prioritária não comprova todos os caminhos possíveis em produção.

## CURADORIA

O texto de entrada trouxe um digest LEP truncado. O valor de 64 caracteres abaixo vem da evidência certificada; nenhum digest, conteúdo ou plano foi alterado para acomodar o texto colado. Os sete conteúdos completos e seus hashes já conferidos foram reutilizados.

### CLO — APPROVE no escopo de planejamento

**Digest:** `83b5fe310eac94e2d9912bd425e1e147b4263e2ccaab594f5fc2c11a592410b3`.

**Fundamento confirmado:** a [bula oficial Fortress 7, página 1](https://www2.zoetis.com.br/content/pt/pages/Especies/Bovinos/Bulario/_assets/Fortress-7.pdf), consultada em 21/10/2026, prevê uso em bovinos sadios, série inicial com duas aplicações separadas por 4–6 semanas e revacinação anual. A janela de 28–42 dias e o reforço anual capturados são coerentes com essa variante.

**Juízo:** recomendar a aprovação das versões 3/4/3 de dose 1, dose 2 e reforço anual. Dose 2 depende da primeira execução factual compatível; o reforço exige a série inicial completa ou o reforço factual compatível anterior. A intenção não deve ser calculada a partir de Agenda concluída ou estado atual sem fato apropriado.

**Limites:** a fonte não autoriza toda vacina clostridial nem bubalinos. Não selecionar previamente produto, dose, via ou carência na regra por classe. Adequação clínica, condições do animal e campos não comprovados de idade/gestação/lactação exigem avaliação responsável na execução, com a evidência do produto real. Esta revisão não certifica registro comercial vigente ou intercambialidade de formulações.

### LEP — APPROVE no escopo de planejamento

**Digest:** `f80230a1aa845e3659a939f8cb118c3b3a39d10e234efe99844f8bcf5ef62bc1`.

**Fundamento confirmado:** a [bula oficial Leptoferm 5/2 mL, página 1](https://www2.zoetis.com.br/content/pt/pages/Especies/Bovinos/Bulario/_assets/Leptoferm5.2.pdf), consultada em 21/10/2026, descreve dose inicial única em bovinos e revacinação anual. A série inicial dupla ali descrita se refere a suínos; não deve ser transferida aos bovinos desta variante.

**Juízo:** recomendar as versões 3/3 da dose inicial e do reforço. O contexto de risco restringe a primeira intenção; não é licença universal para aplicar vacina. A chave legada `lepto_reforco_anual_semestral` tem recorrência **annual** na versão 3. Não foi recomendada periodicidade semestral. O reforço depende de execução factual compatível.

**Limites:** não validar uma segunda dose bovina genérica, a classe inteira, outra formulação, bubalinos ou suínos por esta aprovação. A seleção do produto e as condições clínicas/reprodutivas não resolvidas permanecem na avaliação responsável de execução. O texto de licenciamento da bula não comprova, por si só, vigência atual de registro comercial.

### Alternativas e consequências, separadas da recomendação

| Alternativa | CLO | LEP | Efeito de eventual decisão canônica futura |
|---|---|---|---|
| APPROVE | Recomendada, somente versões 3/4/3 | Recomendada, somente versões 3/3 e anual | Ativa os itens/protocolo selecionados e seus flags prospectivos no catálogo; não cria por si Agenda, Evento, estoque ou carência, não aprova produto e não liga gate de fazenda. |
| REJECT | Cabível se o proprietário não aceitar esse escopo | Cabível se o proprietário não aceitar esse escopo | Registra rejeição auditável; as candidatas permanecem sem habilitação. A RPC não as exclui nem promove. |
| REQUIRES_REVISION | Se for preciso mudar espécie, janela ou evidência | Se for preciso mudar esquema, risco, espécie ou periodicidade | Mantém draft/flags OFF; nova proposta técnica/versionada e novos previews, sem editar os digests existentes. |

`blockers=[]` só demonstra que os guards implementados aceitaram o conteúdo da consulta. As recomendações acima decorrem da análise dos itens e das fontes, não desse campo isoladamente. O catálogo permite decisão global sem exigir fazenda ou veterinário executor; isso não dispensa avaliação clínica qualificada quando necessária para aplicar um produto a animais concretos.

**BLOCKED por ausência de autorização expressa:** qualquer aprovação/rejeição real para os dois digests. Antes dessa operação futura, reconfirmar conteúdo, versão e digest atuais na sessão autorizada. Não há request_id de decisão ou aprovação fabricada nesta entrega; automação, gates e validação de execução permanecem desabilitados.

## PR

**Título:** `feat(sanitario): consolida planejamento e curadoria V2`.

**Decisão de revisão:** `READY_FOR_PR_REVIEW`, com checks documentais concluídos. A aprovação curatorial e o rollout não são dependências para revisar o código com gates OFF; suas pendências permanecem explícitas no corpo do PR. Não houve publicação remota.

**Escopo e divisão:** manter um PR consolidado é tecnicamente justificável: o merge preserva autoria/histórico e as migrations, callers, testes e evidências têm dependências cruzadas. O volume é dominado por snapshots de evidência. Separá-los retroativamente sem uma fronteira independente comprovada exigiria remontar o histórico; não foi feito rebase, cherry-pick duplicado ou split. A revisão pode ser organizada em catálogo/RPC, planejamento/sync, execução factual e evidências.

**Dependências e ressalvas:** ambiente novo precisa aplicar as migrations forward-only do código em uma operação autorizada; o remoto consultado já tem as 64 migrations e não precisa de reaplicação. Catálogo global aprovado não aprova produto ou execução. O empacotador de decisões de 20261016 continua corretamente recusando `CANONICAL_HASH_MISMATCH` contra o payload atual e não é input de release desta revisão. Essa limitação histórica não foi contornada.

O título, a descrição completa e o checklist do template atual estão preparados na pasta privada `C:\Users\mares\.codex\recovery\RebanhoSync-20261021-R04B4`. Nenhum teste, issue ou capability_id foi inventado.

- [x] Conteúdo e digests certificados preservados; truncamento do texto colado identificado.
- [x] Main atual contida; código/dependências sem delta funcional novo; revisão prioritária concluída.
- [x] Recomendação CLO e LEP independente de autorização de execução.
- [x] Nenhum push, PR remoto, merge, deploy, migration, decisão, gate ou remoção executado.
- [ ] Publicação do PR: exige autorização específica do proprietário.

## WORKTREES

| Checkout | Classificação | Evidência e dependência |
|---|---|---|
| Principal | PRESERVE | Diretório de desenvolvimento; limpo no rebaseline. |
| F24.6A1 | PRESERVE | 18 pendências e variantes de harness preservadas, ainda não descartadas. |
| Kilo | PRESERVE | Processo Kilo 27964 ativo; não presumir liberação. |
| R04B2 | Candidato técnico à aposentadoria | 68 pendências originais, nenhum commit exclusivo. Arquivos úteis incorporados; cinco recibos diferem só pelo BOM corrigido, dois documentos receberam atualização, um difere só no EOF, e o cache CLI foi excluído intencionalmente. Dois testes exclusivos em scratch estão copiados e conferidos no backup; não são dependência do runtime. |
| Animal Detail C2 | Candidato técnico à aposentadoria | Cinco arquivos originais preservados; três idênticos ao consolidado e diferenças restantes superadas pela evolução comercial da main. Sem commit exclusivo. |
| Temporário de consolidação | Candidato técnico à aposentadoria | Limpo em e5da4de, sem commit exclusivo, gerenciado e anexado a este chat. |

Os candidatos não têm alterações úteis exclusivas sem preservação demonstrada. Não se observou referência aos três caminhos nos argumentos dos processos node/deno/kilo/codex examinados, e a listagem consultada mostrou este chat ativo no principal. **NOT_TESTED:** ausência absoluta de handles/cwd de todos os programas externos. Logo, a liberação operacional é **INFERRED**, devendo ser reconfirmada no momento da retirada nominal; não é bloqueio à revisão do PR. Nenhum diretório, branch, backup ou stash foi removido. Comandos exatos futuros constam de `WORKTREES_R04B4.md` na pasta privada da revisão.

## PRÓXIMO PASSO

O proprietário deve autorizar separadamente: push da branch/criação do PR remoto; eventual merge/deploy; eventual decisão curatorial para cada digest exato; ativação/homologação operacional; retirada nominal de R04B2, C2 e/ou temporário. Nenhuma dessas operações está implícita nas recomendações ou no estado READY_FOR_PR_REVIEW.
