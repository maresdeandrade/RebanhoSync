# R04B.3 — publicação interrompida no preflight

**Estado: BLOCKED_PREFLIGHT.** Não atingiu `AWAITING_CURATORIAL_APPROVAL`: as cinco versões ainda não foram publicadas. Nenhuma migration, publicação ou decisão foi executada. A condição de parada da R04B.3 foi aplicada diante de Eventos posteriores ao baseline certificado.

## Preflight observado

Projeto `zqloazqzhwauamcejmuz`, RebanhoSync, região `sa-east-1`, status `ACTIVE_HEALTHY`, PostgreSQL `17.11.0.002`. Snapshot read-only em **21/10/2026 08:16:39 UTC**. Branch `codex/sanitario-v2-convergencia`, HEAD `b5b6ffc9f515874577003efd2cce3ef4492bdb74`, worktree `C:/Users/mares/.codex/worktrees/r04b2-certificacao/GestaoAgro`.

[Resultado estruturado](evidence/SANITARIO_V2_R04B3_PREFLIGHT_RESULT_20261021.json) · [Snapshot remoto read-only](evidence/SANITARIO_V2_R04B3_PREFLIGHT_REMOTE_20261021.json) · [Detalhe dos três Eventos](evidence/SANITARIO_V2_R04B3_EVENT_DRIFT_20261021.json).

| Verificação | Resultado |
|---|---|
| Integridade local | 36 arquivos do manifesto R04B.2 conferidos, zero divergências; oito inputs do delta íntegros |
| Migration SHA256 | `c490630d646a9d99a8fc424c07cc73f73485b6e6bd5ae2d5b6a5582f06e29e59`, exato |
| Digest do delta | `55a71d9f4adb6b4fcbbfe9cd5d26ee8c15fd4fc99f1106b50d02dc830ca877e4`, exato |
| Histórico | 63 versões/nomes iguais ao esperado; fingerprint `c40e67629196f2e6f4d1e3f3e2908ce1`; `20261020232807` ausente |
| Itens | 20 linhas completas iguais ao baseline; sete aprovações originais, nenhuma das cinco candidatas presente |
| Protocolos | Dez linhas completas iguais ao baseline |
| Agendas | Sete no total e na fazenda R05, linhas completas iguais ao baseline |
| Gates | Zero habilitados; linhas completas iguais ao baseline |
| Decisões anteriores | Cinco, sem nova decisão |
| Funções | As quatro definições curatoriais são exatamente iguais ao snapshot anterior à migration |
| ACLs observadas | Funções internas: somente postgres; preview/decisão: postgres e authenticated. Owner postgres; search_path controlado. Sem alteração por esta execução |
| Fontes/coberturas | Seis fontes e 30 coberturas do recorte técnico anterior com linhas completas iguais |
| Produtos/classes | Todos os campos efetivamente presentes nas projeções anteriores coincidem. As projeções omitem colunas geradas; `product_key`/`protocol_key` são aliases do publicador. Isso não é comparação histórica de colunas ausentes. Linhas remotas completas atuais foram preservadas na evidência |
| Eventos R05 | **Falha: esperado zero no baseline; encontrados três Eventos sanitários posteriores** |

## Impedimento concreto

O baseline usado pela certificação R04B.2 foi observado em `2026-10-21T03:00:35.045339Z`, com zero Eventos R05. A leitura atual encontrou:

| ID do Evento | Criação UTC em 21/10/2026 |
|---|---|
| `8993273e-d735-4c97-9171-06b591433927` | 05:59:58.340030 |
| `fc5d058f-058b-4d5a-b650-c5d4c682d585` | 05:59:58.521664 |
| `14500307-5fa2-482e-938b-f96832979f58` | 05:59:58.668460 |

Todos pertencem ao domínio sanitário e à fazenda R05 `2d8a30d9-bd9c-41b4-a71d-93d2d293058f`, sem tombstone. Compartilham a transação de cliente `6dc95ada-c842-4b9c-b382-1f42eb5f761f`; `source_sanitario_agenda_v2_id` e `sanitario_contract_version` são nulos. As sete Agendas continuam inalteradas. Não se infere autoria, autorização, causa ou erro desses fatos; não foram criados por esta execução.

A instrução R04B.3 determina: **“Não continuar em caso de falha de preflight ou divergência de digest.”** A publicação foi interrompida; os Eventos não foram apagados, corrigidos ou ignorados. Não houve rebaseline silencioso nem ajuste do pacote certificado.

## Operações não executadas

- Migration: não houve dry-run remoto nem aplicação; histórico continua com 63 versões no snapshot observado.
- Delta: zero criações, zero atualizações e zero supersessões por esta tarefa. Não se criou cópia autorizada nem executou o publicador contra o remoto.
- Integridade/idempotência de publicação: a evidência local R04B.2 permanece íntegra; não houve importação/replay remoto para validar nesta etapa.
- Previews: zero chamadas autenticadas de preview. Os cinco individuais e dois grupos não foram obtidos; digests remotos não foram fabricados.
- Aprovação: nenhuma chamada a `sanitario_catalog_decide_v2`, nenhum CLO/LEP aprovado.
- Operação: nenhuma Agenda, Evento, produto ou gate alterado; nenhum ensaio R05, deploy, push, merge ou rollback destrutivo.

Os recibos disponíveis são a consulta read-only e as evidências locais acima; não existe recibo de publicação ou auditoria de aprovação desta execução.

## Retomada delimitada

É necessário esclarecer/reconhecer os três Eventos existentes e autorizar nova validação do baseline que os preserve. Esse esclarecimento não autoriza apagá-los nem alterar o delta. Antes de escrita, repetir o preflight e verificar ausência de novas alterações concorrentes; somente então executar a migration e publicação previamente delimitadas, mantendo a proibição de decisões, gates ON e homologação.

Nenhum impedimento adicional de conteúdo canônico foi observado no recorte comparável. O bloqueio é a divergência factual do ambiente protegido, não uma exigência genérica de evidência comercial ou bubalina.
