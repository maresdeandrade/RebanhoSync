# Sanitário V2 — proposta de ativação preparada

> Registro da preparação anterior, com hashes do schema 3. O estado atual, o pacote schema 4, o formulário schema 3 e o mecanismo eletrônico estão em [Aprovação eletrônica V2](SANITARIO_V2_APROVACAO_ELETRONICA_20261017.md). As pendências de implementação do publicador descritas abaixo foram substituídas por essa entrega. A identidade natural do protocolo foi preservada; novas versões físicas pertencem aos itens.

Atualizado em: 2026-10-17
Baseline remota verificada: `bf43c631685013dca7f8c03066e8f5b251683e57`.
Escopo: preparar revisao curatorial, ativacao por usuario da fazenda e conformidade de execucao em etapas distintas; nenhuma aprovacao ou publicacao operacional.

## Decisão

**Revisao curatorial, ativacao da fazenda e execucao sao responsabilidades distintas.** A revisao dos oito conjuntos nao exige o veterinario que futuramente atendera a fazenda. B19 tem os vinculos normativos propostos por campo; as seis regras de avaliacao/manejo podem ser submetidas globalmente com requisitos de contexto definidos, sem indicar uma fazenda hipotetica. A revisao curatorial desses vinculos continua pendente, assim como as evidencias comerciais especificas dos sete itens de produto.

`actor_id`, `approved_at` e `decision_reference` identificam a decisao verificavel do revisor autorizado do catalogo. Nao representam obrigatoriamente um veterinario da fazenda. Nenhuma decisao foi registrada: os campos permanecem nulos. Nome/CRMV do futuro executor nao sao precondicoes para essa revisao, para ativar um plano ou gerar uma Agenda de avaliacao.

O pacote `SANITARIO_V2_FECHAMENTO_DECISOES_20261016.json` evoluiu para schema 3, mantendo nome, IDs e versoes propostas. O formulario derivado agora explicita A) revisao curatorial, B) ativacao pelo usuario autorizado e C) conformidade na execucao. Esta correcao substitui a exigencia antecipada de MV/fazenda do relato anterior. O payload operacional 12F10 nao foi alterado.

## Oito conjuntos: estado final e condição objetiva

| Conjunto | Itens | Estado de submissão | Resolvido nesta entrega | Campos/condições restantes |
|---|---:|---|---|---|
| B19 | 1 | Pronto para revisão global | Referências normativas completas nos campos `eligibility_rule`, `operational_window` e `product_requirement`; versão física v3 já proposta | Decisao curatorial de revisor autorizado vinculada ao hash; publicação conjunta de status/fontes/permissões por writer autorizado |
| CLO | 3 | Evidência comercial pendente | Fortress 7 identificada; registro histórico 5.893/1997; apresentação 50/250 mL; esquema 5 mL SC, inicial + 28–42 dias e anual | Vigência atual do registro; critério etário/categoria responsável; permissões/restrições de gestação e lactação |
| LEP | 2 | Evidência comercial pendente | Leptoferm 5/2 mL identificada; licença 5.037 de 15/03/1995; frascos de 10/50 doses; inicial única bovina e anual, 2 mL IM | Vigência atual; critério etário/categoria responsável; gestação/lactação. Nenhuma dose 2 bovina ou recorrência semestral autorizada |
| IBR | 2 | Evidência comercial pendente | Poliguard selecionada apenas como proposta; página MSD com apresentação 100/250 mL, 5 mL SC, duas doses 21–30 dias, anual e condição etária materna; registro histórico 9.299/2007 | Titular e vigência atuais; bula integral vigente; lactação. Lista de 2014 informa fabricante Vallée S/A, não comprova titular atual |
| PAR | 3 | Revisao global da regra | Três versões de `manejo_sanitario`, produto `none`, sem dose/via; campos persistentes de calendário e recria identificados | Revisao global das fontes por campo. UF/regiao/sistema/categorias/calendario/referencia sao exigidos no plano, nao na revisao global |
| DES | 1 | Revisao global da regra | Avaliação genérica, produto `none`; sistema intensivo/leiteiro ou orientação MV referenciada | Revisao global por campo; `preWeaningBasis` e contexto real exigidos no plano |
| CONF | 1 | Revisao global da regra | Avaliação genérica, produto `none`; data, referência, alvos e manejo previstos | Revisao global por campo; `scheduledContext` e destino/manejo exigidos no plano |
| PARTO | 1 | Revisao global da regra | Avaliação genérica, produto `none`; contexto reprodutivo e intervenção limitada à avaliação | Revisao global por campo; contexto individual, data/referencia/alvos e contexto pre-parto exigidos na geracao |

Cada conjunto conserva decisão única e versões exatas no formulário derivado. Os três itens de raiva permanecem sugestões com `no_agenda_auto`; os dois de aftosa e LEP2 canônica permanecem bloqueados, com registros inalterados.

## Evidência comercial e seus limites

- **Fortress 7:** a [bula Zoetis já registrada](https://www2.zoetis.com.br/content/pt/pages/Especies/Bovinos/Bulario/_assets/Fortress-7.pdf) sustenta espécie bovina, dose/via e esquema. O [catálogo primário Zoetis, página impressa 186/PDF 176](https://www.zoetis.com.br/global-assets/private/revista-zoetis-net-paginas-mistas-versao-30-01.pdf) comprova apresentação; é histórico. A [lista MAPA de 15/04/2014, página 78](https://www.gov.br/agricultura/pt-br/assuntos/insumos-agropecuarios/insumos-pecuarios/produtos-veterinarios/listas/Lista_produtos_vigentes_abril2014.pdf/@@download/file/Lista_produtos_vigentes_abril2014.pdf) comprova número histórico e titular Pfizer naquela data. Não comprova vigência atual ou autorização bubalina.
- **Leptoferm:** a [bula primária Zoetis v2](https://www2.zoetis.com.br/content/pt/pages/Especies/Bovinos/Bulario/_assets/Leptoferm5.2.pdf) identifica fabricante Zoetis Inc., importador brasileiro, apresentação e licença histórica. Bovinos têm inicial única; o esquema de duas iniciais descrito para suínos não é transferido. Ausência de informação reprodutiva não vira permissão.
- **Poliguard:** a [página primária MSD](https://www.msd-saude-animal.com.br/produto/poliguard/) é resumo, com posologia, apresentação, supervisão MV e gestação expressa. Filhos de mães vacinadas: primeira dose após quatro meses. A lista MAPA de 2014, página 137, informa registro 9.299/2007 e Vallée S/A. A página comercial atual não prova titularidade/vigência regulatória atuais ou bula integral.
- **Alternativa IBR documentada, não selecionada:** [Bovigen Repro Total SE/Virbac](https://br.virbac.com/products/biologicos/bovigen-repro-total-se), apresentação 100/250 mL, possui condições reprodutivas e composição próprias. Não substitui Poliguard nem recebe sua autorização por equivalência.

Consultas direcionadas a páginas do fabricante e ao diretório/painel MAPA não forneceram prova individual de vigência atual dos três produtos. Números de registro históricos foram preservados como históricos. Nenhum contato com terceiros foi enviado. Os 18 produtos genéricos legados não foram renomeados nem convertidos por inferência. O candidato acrescenta somente três registros comerciais novos em `precisa_validar`, sem autorizações de espécie/dose/carência ou vínculo automático aos sete itens.

Idade, reprodução e carência desconhecidas continuam explícitas. Carência desconhecida não exige inventar prazo nem bloquear a avaliação genérica; execução e cálculo factual continuam exigindo produto/fonte próprios.

## Contexto no plano e obrigacoes da execucao

As seis novas versões propostas são Agendas de avaliação/manejo, sem produto, dose, via ou carência. As condições utilizam os campos do plano persistente existente: `regionalCalendar`, `management`, `preWeaningBasis`, `scheduledContext` e `reproductiveContext`, além de UF/categoria do animal. O formulário solicita região, sistema e referência responsável; nenhum valor de fazenda real foi inventado.

A [recomendação Embrapa registrada](https://www.infoteca.cnptia.embrapa.br/bitstream/doc/562842/1/rectec26.pdf) continua apoio regional, não fonte forte global. Não se pede produto comercial para aprovar avaliação. A referência sazonal não comprova data individual de parto, e programação de confinamento não comprova movimento executado.

A politica de fonte forte existente continua preservada: guideline de apoio nao vira norma/bula automaticamente. Isso exige revisao tecnica dos vinculos por campo no catalogo, nao uma decisao MV de fazenda obrigatoria para aprovar a regra global. O problema de representacao de uma eventual decisao clinica MV especifica nao e fundamento para bloquear globalmente os seis modelos de avaliacao. Removido o pedido antecipado de fonte MV por fazenda.

Para B19, a Agenda pode existir com profissional previsto ainda nao definido. A execucao conserva a exigencia de MV cadastrado no SVE e os requisitos de comprovacao oficial; CRMV-UF informado isoladamente nao prova esse cadastro. A pre-checagem existente continua apresentando essas obrigacoes de execucao. Se uma configuracao particular representar ato tecnico que exija responsavel, essa exigencia pertence a esse ato, sem tornar todo manejo uma prescricao.

## Decisao curatorial e integridade do candidato

O preparador combina canonico e pacote, valida hash/identidade/versoes e gera candidato deterministico de revisao. Reutiliza contrato/importador existentes, sem writer, motor ou concessao de aprovacao. O formulario de revisao nao solicita CRMV por padrao; a ativacao solicita contexto/confirmacao, e a execucao lista as obrigacoes realmente aplicaveis.

- Canônico preservado: SHA-256 `51df1c3884f463992113d0d3ac89e3c9534ce68726e9829972838cae2132cf73`.
- Pacote schema 3: SHA-256 `3a7552e9119f7cf4289d6b0dd91119d4b09f856dce923951b429a6abf3894096`.
- Candidato determinístico: SHA-256 `9bb5ad1789c7061994f212cd500e8d5e64cd301332dec354aa2b9a800bb67c56`.
- `SANITARIO_V2_APROVACAO_PENDENTE_20261017.json`: formulário separado com oito decisões, 14 IDs/versões físicas, versões anteriores esperadas, condicoes e decisao curatorial pendente. Vincula o hash exato do candidato e do pacote; a futura decisao deve ser separada, evitando referência circular ou mutação silenciosa do conteúdo revisado.

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
2. Resolver os campos dos dossies e revisar globalmente as fontes por campo. Implementar/validar o publicador de aprovacao abaixo. Regerar candidato/formulario e registrar a decisao do revisor autorizado com ator/data/referencia e hash. Contextos reais serao preenchidos pelo usuario autorizado no plano da fazenda; nao sao precondicao da revisao global.
3. Publicar primeiro rascunhos pelo importador canônico existente, após adoção formal do novo artefato canônico e autorização específica. A CLI de candidato desta entrega deliberadamente não é um caminho de `--apply`. `import_gate.import_real_authorized`, autorização de alvo e dry-run remoto continuam gates independentes.
4. Promover conjuntamente status do protocolo, aprovação/ator/data/referência, vínculos por campo, versão dos itens e permissão automática sob lock/CAS. **Esse publicador de aprovação não existe hoje:** o importador atual força draft/flags falsas e rejeita flags operacionais. Não há comando de ativação executável a alegar. Até existir esse contrato autorizado/testado, esta etapa permanece bloqueada.
5. Smoke no Preview exclusivo, com fazenda sintética: ativar plano explícito; conferir B19/múltiplos protocolos elegíveis, história compatível, manejos configurados, três sugestões e três bloqueios; reavaliar duas vezes, offline/reabrir, cancelar/reagendar e trocar fazenda. Eventos, estoque e carência não podem aumentar por planejamento. O fluxo local já testado não certifica sync multidispositivo; exigir contrato de convergência antes de ampliar rollout.
6. Registrar evidências e decidir promoção separadamente. Não copiar autorização de fixture nem habilitar gate remoto por flag.

Assim, a sequência está executável até validação/homologação local e preparada para importação futura de rascunhos; **a publicação operacional completa não é executável hoje**, por contratos e ambiente ainda ausentes, e não é apresentada como pronta.

## Integração e validação observada

Branch original `codex/sanitario-v2-fechamento` preservada em `1187839`. Worktree reutilizada, limpa antes do trabalho. Nova branch `codex/sanitario-v2-ativacao` criada sobre `origin/main@bf43c631`, com reaplicação limpa dos cinco commits existentes: `052f393`, `6593860`, `f1652bb`, `7920dab`, `4d4b992`. A main é ancestral do HEAD. Comparação dos três arquivos do PR #211 com a main: sem diferenças. Runtime sanitário e motor de automação não foram alterados nesta entrega.

Nesta correcao, `pnpm exec vitest run` nos tres arquivos alterados de preparacao e normalizacao passou: **86 testes** (12 do candidato/formulario, sete da integridade do pacote e 67 dos 20 itens). Inclui 14 casos explicitos de geracao automatica sem veterinario executor identificado, com historico/contexto quando aplicaveis, idempotencia e ausencia de efeitos factuais/estoque. B19 preserva `requires_mv_responsavel=true` para execucao e ainda assim gera a Agenda. Pre-desmama usa contexto intensivo/leiteiro, sem impor indicacao MV nessa alternativa. As 350 verificacoes da entrega anterior sao evidencia historica, nao foram repetidas como rotina nesta correcao.

Dry-run real da CLI em PostgreSQL WASM: **exit 0**, 144 criações planejadas, quatro rejeições esperadas de members e oito tabelas envolvidas vazias antes/depois; canônico byte a byte preservado. Evidência: `SANITARIO_V2_ATIVACAO_DRYRUN_20261017.json`. Auth/tenant são pré-requisitos simulados; não certifica RLS hospedada, concorrência real ou escrita transacional.

ESLint focado dos scripts/testes passou. Logs desta correcao: `%TEMP%/sanitario-papeis-focados.txt` e `%TEMP%/sanitario-papeis-dryrun.txt`. Não executar build/Chromium novamente sem alteração do bundle/runtime; a homologação funcional remota depende do staging e dos contratos listados. Não houve push, merge, migration, deploy, importação ou escrita remota. Os comandos SQL do harness constroem somente o schema descartável em memória.

Gate final: **READY para as ferramentas e artefatos de preparação local; NOT READY para ativação/publicação operacional dos 14 itens**. A correcao de responsabilidades altera pacote, formulario, preparador e testes; sem alteracoes de motor/runtime, sync, schema ou migration. `pnpm run gates:docs`, ESLint focado e `git diff --check` aprovados. As ressalvas de publicação são os bloqueios explícitos abaixo, não falhas de validação local ocultadas.

## Pendências reais

1. Decisao curatorial rastreavel e campos comerciais individualizados. Contexto da fazenda e exigido no plano; profissional exigido na execucao quando aplicavel.
2. Revisao global dos vinculos tecnicos por campo e publicador transacional de aprovacao; nenhuma exigencia geral de MV executor ou fazenda antecipados.
3. Staging isolado e convergência multidispositivo não certificados; não autorizar publicação/rollout com esta evidência local.
