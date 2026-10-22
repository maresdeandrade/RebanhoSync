# R04B.3 — sete previews autenticados pós-consolidação

**Estado: `AWAITING_CURATORIAL_APPROVAL`. CONFIRMED: 7/7 retornos reais, HTTP 200, `error=null` e `blockers=[]`. Nenhuma decisão curatorial foi emitida.**

[Retornos completos e transporte autenticado](evidence/SANITARIO_V2_R04B3_AUTHENTICATED_PREVIEWS_POSTCONSOLIDATION_20261021.json) · [Avaliação e postcheck somente leitura](evidence/SANITARIO_V2_R04B3_AUTHENTICATED_PREVIEWS_REVIEW_20261021.json).

## Identidade, ambiente e escopo

O usuário autenticou sua conta remota na página isolada `http://127.0.0.1:8081/` e executou os sete previews autorizados. `auth.getUser()` e `is_app_admin()` confirmaram `0f00a75c-32a9-4555-a840-cb0f13f2d3f7`, conta `maresdeandrade@gmail.com`, SuperAdmin. Projeto: `zqloazqzhwauamcejmuz`. Verificação às `15:51:42` de 21/10/2026, horário de São Paulo; previews entre `15:51:49` e `15:51:51`.

O cliente temporário não carregou App, Dexie, worker ou fila. Sessão somente em memória, sem copiar a sessão de produção ou reutilizar a identidade local. O transporte capturado contém login, verificação de usuário, `is_app_admin` e exatamente sete chamadas de `sanitario_catalog_review_preview_v2`. Nenhum token, senha ou conteúdo da resposta de autenticação foi incorporado à evidência. O frontend principal e seus arquivos de ambiente continuam apontando para Supabase local.

Os argumentos coincidem integralmente com [o plano certificado](evidence/SANITARIO_V2_R04B2_PUBLICATION_PLAN_20261021.json), SHA-256 `b207e7b2d21e423a5b7a0ec09697cddc99e06e62583e8e99459197e0b7c182ba`. Ambos os protocolos retornaram versão 1. Os registros completos preservam IDs, versões, conteúdo, blockers e digests de cada execução. SHA-256 do arquivo bruto: `20c44e8f9711e63333dca4ecbd04e2d08b4612d205bda001ec68b4884dd287f5`.

## Sete resultados observados

| # | Escopo | Versão observada dos itens | reviewed_content_digest |
|---|---|---|---|
| 1 | CLO — primovacinação dose 1 | 3 | `4df5c6d9fd5bf927bf28ad96e84ff3f010460b4aec197e817c55b0e3236bebd5` |
| 2 | CLO — primovacinação dose 2 | 4 | `b596508e5d198d9a2f88072398595cf2be4a860cd799acda6b5f791e8dcfba4d` |
| 3 | CLO — reforço anual | 3 | `0999e6443151baa6e0562c10272138924f529982103a0fdefa088fa8fd0abd82` |
| 4 | LEP — primovacinação dose 1 | 3 | `6db2fef7c074ba8c2623d7877169685188ccf0bdcaae0bfa3f1b23f14bc53dec` |
| 5 | LEP — reforço, chave anual/semestral | 3 | `687ab3a2a39c8c01b02ca63b781ec4df45e884adea1a8dddd500b89e37086c67` |
| 6 | CLO — grupo com os três IDs exatos do plano | 3 / 4 / 3 | `83b5fe310eac94e2d9912bd425e1e147b4263e2ccaab594f5fc2c11a592410b3` |
| 7 | LEP — grupo com os dois IDs exatos do plano | 3 / 3 | `f80230a1aa845e3659a939f8cb118c3b3a39d10e234efe99844f8bcf5ef62bc1` |

Todos os sete retornos têm HTTP 200, nenhum erro e nenhum blocker. Os dois digests agrupados foram conferidos separadamente; os campos `reviewed_content_digest=null` presentes em `scope` são os placeholders preservados do plano, não os digests reais, que estão em `response.reviewed_content_digest`.

## Avaliação do conteúdo e integridade

**CONFIRMED:** os campos físicos dos cinco itens coincidem com o delta certificado. Os aliases de importação `protocol_key` e `class_key` correspondem, respectivamente, à família do protocolo e à classe física do item. Fontes e coberturas registradas sustentam os quatro campos de planejamento por variante. Não se alteraram o plano ou os hashes canônicos.

- CLO: primeira dose por contexto manual; segunda dose ancorada na primeira execução, entre 28 e 42 dias; reforço anual com vínculo à etapa que completa a série.
- LEP: primeira dose exige contexto de risco; a versão 3 da chave `lepto_reforco_anual_semestral` define recorrência **anual**, ancorada na execução anterior. O nome lógico não autoriza periodicidade semestral.
- São variantes exclusivamente bovinas documentadas pelas fontes Fortress 7 e Leptoferm 5/2 mL. As limitações proíbem generalizar a bula para a classe inteira ou bubalinos. Idade, gestação e lactação não declaradas permanecem desconhecidas.
- Os cinco itens e os dois protocolos continuam em `draft`, sem aprovação. `allows_agenda_auto=false`, produto/dose/via não atribuídos. As classes permanecem `manual_only` e `can_validate_execution=false`. Planejamento não comprova aplicação nem calcula carência.

Os sete hashes SHA-256 foram recalculados a partir do conteúdo completo, reproduzindo a representação textual de `jsonb` usada pela RPC. Todos coincidem com o servidor. Cada grupo também foi reconstruído a partir dos respectivos previews individuais: itens, protocolo, fontes, coberturas, classes e produtos são idênticos, sem drift entre as chamadas.

Um postcheck remoto por `SELECT`, sem invocar a RPC com conexão administrativa, comparou fingerprints das 19 linhas revisadas: cinco itens, dois protocolos, duas fontes, duas classes e oito coberturas. Todas coincidem com os retornos capturados. Contagens: 64 migrations, sete Agendas R05, quatro Eventos R05, cinco decisões anteriores e zero gates habilitados. Essas contagens coincidem com o baseline anterior; não são, isoladamente, prova de identidade byte a byte de todos os dados operacionais.

**INFERRED:** a ausência de escritores operacionais no canal isolado e o transporte observado são compatíveis com execução somente de leitura do catálogo, além do login normal autorizado. **NOT_TESTED:** esta etapa não homologou aplicações sanitárias, transporte operacional Auth/Edge R05 contract v2, produção, dispositivos físicos ou mudanças concorrentes posteriores.

## Validação e limite de autorização

Validação local: `evaluate-previews.mjs` na pasta privada da auditoria conferiu os sete escopos, versões, campos do delta, respostas, transporte, digests, composição dos grupos e fingerprints do postcheck. Nenhum preview foi repetido durante essa avaliação. Checks documentais e diff são registrados no fechamento da consolidação; testes de runtime não foram repetidos porque esta etapa altera somente evidências e snapshots documentais.

**BLOCKED por ausência de autorização específica:** qualquer chamada de `sanitario_catalog_decide_v2`, aprovação/rejeição ou ativação de gate. Obter e avaliar previews não concede essa autorização. Os digests vinculam o conteúdo capturado; alteração posterior exige novo preview antes de eventual decisão.

As tentativas anteriores com 0/7 continuam preservadas como histórico. A pendência de transporte autenticado foi resolvida nesta execução; o estado atual aguarda a decisão curatorial do proprietário para os dois grupos, sem execução antecipada.
