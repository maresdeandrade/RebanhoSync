# Sanitário V2 — proposta de ativação preparada

Atualizado em: 2026-10-17
Baseline remota verificada: `bf43c631685013dca7f8c03066e8f5b251683e57`.
Escopo: resolver campos comprováveis dos oito conjuntos candidatos e preparar assinatura/importação de rascunhos; nenhuma aprovação ou publicação operacional.

## Decisão

**Um dos 14 itens está tecnicamente pronto para submissão global à aprovação: B19, exclusivamente como avaliação genérica.** Seis manejos estão preparados sem produto comercial, mas dependem do contexto real e da decisão responsável da fazenda. Sete itens comerciais têm produto/formulação, apresentação e esquemas documentados; permanecem sem habilitação por campos concretos ainda não comprovados. Não contar formulários preparados ou fixtures como aprovação efetiva.

O responsável solicitado nesta conversa ainda não foi informado. Nome, identificação profissional/CRMV-UF, ator, data, referência e assinatura permanecem em branco. Portanto, há **zero formulários assináveis com responsável já identificado** e zero aprovações concedidas.

O pacote `SANITARIO_V2_FECHAMENTO_DECISOES_20261016.json` evoluiu para schema 2, mantendo o nome e as identidades propostas. O payload canônico 12F10 não foi alterado. Este relatório atualiza o estado de preparação/integracão do fechamento anterior, sem substituir fatos históricos.

## Oito conjuntos: estado final e condição objetiva

| Conjunto | Itens | Estado de submissão | Resolvido nesta entrega | Campos/condições restantes |
|---|---:|---|---|---|
| B19 | 1 | Pronto para revisão global | Referências normativas completas nos campos `eligibility_rule`, `operational_window` e `product_requirement`; versão física v3 já proposta | Responsável identificado e assinatura vinculada ao hash; publicação conjunta de status/fontes/permissões por writer autorizado |
| CLO | 3 | Evidência comercial pendente | Fortress 7 identificada; registro histórico 5.893/1997; apresentação 50/250 mL; esquema 5 mL SC, inicial + 28–42 dias e anual | Vigência atual do registro; critério etário/categoria responsável; permissões/restrições de gestação e lactação |
| LEP | 2 | Evidência comercial pendente | Leptoferm 5/2 mL identificada; licença 5.037 de 15/03/1995; frascos de 10/50 doses; inicial única bovina e anual, 2 mL IM | Vigência atual; critério etário/categoria responsável; gestação/lactação. Nenhuma dose 2 bovina ou recorrência semestral autorizada |
| IBR | 2 | Evidência comercial pendente | Poliguard selecionada apenas como proposta; página MSD com apresentação 100/250 mL, 5 mL SC, duas doses 21–30 dias, anual e condição etária materna; registro histórico 9.299/2007 | Titular e vigência atuais; bula integral vigente; lactação. Lista de 2014 informa fabricante Vallée S/A, não comprova titular atual |
| PAR | 3 | Instanciar contexto da fazenda | Três versões de `manejo_sanitario`, produto `none`, sem dose/via; campos persistentes de calendário e recria identificados | Fazenda/UF/região/sistema/categorias; calendário adotado; referência e decisão responsável por campo; contrato de fonte MV abaixo |
| DES | 1 | Instanciar contexto da fazenda | Avaliação genérica, produto `none`; sistema intensivo/leiteiro ou orientação MV referenciada | Fazenda/contexto real, `preWeaningBasis`, referência responsável; contrato de fonte MV |
| CONF | 1 | Instanciar contexto da fazenda | Avaliação genérica, produto `none`; data, referência, alvos e manejo previstos | Fazenda/contexto, `scheduledContext`, destino/manejo e decisão responsável; contrato de fonte MV |
| PARTO | 1 | Instanciar contexto da fazenda | Avaliação genérica, produto `none`; contexto reprodutivo e intervenção limitada à avaliação | Fazenda/contexto individual, data/referência/alvos, fêmea/contexto pré-parto e decisão responsável; contrato de fonte MV |

Cada conjunto conserva decisão única e versões exatas no formulário derivado. Os três itens de raiva permanecem sugestões com `no_agenda_auto`; os dois de aftosa e LEP2 canônica permanecem bloqueados, com registros inalterados.

## Evidência comercial e seus limites

- **Fortress 7:** a [bula Zoetis já registrada](https://www2.zoetis.com.br/content/pt/pages/Especies/Bovinos/Bulario/_assets/Fortress-7.pdf) sustenta espécie bovina, dose/via e esquema. O [catálogo primário Zoetis, página impressa 186/PDF 176](https://www.zoetis.com.br/global-assets/private/revista-zoetis-net-paginas-mistas-versao-30-01.pdf) comprova apresentação; é histórico. A [lista MAPA de 15/04/2014, página 78](https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/insumos-pecuarios/produtos-veterinarios/listas/Lista_produtos_vigentes_abril2014.pdf/@@download/file/Lista_produtos_vigentes_abril2014.pdf) comprova número histórico e titular Pfizer naquela data. Não comprova vigência atual ou autorização bubalina.
- **Leptoferm:** a [bula primária Zoetis v2](https://www2.zoetis.com.br/content/pt/pages/Especies/Bovinos/Bulario/_assets/Leptoferm5.2.pdf) identifica fabricante Zoetis Inc., importador brasileiro, apresentação e licença histórica. Bovinos têm inicial única; o esquema de duas iniciais descrito para suínos não é transferido. Ausência de informação reprodutiva não vira permissão.
- **Poliguard:** a [página primária MSD](https://www.msd-saude-animal.com.br/produto/poliguard/) é resumo, com posologia, apresentação, supervisão MV e gestação expressa. Filhos de mães vacinadas: primeira dose após quatro meses. A lista MAPA de 2014, página 137, informa registro 9.299/2007 e Vallée S/A. A página comercial atual não prova titularidade/vigência regulatória atuais ou bula integral.
- **Alternativa IBR documentada, não selecionada:** [Bovigen Repro Total SE/Virbac](https://br.virbac.com/products/biologicos/bovigen-repro-total-se), apresentação 100/250 mL, possui condições reprodutivas e composição próprias. Não substitui Poliguard nem recebe sua autorização por equivalência.

Consultas direcionadas a páginas do fabricante e ao diretório/painel MAPA não forneceram prova individual de vigência atual dos três produtos. Números de registro históricos foram preservados como históricos. Nenhum contato com terceiros foi enviado. Os 18 produtos genéricos legados não foram renomeados nem convertidos por inferência. O candidato acrescenta somente três registros comerciais novos em `precisa_validar`, sem autorizações de espécie/dose/carência ou vínculo automático aos sete itens.

Idade, reprodução e carência desconhecidas continuam explícitas. Carência desconhecida não exige inventar prazo nem bloquear a avaliação genérica; execução e cálculo factual continuam exigindo produto/fonte próprios.

## Contexto e contrato de fonte responsável

As seis novas versões propostas são Agendas de avaliação/manejo, sem produto, dose, via ou carência. As condições utilizam os campos do plano persistente existente: `regionalCalendar`, `management`, `preWeaningBasis`, `scheduledContext` e `reproductiveContext`, além de UF/categoria do animal. O formulário solicita região, sistema e referência responsável; nenhum valor de fazenda real foi inventado.

A [recomendação Embrapa registrada](https://www.infoteca.cnptia.embrapa.br/bitstream/doc/562842/1/rectec26.pdf) continua apoio regional, não fonte forte global. Não se pede produto comercial para aprovar avaliação. A referência sazonal não comprova data individual de parto, e programação de confinamento não comprova movimento executado.

**Lacuna implementada e verificável:** `sanitarySourceV2.ts:hasStrongSourceCoveringFieldV2` e `validateTechnicalSourceV2` exigem `SIM_BULA` ou `SIM_NORMA` para fonte forte, embora exista `kind=mv_responsavel`. Não há estado explícito de decisão MV assinada no contrato atual. O pacote registra o pedido de fonte por fazenda como `NOT_ISSUED`, sem inventar norma/bula nem assinatura. Materializar essas decisões como fontes fortes exige resolver esse contrato ou apresentar fonte técnica existente que realmente cubra os campos. Nenhum schema, enum, migration ou guard foi relaxado nesta tarefa.

## Assinatura e integridade do candidato

O preparador `scripts/codex/prepare-sanitario-approval-v2.mjs` combina o canônico e o pacote, valida hash/identidade/versões e gera um candidato determinístico para revisão. Reutiliza o contrato e o importador existentes; não contém conexão, writer, motor de automação ou concessão de aprovação.

- Canônico preservado: SHA-256 `51df1c3884f463992113d0d3ac89e3c9534ce68726e9829972838cae2132cf73`.
- Pacote schema 2: SHA-256 `c6188840bf1ac1d24958d684499a911abf6781db1613733640a90e23d7c04bc3`.
- Candidato determinístico: SHA-256 `567d3d4064c0ab5f680cb7f267906840b76882c2a180295b0485f702e2101692`.
- `SANITARIO_V2_APROVACAO_PENDENTE_20261017.json`: formulário separado com oito decisões, 14 IDs/versões físicas, versões anteriores esperadas, condições e assinatura nula. Vincula o hash exato do candidato e do pacote; a futura assinatura deve ser separada, evitando referência circular ou mutação silenciosa do conteúdo revisado.

`--review-candidate` só aceita validação/dry-run. Recusa `--apply` antes de ler arquivo/conectar, e dry-run recusa destino remoto ou query string capaz de substituir o hostname do PostgreSQL. O fluxo original do canônico e seus gates permanecem preservados.

## Ambiente e sequência executável de publicação

**Fato observado por leitura de metadados:** `list_projects` encontrou apenas um RebanhoSync ativo (`zqloazqzhwauamcejmuz`, PG 17.11); `list_branches` retornou somente a branch default `main` apontando para o próprio projeto. Não foi encontrado staging distinto entre os projetos acessíveis. Os demais projetos são inativos e não são alvos desta tarefa.

O roteamento do frontend Production não foi novamente certificado ao vivo. Os documentos F24.1B/C preservam o compartilhamento histórico, mas reclassificaram esse backend como integração descartável; isso não comprova isolamento. Para esta publicação, o projeto compartilhado permanece proibido. Nenhum projeto foi criado, vinculado, reativado ou alterado.

**Executável agora, somente local:**

```powershell
$candidateDir = Join-Path $env:TEMP ('sanitario-review-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $candidateDir | Out-Null
$candidateFile = Join-Path $candidateDir 'candidate.json'
node scripts/codex/prepare-sanitario-approval-v2.mjs --validate
node scripts/codex/prepare-sanitario-approval-v2.mjs --out $candidateFile
node scripts/codex/import-sanitario-protocols-v2.mjs --validate --review-candidate $candidateFile
$env:SANITARIO_PGLITE_MODULE_ROOT = Join-Path $env:TEMP 'sanitario-v2-pglite-20261014/node_modules'
node tests/codex/sanitario-v2-approval-dryrun.mjs
```

O dry-run usa as dependências externas já existentes e um banco WASM novo em memória, loopback `127.0.0.1:55434`. Não usa `.env`, backend hospedado ou banco local persistente. Os scripts preservam arquivos existentes; `--out`/`--approval-form` recusam sobrescrita.

**Sequência remota futura, bloqueada até autorização específica e evidências:**

1. Identificar/provisionar staging dedicado e registrar ref, finalidade, responsáveis e vínculo exclusivo de Preview. Rejeitar `zqloazqzhwauamcejmuz`; conferir URLs de API/Functions, Auth e credenciais próprias, sem copiar dados/usuários. Aplicação de baseline/deploy somente em tarefa autorizada e compatível com a main então atual.
2. Resolver os campos dos dossiês e instanciar os contextos reais; resolver o contrato da decisão MV e o publicador de aprovação abaixo. Regerar candidato/formulário, revisar diff/versões e coletar assinatura identificada contra seus hashes.
3. Publicar primeiro rascunhos pelo importador canônico existente, após adoção formal do novo artefato canônico e autorização específica. A CLI de candidato desta entrega deliberadamente não é um caminho de `--apply`. `import_gate.import_real_authorized`, autorização de alvo e dry-run remoto continuam gates independentes.
4. Promover conjuntamente status do protocolo, aprovação/ator/data/referência, vínculos por campo, versão dos itens e permissão automática sob lock/CAS. **Esse publicador de aprovação não existe hoje:** o importador atual força draft/flags falsas e rejeita flags operacionais. Não há comando de ativação executável a alegar. Até existir esse contrato autorizado/testado, esta etapa permanece bloqueada.
5. Smoke no Preview exclusivo, com fazenda sintética: ativar plano explícito; conferir B19/múltiplos protocolos elegíveis, história compatível, manejos configurados, três sugestões e três bloqueios; reavaliar duas vezes, offline/reabrir, cancelar/reagendar e trocar fazenda. Eventos, estoque e carência não podem aumentar por planejamento. O fluxo local já testado não certifica sync multidispositivo; exigir contrato de convergência antes de ampliar rollout.
6. Registrar evidências e decidir promoção separadamente. Não copiar autorização de fixture nem habilitar gate remoto por flag.

Assim, a sequência está executável até validação/homologação local e preparada para importação futura de rascunhos; **a publicação operacional completa não é executável hoje**, por contratos e ambiente ainda ausentes, e não é apresentada como pronta.

## Integração e validação observada

Branch original `codex/sanitario-v2-fechamento` preservada em `1187839`. Worktree reutilizada, limpa antes do trabalho. Nova branch `codex/sanitario-v2-ativacao` criada sobre `origin/main@bf43c631`, com reaplicação limpa dos cinco commits existentes: `052f393`, `6593860`, `f1652bb`, `7920dab`, `4d4b992`. A main é ancestral do HEAD. Comparação dos três arquivos do PR #211 com a main: sem diferenças. Runtime sanitário e motor de automação não foram alterados nesta entrega.

Testes focados observados, com estados finais aprovados: sete de preparação anterior, 11 do candidato/formulário, 151 do publisher, 92 do contrato canônico, 53 dos 20 itens, 18 do plano persistente e 18 da exclusão/rollback/retry do PR #211: **350 testes distintos**. Uma asserção textual antiga foi ajustada à nova assinatura de conexão e passou; duas suítes inicialmente sem variáveis sintéticas foram executadas novamente com loopback e passaram. Nenhuma falha foi convertida em sucesso presumido.

Dry-run real da CLI em PostgreSQL WASM: **exit 0**, 144 criações planejadas, quatro rejeições esperadas de members e oito tabelas envolvidas vazias antes/depois; canônico byte a byte preservado. Evidência: `SANITARIO_V2_ATIVACAO_DRYRUN_20261017.json`. Auth/tenant são pré-requisitos simulados; não certifica RLS hospedada, concorrência real ou escrita transacional.

ESLint focado dos scripts/testes passou. Logs locais: `%TEMP%/sanitario-ativacao-*.txt`. Não executar build/Chromium novamente sem alteração do bundle/runtime; a homologação funcional remota depende do staging e dos contratos listados. Não houve push, merge, migration, deploy, importação ou escrita remota. Os comandos SQL do harness constroem somente o schema descartável em memória.

Gate final: **READY para as ferramentas e artefatos de preparação local; NOT READY para ativação/publicação operacional dos 14 itens**. Dez arquivos de fechamento revisados, entre tracked e novos, sem alterações de runtime, sync, schema ou migration. `pnpm run gates:docs`, ESLint focado e `git diff --check` aprovados. As ressalvas de publicação são os bloqueios explícitos abaixo, não falhas de validação local ocultadas.

## Pendências reais

1. Responsável/contexto da fazenda e campos comerciais individualizados, incluindo vigência regulatória atual.
2. Contrato explícito para fonte MV assinada e publicador transacional de aprovação; ambos preservados como bloqueios concretos, sem contorno por flags.
3. Staging isolado e convergência multidispositivo não certificados; não autorizar publicação/rollout com esta evidência local.
