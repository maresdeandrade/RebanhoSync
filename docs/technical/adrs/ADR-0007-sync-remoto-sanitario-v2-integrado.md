# ADR-0007: Sync Remoto Sanitário v2 Integrado

> **Status:** Accepted
> **Data:** 2026-07-20
> **Contexto:** Fase 12 — contrato pré-migration do Sync Remoto Sanitário v2 Integrado
> **Baseline diagnosticado:** `28f5f8f`
> **Autores:** Codex + revisão técnica

## Problema

A execução e a Conformidade Sanitária v2 estão validadas localmente, mas o contrato local não pode ser enviado diretamente ao schema remoto atual. Existem incompatibilidades de identidade, relacionamentos, produto executado, estados de agenda e tratamento de falhas.

Implementar apenas o caminho feliz de push criaria riscos de duplicação de evento e baixa de estoque, sobrescrita entre dispositivos, perda de fatos locais pendentes no pull e acesso cross-tenant. Por isso, sync remoto, RLS, isolamento por `fazenda_id`, idempotência, retry/replay, sucesso parcial e conflitos multi-dispositivo formam um único bloco arquitetural e um único gate de rollout.

Este ADR congela o contrato anterior à primeira migration. Ele não inicia a implementação.

## Contexto local confirmado

O cliente é offline-first e mantém em Dexie:

- Agenda v2 em `ops_sanitario_agenda_v2`, seus vínculos em `ops_sanitario_agenda_animais_v2` e closures em `ops_sanitario_agenda_closures_v2`;
- fatos em `event_eventos` e detalhes em `event_eventos_sanitario`;
- estoque em `state_insumo_lotes` e `state_insumo_movimentacoes`;
- fila compartilhada em `queue_gestures`, `queue_ops` e `queue_rejections`;
- catálogos técnicos sanitários v2 em stores pull-only;
- Conformidade Sanitária v2 como read model derivado e somente leitura.

O fluxo local de execução cria evento, detalhe, vínculos de animais e, quando aplicável, movimento de estoque. A execução é deduplicada localmente por agenda e `clientOpId`. Contudo, IDs locais legíveis, como os prefixados por `manual-sanitary-agenda-v2:` e `sanitary-agenda-execution-v2:`, não são UUIDs válidos para PKs/FKs Postgres.

A validação funcional desse estado local comprova regras de domínio, mas não transforma os registros atuais em patrimônio de migração. Não é necessário preservar, converter ou sincronizar dados sanitários locais anteriores ao cutover.

Agenda continua sendo intenção futura. Evento continua sendo fato executado append-only. Closure administrativa sem evento não comprova execução, não gera histórico, não movimenta estoque e não cria carência.

## Contexto remoto confirmado

O schema remoto já possui:

- `sanitario_agenda_v2`, `sanitario_agenda_animais_v2` e `sanitario_agenda_closures_v2`, com `fazenda_id`, RLS e relações tenant-scoped;
- `eventos` e `eventos_sanitario`, com RLS e semântica factual;
- `insumo_lotes` e `insumo_movimentacoes`, com RLS e consumo sanitário condicionado a `source_evento_id`;
- catálogos sanitários v2 globais ou tenant-scoped conforme o contrato de cada catálogo;
- `sync-batch` autenticado, com validação de membership por fazenda e processamento da fila compartilhada.

As incompatibilidades relevantes são:

- `eventos.source_task_id` aponta para a agenda legada e deve permanecer intacto;
- falta uma FK própria de evento para `sanitario_agenda_v2`;
- falta uma relação factual própria entre evento e todos os animais executados;
- `eventos_sanitario.produto_veterinario_id` representa produto legado e não distingue produto sanitário v2, insumo real e snapshot textual;
- a agenda remota não possui status `executada`; seus estados são `programada`, `fechada`, `cancelada` e `dispensada`;
- o tratamento genérico de `23505` no sync atual é amplo demais para provar replay;
- o pull genérico destrutivo não é aceitável para stores com fatos ou mutações pendentes;
- sucesso parcial genérico não possui reconciliação segura para todo o agregado sanitário.

## Decisão arquitetural

O Sync Remoto Sanitário v2 será implementado como contrato limpo e como um único bloco integrado, obedecendo simultaneamente às seguintes invariantes:

1. local-first: a operação válida nasce e permanece utilizável localmente;
2. servidor autoritativo para autorização, constraints, transições e conflitos;
3. `fazenda_id` como fronteira obrigatória de isolamento tenant;
4. cutover sem compatibilidade retroativa com dados sanitários locais pré-sync;
5. IDs Postgres como UUIDs reais desde a criação local de qualquer entidade destinada ao remoto;
6. uma única fila, reutilizando `queue_gestures` e `queue_ops`;
7. idempotência comprovada por identidade persistida e constraint específica;
8. dependências e sucesso parcial explícitos por operação;
9. fatos append-only e merge de pull não destrutivo após a ativação;
10. conflito multi-dispositivo resolvido por **first valid server commit wins**;
11. Conformidade recalculada localmente, nunca sincronizada como fonte primária.

Nenhuma parte do bloco será considerada pronta se funcionar sem as garantias de RLS, isolamento, replay, sucesso parcial e conflito definidas neste ADR.

## Identidade e UUID

- A ativação do sync estabelece uma nova fronteira de contrato. Não haverá compatibilidade retroativa obrigatória com dados sanitários locais criados antes dela.
- Toda PK/FK enviada ao Postgres deve ser UUID real.
- Agenda, evento, detalhe, relação evento-animal, movimento e demais fatos destinados ao remoto devem receber UUID estável no cliente antes do primeiro enqueue.
- Retry e replay reutilizam exatamente os mesmos UUIDs e metadados de operação.
- Prefixos legíveis continuam permitidos somente em chaves lógicas locais, `domain_op_id`, `dedup_key`, logs e telemetria; nunca em coluna Postgres `uuid`.
- IDs remotos recebidos por pull não são remapeados.
- Não haverá tabela de tradução de IDs nem adapter de compatibilidade para preservar identidades sanitárias locais pré-sync.
- Dados sanitários locais experimentais sem origem remota poderão ser descartados e recriados pelo contrato limpo.
- Catálogos poderão ser reseedados ou obtidos por pull da fonte técnica autorizada.
- Fatos operacionais já existentes no servidor serão obtidos por pull do servidor autoritativo.
- A partir da ativação, todo dado operacional sanitário syncável nasce com UUID real, `fazenda_id`, identidade idempotente e payload remoto válido antes do primeiro enqueue.

## Cutover limpo dos dados locais

O cutover não migrará nem fará backfill obrigatório dos dados operacionais sanitários locais pré-sync. O rollout poderá limpar e recriar, de forma controlada, as stores sanitárias locais incompatíveis e suas operações de fila ainda não reconhecidas pelo novo contrato.

A dispensa de compatibilidade aplica-se exclusivamente aos dados operacionais sanitários locais pré-sync mantidos no Dexie e às operações locais ainda não aceitas pelo servidor. Ela não autoriza apagar ou reescrever fatos remotos existentes, nem quebrar contratos legados ainda utilizados por outros fluxos do sistema.

Qualquer decisão futura de apagar ou reescrever dados sanitários remotos exigirá outro ADR de rebaseline remoto completo. Este ADR não autoriza essa operação.

Esse descarte é restrito ao estado sanitário local anterior à ativação e deve ter escopo explícito por stores/versão. Ele não autoriza:

- apagar fatos sanitários já aceitos no servidor;
- apagar dados de outros domínios;
- apagar catálogos globais sem que exista pull/reseed determinístico;
- aplicar replace destrutivo depois que o contrato de sync estiver ativo;
- perder fatos ou operações sanitárias criados sob o contrato novo.

Após o cutover, qualquer dado local syncável inválido deve ser rejeitado na criação/enqueue, e não convertido silenciosamente ou mantido por fallback legado.

### Manifesto idempotente de cutover

O cutover será controlado por manifesto local versionado, contendo no mínimo:

- `domain = sanitario_v2`;
- `contract_version` de destino;
- `cutover_id` estável;
- `status`;
- `applied_at`;
- `client_id`;
- lista explícita das stores afetadas;
- tipos de `queue_ops` afetados;
- resultado final e reason code, quando aplicável.

Estados permitidos:

- `PREPARED`: manifesto validado, sem reset iniciado;
- `APPLYING`: reset/reseed em andamento e novos enqueues bloqueados;
- `APPLIED`: cutover concluído e `contract_version` liberada;
- `FAILED`: tentativa interrompida/rejeitada com reason code preservado.

O manifesto obedece às seguintes regras:

- somente executa quando `domain` e versão anterior forem compatíveis com o cutover;
- `contract_version` só se torna ativa depois do estado `APPLIED`;
- `APPLIED` só é gravado depois do commit efetivo do reset/reseed;
- manifesto e limpeza das stores participam da mesma transação Dexie quando tecnicamente possível;
- quando uma única transação não for possível, `APPLYING` permanece como trava durável até a conclusão verificável;
- interrupção em `APPLYING` não libera enqueue do contrato novo;
- nova inicialização retoma ou reaplica o mesmo `cutover_id` de forma idempotente;
- reaplicar manifesto já `APPLIED` com o mesmo `cutover_id + contract_version` é no-op;
- `FAILED` preserva reason code e permite retry controlado com a mesma identidade;
- somente as stores sanitárias explicitamente listadas podem ser resetadas;
- `queue_gestures`, `queue_ops` e `queue_rejections` nunca são limpas integralmente;
- somente operações sanitárias do contrato antigo são removidas ou marcadas como rejeitadas;
- operações de outros domínios são preservadas;
- catálogos usam pull/reseed determinístico da fonte técnica autorizada;
- fatos remotos usam pull do servidor autoritativo;
- enqueue com versão anterior é rejeitado depois do cutover;
- toda gesture/operação nova carrega `domain` e `contract_version`.

Reason codes mínimos do cutover:

- `SANITARIO_CONTRACT_VERSION_UNSUPPORTED`;
- `SANITARIO_CUTOVER_REQUIRED`;
- `SANITARIO_CUTOVER_ALREADY_APPLIED`.

## Contrato de `queue_gestures` e `queue_ops`

O sync sanitário reutilizará a fila existente. Não será criada fila paralela.

### Gesture

Uma ação operacional do usuário corresponde a uma gesture estável, identificada por `client_tx_id`, com no mínimo:

- `fazenda_id`;
- `domain = sanitario_v2` e `contract_version`;
- `client_id` do dispositivo/instalação;
- `client_tx_id` estável;
- tipo de gesture/domínio;
- `created_at`/`client_recorded_at` local para auditoria, sem autoridade sobre timestamps do servidor;
- status agregado;
- contagem de retries e último erro;
- referência a todas as operações do agregado.

Estados mínimos do agregado: `PENDING`, `APPLIED`, `PARTIAL`, `RETRYABLE`, `REJECTED` e `CONFLICT`. `PARTIAL` não pode ser convertido em sucesso global.

### Operation

Cada escrita remota do agregado corresponde a uma `queue_op` com:

- `fazenda_id`, `client_id`, `client_tx_id` e `client_op_id` estáveis;
- `domain = sanitario_v2` e `contract_version` compatível;
- `domain_op_id` estável para a identidade semântica;
- tabela/entidade e operação autorizadas;
- `op_order` determinístico;
- `depends_on_op_ids` explícito;
- UUID da entidade e payload canônico;
- `expected_revision` quando a entidade for mutável;
- `before_snapshot` somente quando necessário para reconciliar estado otimista mutável;
- status, retry count, reason code e erro auditável.

Estados mínimos por operação: `PENDING`, `APPLIED`, `RETRYABLE`, `REJECTED`, `BLOCKED_DEPENDENCY` e `CONFLICT`.

Uma `queue_op` pode representar comando de domínio tipado que materializa várias linhas na mesma transação. A criação da agenda com todos os animais planejados é uma única operação técnica transacional. O núcleo factual da execução é outra operação técnica transacional, embora persista evento, detalhe, relações animal e fechamento. Closure administrativa também é uma única operação técnica transacional. O cliente não enfileira writes independentes para as linhas internas desses agregados.

O `sync-batch` deve usar allowlist estrita de entidades e operações sanitárias. O `fazenda_id` autoritativo vem do envelope validado contra membership e deve coincidir com o registro e com todas as entidades relacionadas. Campos de auditoria e timestamps do servidor não podem ser impostos pelo cliente.

## Identidade de `client_op_id` e `domain_op_id`

Os identificadores têm papéis distintos e não são alternativas intercambiáveis:

- `client_op_id` é a identidade técnica imutável de uma operação remota específica e de todo replay dessa mesma chamada;
- `domain_op_id` é a identidade semântica estável da ação de domínio que pode produzir mais de uma operação técnica dependente.

Para o núcleo factual atômico da execução:

- `domain_op_id` identifica a execução sanitária;
- `client_op_id` identifica a chamada transacional que materializa o núcleo factual.

Para o movimento de estoque posterior:

- reutiliza-se o mesmo `domain_op_id` da execução;
- usa-se `client_op_id` próprio do movimento.

Cada retry mantém o `client_op_id` original da operação que está sendo repetida. Operações técnicas diferentes nunca compartilham `client_op_id`, mesmo quando pertencem ao mesmo `domain_op_id`.

## Transporte e validação de `expected_revision`

O caminho obrigatório é:

```txt
queue_op.expected_revision
→ comando tipado enviado ao sync-batch
→ validação de contrato no sync-batch
→ argumento explícito da função/transação interna de banco
→ comparação com sanitario_agenda_v2.revision sob lock
```

`expected_revision` é parte consumida do comando autoritativo, não metadata passiva. É obrigatório para:

- execução originada por agenda;
- cancelamento;
- dispensa;
- reagendamento ou edição mutável da agenda.

Evento com `source_sanitario_agenda_v2_id` e sem `expected_revision` é rejeitado. Closure administrativa sem `expected_revision` também é rejeitada. Divergência de revision retorna `CONFLICT`, nunca retry cego. A resposta retorna `current_revision` e o estado canônico da agenda para reconciliação.

Reason codes mínimos:

- `SANITARIO_EXPECTED_REVISION_REQUIRED`;
- `SANITARIO_AGENDA_REVISION_CONFLICT`;
- `SANITARIO_AGENDA_NOT_EXECUTABLE`.

## Entidades que sincronizam

### Agenda sanitária

Sincronizam:

- `sanitario_agenda_v2` para criação, edição permitida, cancelamento e estado operacional;
- `sanitario_agenda_animais_v2` para o conjunto explícito de animais planejados;
- `sanitario_agenda_closures_v2` para fechamento administrativo auditável.

`lote_id` pode ser contexto de planejamento, mas nunca substitui os `animal_ids` explícitos. Agenda cancelada não vira evento. Agenda fechada sem evento não vira histórico.

### Atomicidade Agenda → animais planejados

A criação de uma Agenda Sanitária v2 e o conjunto completo dos seus vínculos `sanitario_agenda_animais_v2` constituem uma única `queue_op`, uma única operação técnica e uma única transação de banco.

O comando tipado carrega todos os UUIDs de animais planejados. Na mesma transação, o servidor valida UUIDs, unicidade do conjunto, `fazenda_id`, existência e autorização de todos os animais, cria a agenda e cria todos os vínculos. Se qualquer validação ou insert falhar:

- a agenda não é criada;
- nenhum vínculo é criado;
- a operação termina como `RETRYABLE`, `REJECTED` ou `CONFLICT`, conforme o reason code.

Não é permitido persistir agenda `programada` com conjunto parcial de animais planejados. A existência de um ou mais vínculos não prova completude fora dessa fronteira transacional.

Se alteração de alvos for permitida, a substituição integral do conjunto também deve ser uma única operação/transação, protegida por `expected_revision`, lock da agenda, validação tenant de todos os animais e incremento de revision. Falha preserva integralmente o conjunto anterior.

Esse contrato elimina `expected_animal_count`, flag `targets_complete`, hash de manifesto de alvos e estado intermediário de agenda incompleta.

### Limites da operação de alvos

A primeira implementação/migration deve congelar e testar:

- quantidade máxima de `animal_ids` por comando;
- tamanho máximo do payload tipado;
- timeout operacional da transação;
- reason code para excesso.

O reason code mínimo é `SANITARIO_AGENDA_TARGETS_LIMIT_EXCEEDED`. A validação ocorre antes de qualquer escrita. Comando acima do limite é rejeitado integralmente e nunca dividido automaticamente em várias transações, pois particionamento quebraria a atomicidade Agenda + conjunto completo de animais.

### Evento sanitário

Sincronizam como agregado factual:

- `eventos`;
- `eventos_sanitario`;
- nova relação factual evento-animal;
- vínculo próprio com Agenda Sanitária v2 quando a execução tiver origem em agenda;
- produto real executado, via, dose/quantidade, unidade, responsável, data de execução e snapshots técnicos.

O payload `animal_ids` pode permanecer como snapshot auditável, mas não é a única relação factual nem substitui a tabela relacional.

### Estoque sanitário

Sincronizam:

- movimento em `insumo_movimentacoes` somente após existir evento factual;
- vínculo ao lote de estoque real;
- quantidade, unidade, tipo e `source_evento_id`;
- atualização/recomposição do lote conforme o mecanismo autoritativo já existente no servidor.

`insumo_lotes` é puxado após aplicação/recomposição remota. O cliente não envia saldo arbitrário como autoridade. Retry do movimento não pode reduzir saldo novamente.

### Histórico externo/documental

O histórico externo sincroniza como evento factual de origem externa, acompanhado de detalhe e relação evento-animal. `external_documented` exige `evidenceReference` textual, normalizada e não vazia, com rejeição local e remota se ausente. `external_declared` pode sincronizar como declaração, mas não libera regra crítica.

A referência textual registra a evidência declarada; ela não prova existência, integridade ou disponibilidade futura de arquivo remoto.

### Carência

Carência sincroniza somente como fato persistido derivado da execução já registrada no detalhe sanitário atual. Deve preservar evento origem, produto real, regra técnica, fonte, início, fim e finalidade. Este bloco não cria cálculo remoto novo nem tabela paralela de “carências ativas”. Views/read models podem projetar carência ativa a partir do fato persistido.

## Entidades que não sincronizam

Não são fontes primárias remotas deste bloco:

- Conformidade Sanitária v2;
- previews, janelas calculadas, cards, badges, filtros e agrupamentos;
- elegibilidade, demanda calculada e sinal visual;
- liberação de venda, abate, leite, trânsito ou aptidão operacional;
- saldo local arbitrário de estoque;
- agenda convertida artificialmente em histórico;
- protocolo ou read model convertido em evento;
- anexos, enquanto não existir contrato próprio já aceito para Storage, metadados, autorização, hash e ciclo de vida.

Catálogos globais e técnicos permanecem pull-only quando assim definidos no contrato atual.

## Vínculo Evento → Agenda v2

Será adicionada em `eventos` uma referência própria, nullable, chamada `source_sanitario_agenda_v2_id` ou nome equivalente aprovado na migration, acompanhada de `fazenda_id` em FK composta para `sanitario_agenda_v2`.

`source_task_id` legado permanece intacto, com sua semântica e FK atuais. Ele não será reaproveitado nem migrado implicitamente para a Agenda v2.

Quando houver execução originada por agenda:

- o evento aponta para a Agenda v2 pela nova FK;
- o comando de criação do núcleo factual é a fronteira concorrente e o commit factual válido fecha a agenda remota como `fechada` na mesma transação do banco;
- não será criado status remoto `executada`;
- `eventos.source_sanitario_agenda_v2_id` prova qual evento primário fechou a intenção;
- uma agenda não pode originar dois eventos de execução válidos.

A aceitação do evento vinculado à Agenda v2 deve, na mesma transação:

1. bloquear a linha da agenda;
2. validar `expected_revision`, revision corrente e status executável;
3. verificar a ausência de evento de execução anterior;
4. criar o evento;
5. vincular `source_sanitario_agenda_v2_id`;
6. criar o detalhe sanitário obrigatório;
7. criar todas as relações Evento → Animal obrigatórias;
8. alterar a agenda para `fechada` e incrementar sua revision;
9. retornar a relação factual canônica e o estado final da agenda.

Essa atomicidade será implementada por trigger ou função interna de banco criada em migration, sem expor RPC ao cliente. Se qualquer parte obrigatória falhar, nenhum evento, detalhe ou vínculo animal é persistido e a agenda permanece exatamente no estado anterior. Movimento de estoque não integra esse núcleo: permanece efeito posterior, idempotente e reconciliável.

O fechamento por execução não é uma `queue_op` independente. Ele é efeito transacional obrigatório da aceitação do evento vinculado à Agenda v2. `sanitario_agenda_closures_v2` e suas operações continuam reservados aos fechamentos administrativos explícitos que não representam execução.

### Fonte canônica Evento → Agenda

`eventos.source_sanitario_agenda_v2_id` é a única referência factual canônica entre execução e Agenda v2. A agenda não mantém segunda FK editável para o evento executado.

Consultas Agenda → Evento usam a relação inversa sobre `eventos.source_sanitario_agenda_v2_id` ou view derivada. Qualquer coluna redundante futura deve ser exclusivamente derivada, protegida pelo banco contra escrita independente e nunca competir como segunda fonte de verdade.

## Vínculo Evento → Animal

Será criada relação append-only própria, conceitualmente `eventos_animais`, contendo ao menos `fazenda_id`, `evento_id` e `animal_id`, com PK/unique e FKs compostas tenant-safe.

Essa relação é a fonte factual dos animais afetados. `eventos.animal_id` pode permanecer como animal principal no contrato remoto vigente quando aplicável, e `payload.animal_ids` pode ser snapshot, mas nenhum dos dois substitui a relação para uma execução coletiva.

O lote permanece contexto. Animais não relacionados explicitamente não recebem histórico, carência ou Conformidade derivada do evento.

## Produto executado canônico

O detalhe sanitário deve distinguir sem ambiguidade:

- produto sanitário v2 canônico como referência técnica principal;
- insumo real utilizado como produto físico consumido;
- lote de estoque como origem física da baixa;
- snapshot textual como preservação histórica;
- produto veterinário legado somente para leitura e compatibilidade de eventos legados.

As referências devem ser colunas/FKs separadas e mutuamente coerentes; um ID sintético como `insumo:<id>` não pode ser enviado a uma FK UUID. O snapshot textual preserva auditoria, mas não substitui produto/insumo estruturado quando estes forem exigidos para estoque, dose, carência ou regra crítica.

Novas execuções do Sanitário v2 não devem preencher `produto_veterinario_id` legado como alternativa à ausência de produto v2 ou insumo estruturado. O catálogo legado não é fallback de escrita do contrato novo.

## Status remoto da Agenda

- intenção aberta: `programada`;
- execução factual aceita: `fechada`, com referência ao evento;
- cancelamento válido: `cancelada`;
- dispensa administrativa válida: `dispensada`;
- não será introduzido status remoto `executada`.

O merge local deve interpretar agenda `fechada` com evento como execução concluída e nunca fazê-la reaparecer como pendente. Agenda `fechada` sem evento continua fechamento administrativo, não execução.

## Cancelamento e dispensa atômicos

Closure administrativa segue um único caminho autoritativo:

```txt
queue_op de closure
→ comando tipado do sync-batch
→ função/transação interna de banco
```

Na mesma transação, o servidor deve:

1. bloquear a agenda;
2. validar `expected_revision` contra a revision corrente;
3. validar que o estado permite cancelamento ou dispensa;
4. impedir closure depois de execução factual;
5. inserir `sanitario_agenda_closures_v2`;
6. atualizar a agenda para `cancelada` ou `dispensada`;
7. incrementar revision;
8. retornar closure e agenda canônicas.

Não existe UPDATE separado de status depois de inserir closure. Não existe closure administrativa sem a transição correspondente, nem transição para `cancelada`/`dispensada` sem closure. Retry da mesma identidade retorna o registro canônico. Cancelamento ou dispensa concorrente com execução segue **first valid server commit wins**. Closure administrativa nunca representa execução.

## Idempotência por entidade

| Entidade ou operação | Identidade idempotente congelada | Garantia remota mínima |
|---|---|---|
| Agenda | UUID da agenda + `client_op_id` técnico; `domain_op_id` semântico da criação ou alteração da intenção; `dedup_key` quando aplicável | unique permanente por fazenda e identidade técnica, além das constraints de dedup ativo |
| Agenda-animal | `fazenda_id + agenda_id + animal_id` dentro da operação atômica da agenda | constraint unique composta |
| Closure administrativa | UUID da closure + `client_op_id` técnico; `domain_op_id` semântico da ação administrativa | unique da identidade técnica e transição válida; não representa fechamento por execução |
| Evento primário de agenda | UUID do evento + `client_op_id` técnico da chamada transacional; `domain_op_id` como identidade semântica da execução | unique de replay técnico e unique semântica parcial que impeça duas execuções primárias da mesma agenda |
| Evento sem agenda | UUID do evento + `client_op_id` técnico; `domain_op_id` como identidade semântica do fato | unique permanente por fazenda e identidade técnica |
| Detalhe sanitário | `fazenda_id + evento_id` dentro do núcleo factual atômico | constraint unique composta e FK para evento |
| Evento-animal | `fazenda_id + evento_id + animal_id` dentro do núcleo factual atômico | constraint unique composta |
| Movimento de estoque | UUID do movimento + `client_op_id` técnico próprio; mesmo `domain_op_id` semântico da execução | unique por `fazenda_id + source_evento_id + lote_id + tipo`; consumo exige evento e lote da mesma fazenda |
| Carência persistida | `fazenda_id + source_evento_id + produto_id + regra_id + finalidade` dentro do contrato factual | constraint coerente com o modelo persistido, sem tabela paralela desnecessária |
| Histórico externo | UUID do evento + `client_op_id` técnico; `domain_op_id` semântico do registro externo | unique permanente por fazenda e identidade técnica; fingerprint semântico apenas para detecção de possível duplicidade |

Uma violação `23505` somente será convertida em `APPLIED` quando o nome da constraint e a leitura do registro existente comprovarem que se trata da mesma identidade idempotente, mesma fazenda e mesmo conteúdo imutável relevante. Qualquer outra `23505` é `CONFLICT` ou `REJECTED`, nunca sucesso genérico.

A chave semântica de histórico externo baseada em fazenda, animal, protocolo/item, data, origem e `evidenceReference` normalizada é mecanismo de detecção de `possible_duplicate` e não substitui a identidade idempotente do evento. Ela deve encaminhar o caso para revisão ou confirmação explícita, sem bloquear automaticamente uma segunda aplicação, dose distinta, documento coletivo ou correção/reentrada legítima. Qualquer unique semântica rígida futura deverá provar a impossibilidade de repetições legítimas e incluir atributos suficientes para distingui-las.

## Correções append-only e unique da execução primária

Uma correção futura é novo evento append-only com:

- UUID próprio;
- `client_op_id` próprio;
- `domain_op_id` próprio da ação corretiva;
- referência explícita ao evento corrigido, conceitualmente `corrige_evento_id`.

O evento original permanece imutável. Correção não reutiliza `client_op_id` do evento original, não é segunda execução primária da agenda e não compete com a unique de execução primária.

A unique por Agenda v2 aplica-se somente ao evento primário, em regra conceitual equivalente a:

```sql
unique (fazenda_id, source_sanitario_agenda_v2_id)
where corrige_evento_id is null
  and natureza = 'execucao_primaria'
```

Nome, enum e shape finais serão definidos na migration. Efeitos corretivos sobre estoque ou carência exigem fatos compensatórios próprios; nunca apagam ou sobrescrevem o lançamento original. A Conformidade deve considerar a cadeia do evento original e suas correções segundo regra determinística. Este ADR protege a modelagem futura, mas não implementa o fluxo completo de correção.

## Retry e replay

- Retry reutiliza `client_tx_id`, `client_op_id`, `domain_op_id`, UUIDs e payload factual imutável.
- Falha de rede, timeout ou resposta perdida deixa a operação `RETRYABLE`; não cria nova identidade.
- `APPLIED` é terminal para a identidade confirmada e não é reenviado como nova escrita.
- `BLOCKED_DEPENDENCY` aguarda a dependência sem rollback de fatos já aceitos.
- Rejeição determinística de contrato, autorização ou evidência é `REJECTED` e exige correção explícita/nova operação.
- Conflito de revision ou de constraint semântica autoritativa é `CONFLICT` e exige pull do canônico antes de qualquer nova intenção; fingerprint de `possible_duplicate` não é constraint autoritativa.
- O replay deve retornar o registro remoto canônico e os metadados necessários para confirmação local.
- Movimento já aplicado deve ser reconhecido pela constraint específica; nunca reaplicado para “confirmar”.

## Sucesso parcial

O agregado sanitário é ordenado por dependências, mas cada resultado remoto é explícito. Ordem conceitual:

1. agenda + conjunto completo de animais planejados, atomicamente;
2. núcleo factual atômico: evento base + vínculo à Agenda v2 + detalhe sanitário + relações evento-animal + fechamento da agenda de origem;
3. movimento de estoque;
4. pull/reconciliação dos fatos e lotes canônicos.

Regras de reconciliação:

- falha em agenda ou em qualquer vínculo planejado reverte toda a criação/substituição de alvos; não existe agenda programada incompleta;
- agenda e alvos aceitos, mas núcleo factual falha: agenda permanece intenção; execução fica pendente, rejeitada ou em conflito;
- falha de evento, detalhe, vínculo animal ou fechamento dentro do núcleo factual reverte todo o núcleo; não existe fato parcial persistido;
- núcleo factual aceito implica evento completo e agenda fechada na mesma transação; não existe estado remoto válido com evento aceito e agenda de origem ainda `programada`;
- núcleo factual aceito e estoque falha: o evento permanece factual; movimento fica pendente/inconsistente e não é inventado rollback do evento;
- estoque aceito e confirmação local falha: replay reconhece o mesmo movimento, e pull reconcilia lote/saldo sem segunda baixa;
- uma operação aplicada no servidor não sofre rollback local destrutivo por falha posterior do mesmo lote.

O servidor deve responder por operação com status, reason code, identidade canônica, revision e erro. A gesture será `PARTIAL` enquanto houver mistura de operações aplicadas e não aplicadas.

### Projeção visível de sucesso parcial

A projeção local e a UI distinguem obrigatoriamente:

- `factual_core_status`: aceitação ou não do núcleo factual atômico;
- `sync_status`: estado global da gesture/operação;
- `stock_sync_status`: estado específico do movimento de estoque posterior.

Se o núcleo factual não foi aceito:

- não existe execução concluída;
- o registro não entra como `compliant`;
- a agenda permanece planejada ou em conflito conforme o estado canônico;
- a UI mostra sincronização pendente, rejeitada ou em conflito.

Se o núcleo factual foi aceito e o estoque permanece pendente:

- o evento continua fato executado;
- pode sustentar Conformidade quando todas as demais fontes técnicas exigidas estiverem presentes;
- a UI mostra `Executado — estoque pendente de sincronização`;
- nenhum consumo ou saldo remoto é inventado.

O status `PARTIAL` da gesture nunca é usado diretamente como evidência de Conformidade e nunca cria fato sanitário. Central, Agenda, Histórico e Ajustes devem conseguir projetar explicitamente `pendente`, `parcial`, `conflito`, `rejeitado` e `aplicado`. Nenhum status parcial pode ser ocultado como sucesso global.

## Conflitos multi-dispositivo

A política é **first valid server commit wins**.

- Entidades mutáveis, como agenda aberta, usam `revision`/controle equivalente e compare-and-set por `expected_revision`.
- O servidor valida transição de status e versão no mesmo commit autoritativo.
- Duas execuções da mesma agenda concorrem contra a mesma constraint/lock: a primeira execução válida vence; a segunda recebe `CONFLICT` com o evento canônico.
- Execução concorrente com cancelamento/edição é serializada por lock/transição: vence o primeiro commit que satisfizer o estado anterior esperado; o perdedor faz pull e não sobrescreve.
- Não existe janela concorrente entre inserir o evento e fechar a agenda: ambos pertencem ao mesmo commit de banco.
- Dois cancelamentos idênticos podem ser replay da mesma identidade; cancelamentos distintos após o primeiro estado terminal retornam canônico/conflito conforme a identidade.
- Eventos e movimentos já aceitos não são alterados por last-write-wins.
- Timestamps do dispositivo não decidem o vencedor.

## RLS e isolamento por `fazenda_id`

Toda tabela operacional sanitária e toda nova relação são tenant-scoped e devem:

- conter `fazenda_id NOT NULL`;
- ter RLS habilitada antes de exposição ao cliente;
- possuir policies de `SELECT` e das escritas estritamente necessárias, baseadas em membership e papel;
- negar outsider e usuário sem papel suficiente;
- usar FKs/uniques compostas com `fazenda_id` entre agenda, evento, detalhe, animal, produto tenant-scoped, insumo, lote e movimento;
- impedir que envelope, payload, relation ou FK combine entidades de fazendas diferentes;
- evitar policy ampla, bypass via `service_role` no cliente e confiança em filtro de UI.

O `sync-batch` valida JWT e membership, fixa o `fazenda_id` autoritativo do envelope e rejeita divergência interna. RLS protege SELECTs e escritas executadas sob papéis sujeitos às policies. A chamada interna privilegiada descrita a seguir usa `BYPASSRLS` e, portanto, não pode declarar RLS como fronteira efetiva dessa chamada específica. Catálogos globais são exceções explícitas e somente leitura; suas relações tenant-scoped ainda precisam validar a referência permitida.

## Segurança da função/transação interna

A função que materializa agenda + animais, núcleo factual ou closure atômica é interface interna restrita ao backend e não RPC operacional exposta ao cliente.

A invocação server-side dessas funções pelo `sync-batch` existente, usando `service_role` e grants restritos, faz parte do contrato autorizado. Ela pode usar o mecanismo RPC do cliente Supabase no backend. A fronteira proibida é cliente → função/RPC interna; não é `sync-batch` confiável → função interna.

O modelo de execução congelado é:

1. o `sync-batch` recebe o JWT original e é a fronteira responsável por validar autenticidade, assinatura e validade do token;
2. extrai `actor_user_id` do usuário autenticado e fixa o `fazenda_id` autoritativo do envelope;
3. valida inicialmente membership, papel, `contract_version`, feature flag e allowlist;
4. invoca a função interna com cliente Supabase server-side configurado com `service_role`;
5. passa `actor_user_id`, `fazenda_id`, identidades, versão e comando tipado como argumentos explícitos;
6. a função revalida no banco todos os controles autoritativos antes de escrever.

O executor real no banco é o papel Supabase `service_role`, cuja credencial fica restrita ao ambiente seguro do `sync-batch`, nunca é enviada ao cliente e possui `BYPASSRLS`. As funções serão `SECURITY INVOKER`, executadas sob esse papel. A migration não pode trocar silenciosamente esse modelo por `SECURITY DEFINER` ou por papel sujeito a RLS; qualquer mudança exige revisão deste ADR.

Privilégios obrigatórios:

- `REVOKE EXECUTE FROM PUBLIC`;
- ausência de `EXECUTE` para `anon` e `authenticated`;
- `GRANT EXECUTE` somente para `service_role`;
- nenhum caminho direto do cliente até a função;
- `search_path` fixo e mínimo;
- tabelas e funções referenciadas por nomes totalmente qualificados;
- nenhum SQL dinâmico.

Como `service_role` possui `BYPASSRLS`, RLS não é fronteira efetiva dentro dessa chamada. A função interna não recebe nem revalida criptograficamente o JWT. Ela recebe `actor_user_id` exclusivamente do backend confiável e revalida explicitamente no banco:

- existência do usuário identificado por `actor_user_id`;
- membership;
- papel;
- autorização para a fazenda;
- `fazenda_id` autoritativo;
- `contract_version`;
- feature flag do servidor;
- allowlist da operação;
- `expected_revision`, quando aplicável;
- coerência tenant de todas as entidades relacionadas.

`actor_user_id` e `fazenda_id` nunca são obtidos do `record` operacional enviado pelo cliente. A função revalida autorização, não autenticidade ou assinatura do JWT. Ela audita ator, executor, operação, identidades e reason code. Nessa chamada, as fronteiras efetivas são validação interna da função, FKs compostas, uniques, CHECKs e demais constraints. RLS continua protegendo acessos realizados fora desse caminho sob papéis sujeitos às policies.

A migration futura deve testar explicitamente `SECURITY INVOKER`, `BYPASSRLS` do executor, grants, revokes, executor observado, `search_path` e revalidações internas antes de ativar push.

## Feature flag autoritativa

O rollout possui dois gates independentes e cumulativos:

- **cliente:** oculta ações ainda não liberadas e impede enqueue local;
- **servidor:** gate autoritativo avaliado pelo `sync-batch` antes de qualquer escrita.

A fonte autoritativa do gate é server-side e persistida no banco, em estrutura cujo nome final será definido na migration. Ela deve ser consultável tanto pelo `sync-batch` quanto pela função transacional e conter, no mínimo:

- `fazenda_id` ou escopo global explicitamente modelado;
- `enabled`;
- `minimum_contract_version`;
- escopo de rollout por fazenda, usuário/dispositivo ou percentual;
- vigência;
- autoria e timestamps auditáveis de atualização.

O caminho autoritativo é:

```txt
gate persistido no banco
→ sync-batch consulta antes de aceitar a operação
→ função interna consulta novamente na transação antes de escrever
```

Flag presente apenas em UI, `localStorage`, Dexie, variável do cliente ou configuração exclusiva da Edge Function não é suficiente. Se o gate persistido não puder ser consultado, a escrita falha fechada; pull e reconciliação permanecem disponíveis.

A flag do servidor deve:

- permitir rollout controlado por fazenda, usuário/dispositivo ou percentual;
- declarar versão mínima de contrato;
- rejeitar cliente incompatível mesmo que a flag local esteja habilitada;
- retornar reason code explícito;
- permitir desligar o push sem apagar fatos aceitos;
- manter pull e reconciliação disponíveis para fatos já aceitos.

A flag do cliente nunca autoriza operação que o servidor rejeitaria. Reason codes mínimos:

- `SANITARIO_SYNC_DISABLED`;
- `SANITARIO_SYNC_NOT_ENABLED_FOR_FARM`;
- `SANITARIO_CLIENT_CONTRACT_OUTDATED`.

## Pull e merge não destrutivo

O pull sanitário será incremental ou seletivo e aplicado em transação local de staging/merge. Para cada registro remoto:

1. identificar fazenda e identidade canônica;
2. localizar gesture/op pendente relacionada;
3. preservar fatos e mutações locais ainda não confirmados;
4. confirmar/rebasear operações que correspondam ao remoto;
5. mesclar estado mutável por revision e fatos por identidade append-only;
6. registrar conflito explícito quando não houver merge seguro;
7. somente então avançar cursor de pull.

É proibido limpar e substituir stores factuais ou apagar consumo/evento local pendente. Tombstones remotos não removem fato local pendente nem evento histórico; seu tratamento deve respeitar o contrato append-only e a fila.

Pull de evento já existente é upsert/dedup pela identidade canônica, não novo evento. A presença de evento remoto ligado à agenda deve fechar a projeção local da agenda, mesmo se a confirmação anterior do push tiver sido perdida.

## Impacto na Conformidade

Conformidade não é enviada nem recebida como fato primário. Após o merge transacional do pull, o cliente invalida/recarrega as fontes locais e recalcula a Conformidade Sanitária v2 a partir de:

- catálogo e protocolos versionados;
- agenda e vínculos explícitos;
- eventos, detalhes e relações evento-animal;
- histórico externo/documental;
- estoque e movimentos;
- carência persistida, quando houver.

O recálculo ocorre somente depois de o lote local consistente estar visível. Evento remoto passa a aparecer no histórico local e pode alterar o read model. Agenda futura permanece `planned`; agenda fechada por evento não volta a pendente. Núcleo factual não aceito permanece comando pendente/rejeitado/conflitante e não é promovido artificialmente a evento ou Conformidade. Núcleo factual aceito com estoque ainda pendente continua fato executado e pode sustentar Conformidade quando as demais fontes técnicas exigidas estiverem presentes; `sync_status`, `stock_sync_status` e `PARTIAL` nunca são evidência sanitária por si mesmos.

## Migrations candidatas

As migrations serão desenhadas somente após aceite deste ADR e devem ser incrementais, separáveis e compatíveis com rollback operacional por feature flag, no padrão expand → ativação do contrato limpo → contract. Não haverá backfill obrigatório para preservar dados sanitários locais pré-sync. Candidatas:

1. **Contrato factual e relacionamentos**
   - adicionar `eventos.source_sanitario_agenda_v2_id` com FK composta por fazenda;
   - criar relação factual evento-animal tenant-scoped;
   - adicionar referências separadas para produto sanitário v2 e insumo real, preservando snapshot e mantendo produto legado somente para leitura de eventos legados;
   - acrescentar constraints de `external_documented`/`evidenceReference` e coerência de carência.
2. **Idempotência e concorrência**
   - persistir/fortalecer identidades `client_op_id`/`domain_op_id` onde ausentes;
   - criar função interna transacional para criar Agenda v2 com todo o conjunto de animais e substituir alvos sob `expected_revision`, sem estado intermediário incompleto;
   - definir limites máximos de alvos, payload e timeout, com rejeição pré-escrita por `SANITARIO_AGENDA_TARGETS_LIMIT_EXCEEDED` e sem particionamento automático;
   - criar unique parcial de uma execução primária por Agenda v2, sem bloquear eventos corretivos append-only;
   - criar/ajustar unique de movimento por `fazenda_id + source_evento_id + lote_id + tipo`;
   - adicionar `revision` e guards de transição na agenda mutável;
   - criar função interna que receba `expected_revision` explicitamente, bloqueie/valide a agenda e torne atômicos evento, detalhe, relações evento-animal, vínculo canônico e fechamento, sem RPC exposta ao cliente;
   - criar função interna de closure que torne atômicos insert de closure, transição administrativa e incremento de revision;
   - definir funções `SECURITY INVOKER`, `GRANT EXECUTE` exclusivo a `service_role`, revokes de `PUBLIC`/`anon`/`authenticated`, executor observado e `search_path` fixo.
3. **RLS das novas superfícies**
   - habilitar RLS e policies mínimas na relação evento-animal e em qualquer nova tabela tenant-scoped;
   - revisar policies afetadas sem ampliar permissões existentes.
4. **Rollout e contrato**
   - criar gate autoritativo persistido no banco, consultável pelo `sync-batch` e pelas funções internas, com fazenda, enabled, versão mínima, escopo, vigência e auditoria;
   - versionar comandos tipados, reason codes e respostas canônicas;
   - manter `eventos.source_sanitario_agenda_v2_id` como única FK factual, sem segunda FK editável na agenda.

Os nomes finais, a coexistência necessária com fatos remotos já persistidos e a ordem física serão auditados na proposta de migration. Compatibilidade com dados sanitários locais pré-sync não é requisito. Este ADR não inicia migration, nova Edge Function ou endpoint público. A futura invocação RPC server-side das funções internas pelo `sync-batch` existente está autorizada pelo contrato; acesso direto do cliente permanece proibido.

Depois que fatos forem aceitos sob o contrato novo, não haverá down migration destrutiva. O rollback desativa o push por feature flag, preserva o schema expandido e mantém fatos e fila para reconciliação.

## Testes obrigatórios para implementação futura

### Contrato, revision e núcleo factual

- somente UUID real alcança PK/FK remota;
- criação/enqueue pós-ativação rejeita dado operacional sanitário sem UUID, `fazenda_id`, identidade idempotente ou payload remoto válido;
- criação da agenda e todos os vínculos planejados persistem na mesma transação;
- falha em qualquer animal planejado não persiste agenda nem vínculo algum;
- não existe agenda programada com conjunto parcial de animais;
- substituição de alvos é atômica, exige `expected_revision` e preserva o conjunto anterior se falhar;
- o contrato não cria `expected_animal_count`, `targets_complete` ou hash de manifesto de alvos;
- quantidade/tamanho dentro do limite é aceita atomicamente;
- excesso de alvos, payload ou timeout previsto é rejeitado antes da escrita com `SANITARIO_AGENDA_TARGETS_LIMIT_EXCEEDED`, sem particionamento automático;
- execução com agenda sem `expected_revision` é rejeitada com `SANITARIO_EXPECTED_REVISION_REQUIRED`;
- `expected_revision` sai da `queue_op`, chega ao comando tipado, é validado pelo `sync-batch` e chega como argumento explícito à função transacional;
- revision divergente retorna `CONFLICT`, `current_revision` e estado canônico da agenda;
- FKs compostas rejeitam agenda, evento, animal, produto, insumo ou lote cross-farm;
- `source_task_id` legado permanece funcional e separado;
- `eventos.source_sanitario_agenda_v2_id` é a única FK factual canônica e a agenda não aceita segunda FK editável para o evento;
- núcleo factual concorrente bloqueia a agenda e persiste evento, detalhe, relações animal e fechamento no mesmo commit;
- falha em qualquer parte do núcleo factual não persiste evento, detalhe, relação animal ou alteração da agenda;
- fechamento por execução não produz `queue_op` independente;
- evento coletivo exige relações evento-animal explícitas;
- novas execuções usam produto v2/insumo estruturado e não usam `produto_veterinario_id` legado como fallback;
- leitura de evento legado continua distinguível de nova execução v2;
- `external_documented` sem `evidenceReference` é rejeitado local e remotamente.

### Closure administrativa

- closure sem `expected_revision` é rejeitada;
- cancelamento e dispensa inserem closure, alteram status e incrementam revision atomicamente;
- falha na closure não insere registro nem altera agenda;
- não existe UPDATE de status separado da closure;
- não existe closure sem transição correspondente nem transição administrativa sem closure;
- retry da mesma closure retorna closure e agenda canônicas;
- execução concorrente com cancelamento/dispensa respeita **first valid server commit wins**.

### Segurança, RLS e multi-tenant

- membro lê somente sua fazenda;
- outsider não lê nem escreve agenda, evento, detalhe, relação ou estoque;
- papel insuficiente não edita/cancela agenda quando a policy exigir papel superior;
- payload com `fazenda_id` divergente é rejeitado pelo sync-batch, função interna e FK/RLS;
- allowlist impede escrita em tabela não autorizada;
- `anon` e cliente `authenticated` não executam função interna diretamente;
- JWT inválido, expirado ou com assinatura inválida é rejeitado pelo `sync-batch` antes de qualquer chamada interna;
- o `sync-batch` autentica o JWT original e encaminha `actor_user_id` e `fazenda_id` autoritativos como argumentos explícitos;
- a função não afirma nem tenta revalidar criptograficamente o JWT;
- `actor_user_id` ou `fazenda_id` injetado no record operacional é ignorado/rejeitado;
- o executor observado da função é `service_role`, exclusivamente server-side, com `BYPASSRLS` reconhecido;
- funções são `SECURITY INVOKER`; a migration não escolhe silenciosamente `SECURITY DEFINER`;
- `REVOKE EXECUTE FROM PUBLIC`, ausência de grant para `anon`/`authenticated` e grant exclusivo a `service_role` são validados;
- `search_path` fixo, nomes qualificados e ausência de SQL dinâmico são validados;
- função interna revalida ator, membership, papel, fazenda, versão, feature flag, allowlist e revision sem depender de RLS ou confiar no `fazenda_id` do record;
- invocação RPC pelo `sync-batch` com `service_role` é aceita, enquanto invocação direta do cliente é negada;
- RLS permanece validada para SELECTs/escritas sob papéis sujeitos às policies, mas não é contabilizada como fronteira efetiva da chamada `service_role`.

### Cutover, versão e feature flag

- cutover descarta ou recria somente stores sanitárias listadas, sem tabela de tradução ou fallback legado;
- reaplicar manifesto já `APPLIED` com o mesmo `cutover_id + contract_version` é no-op;
- transições `PREPARED → APPLYING → APPLIED` ativam `contract_version` somente depois do commit do reset/reseed;
- interrupção em `APPLYING` não libera enqueue novo e é retomada/reaplicada na inicialização seguinte;
- `FAILED` preserva reason code e permite retry controlado;
- cutover não remove gestures, ops ou rejections de outros domínios;
- operação com `contract_version` antiga é rejeitada depois do cutover;
- operações novas sem `domain = sanitario_v2` ou sem versão compatível são rejeitadas;
- flag desligada no servidor rejeita push mesmo com cliente habilitado;
- gate persistido no banco é consultado pelo `sync-batch` e novamente pela função antes da escrita;
- flag apenas em UI, Dexie, `localStorage` ou configuração do cliente não autoriza operação;
- fazenda fora do rollout e cliente abaixo da versão mínima recebem reason code explícito;
- desligar push não bloqueia pull/reconciliação de fatos já aceitos.

### Idempotência, correção e sucesso parcial

- criar e cancelar agenda offline, sincronizar e repetir sem duplicação;
- executar agenda offline e repetir sem duplicar núcleo factual;
- executar com estoque offline e repetir sem duplicar movimento nem reduzir saldo duas vezes;
- `23505` da constraint idempotente correta retorna canônico; outra `23505` não vira sucesso;
- `client_op_id` de execução e movimento são distintos, mantendo o mesmo `domain_op_id` da execução;
- unique da execução primária impede segundo evento primário da mesma agenda;
- correção append-only com UUID, `client_op_id`, `domain_op_id` e `corrige_evento_id` próprios não colide com a unique primária;
- fingerprint de histórico externo sinaliza `possible_duplicate`, mas não bloqueia duas doses/aplicações legítimas com identidades distintas;
- núcleo factual não aceito, ainda que a gesture esteja `PARTIAL`, não cria fato nem `compliant`;
- núcleo factual aplicado com estoque pendente mantém o evento e projeta `Executado — estoque pendente de sincronização`;
- estoque aceito com confirmação local perdida é reconciliado por replay/pull sem segunda baixa;
- status parcial permanece visível e nunca é reduzido a sucesso global.

### Pull e Conformidade

- pull do mesmo evento não duplica local;
- evento remoto aparece no histórico local após pull;
- pull não apaga evento, consumo ou mutação local pendente;
- movimento remoto aplicado reconcilia lote/saldo sem segunda baixa;
- Conformidade recalcula após pull usando fatos e relações locais atualizados;
- `sync_status`, `stock_sync_status` e `PARTIAL` nunca são usados diretamente como evidência de Conformidade;
- Conformidade considera cadeia original + correções append-only segundo regra determinística;
- Conformidade não é criada como tabela/operação primária de sync;
- execução parcial de lote não se propaga a animal sem relação factual.

Também serão obrigatórios testes SQL de constraints/policies, testes unitários do contrato de fila, testes de integração do `sync-batch`, testes do worker/reconcile e validação funcional do baseline Supabase.

## Alternativas consideradas

- **Sync simples antes de RLS/retry/conflitos:** rejeitado; deixaria o caminho de produção sem garantias essenciais.
- **Fila sanitária paralela:** rejeitado; criaria nova fonte de estado e duplicaria worker/reconciliação.
- **Usar `source_task_id` para Agenda v2:** rejeitado; mistura agenda legada e v2 e quebra a FK existente.
- **Usar `payload.animal_ids` como única relação:** rejeitado; snapshot JSON não garante integridade factual/RLS relacional.
- **Adicionar status remoto `executada`:** rejeitado; a execução vive no evento e a intenção passa a `fechada`.
- **Fechar a agenda por `queue_op` posterior ao evento:** rejeitado; criaria janela concorrente com evento aceito e agenda ainda programada.
- **Last-write-wins por timestamp do cliente:** rejeitado; permite sobrescrita silenciosa e relógios não confiáveis.
- **Sincronizar Conformidade:** rejeitado; criaria fonte paralela de verdade para um read model derivado.
- **Tratar toda `23505` como replay:** rejeitado; pode ocultar conflito semântico ou violação de integridade.
- **Usar fingerprint semântico de histórico externo como identidade primária:** rejeitado; pode bloquear doses, aplicações e correções legítimas.
- **Pull destrutivo por replace:** rejeitado; pode apagar fatos e operações locais pendentes.

## Consequências

### Positivas

- replay seguro de agenda, execução e estoque;
- isolamento tenant comprovável em duas fronteiras;
- histórico coletivo normalizado por animal;
- conflitos determinísticos entre dispositivos;
- falha parcial visível e recuperável;
- Conformidade continua derivada das fontes corretas.

### Trade-offs

- o rollout exige migrations e evolução coordenada de contrato local, sync-batch, worker e pull;
- dados sanitários locais pré-sync podem ser perdidos no cutover e não receberão migração de compatibilidade;
- reset/reseed precisa ser delimitado às stores sanitárias autorizadas e executado antes de aceitar novas operações sob o contrato limpo;
- o agregado pode permanecer `PARTIAL` até todas as dependências factuais serem confirmadas;
- constraints e reason codes precisam ser versionados e testados como API.

## Riscos e decisões adiadas

Riscos que devem ser controlados durante a implementação e antes da ativação:

1. delimitação exata das stores e filas sanitárias locais que serão descartadas/recriadas no cutover, sem atingir outros domínios;
2. desenho SQL final das referências de produto executado e da relação evento-animal, respeitando fatos remotos já persistidos;
3. contrato de resposta/reconciliação por operação para substituir o tratamento genérico de `23505` e rollback global.

Ficam adiados, sem autorização implícita:

- contrato de anexos/Storage e prova criptográfica de evidência;
- cálculo remoto novo de carência;
- liberação operacional ou comercial;
- correção histórica destrutiva;
- RPC diretamente acessível ao cliente;
- novo endpoint operacional público;
- nova Edge Function;
- fila dedicada;
- sincronização/materialização remota da Conformidade.

## Evidências e referências

- `docs/review/CURRENT_PHASE_HANDOFF.md`
- `docs/review/ACTIVE_PHASE_PLAN.md`
- `docs/review/LAST_PHASE_RESULT.md`
- `docs/review/OPEN_REVIEW_ITEMS.md`
- `docs/context/PROJECT_STATUS.md`
- `docs/context/SOURCE_OF_TRUTH.md`
- `docs/domain/SANITARIO.md`
- `docs/product/ROADMAP.md`
- `docs/technical/OFFLINE_SYNC.md`
- `docs/technical/SUPABASE_RLS.md`
- `supabase/migrations/20260606090000_sanitario_agenda_v2_clean_foundation.sql`
- `supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql`
- `supabase/migrations/20260525000000_insumos_inventory.sql`
- `supabase/migrations/20260531002000_eventos_sanitario_operational_traceability.sql`
- `supabase/functions/sync-batch/`
- `src/lib/offline/`
- `src/lib/sanitario/`

## Plano de rollout futuro

1. aprovar este ADR e alterar seu status para `Accepted` no commit de aceite;
2. criar testes sentinela de schema, RLS, idempotência e conflito antes ou junto da primeira migration;
3. aplicar migrations incrementais em expand, incluindo funções internas seguras para agenda + alvos, núcleo factual e closure, sem ativar push sanitário;
4. evoluir contrato compartilhado de queue/sync-batch com comandos tipados, `expected_revision`, allowlist e resultados por operação;
5. implementar gates cumulativos de cliente e servidor, mantendo o servidor autoritativo;
6. evoluir enqueue/worker/reconcile e pull não destrutivo, ainda atrás dos gates;
7. delimitar e testar manifesto, reset/reseed e preservação da fila compartilhada no cutover;
8. executar o cutover local e impedir criação de novos registros fora do contrato limpo;
9. validar offline, replay, parcial, concorrência, segurança da função e cross-tenant end to end;
10. ativar rollout controlado por fazenda/dispositivo/percentual;
11. somente após evidência, marcar a implementação do bloco como iniciada/concluída nos documentos de fase.

Critério de rollback futuro: desativar o gate de push sanitário sem apagar fatos aceitos; manter o schema expandido e preservar fatos e fila local para replay/reconciliação após correção. Não haverá down migration destrutiva depois da aceitação do primeiro fato sob o contrato novo.

## Critério de aceite arquitetural

O ADR permanece `Proposed` até revisão técnica formal. Sua promoção para `Accepted` exige que este documento mantenha explicitamente todos os contratos abaixo:

- [x] transporte consumido de `expected_revision` da `queue_op` até a comparação sob lock na transação;
- [x] rejeição de evento de agenda sem `expected_revision`;
- [x] criação da agenda e conjunto completo de animais planejados como uma única transação, sem estado parcial;
- [x] substituição atômica de alvos sob `expected_revision`, quando permitida;
- [x] núcleo factual de execução atômico, incluindo evento, detalhe, relações animal e fechamento;
- [x] cancelamento e dispensa por closure atômica;
- [x] inexistência de UPDATE separado de status para closure;
- [x] executor real congelado como `service_role` server-side, funções `SECURITY INVOKER` e `BYPASSRLS` compensado por revalidação integral no banco;
- [x] `sync-batch` como única fronteira de autenticação e validação criptográfica do JWT;
- [x] função interna restrita à revalidação de autorização, sem afirmar validação da assinatura do JWT;
- [x] segurança explícita da função interna, sem execução direta pelo cliente e sem escolha silenciosa entre modelos de privilégio;
- [x] chamada RPC interna pelo `sync-batch` confiável classificada como autorizada;
- [x] RPC interna diretamente acessível ao cliente mantida como proibida;
- [x] papéis distintos e não ambíguos para `client_op_id` e `domain_op_id`;
- [x] tabela de idempotência sem barras que tratem UUID, `client_op_id` e `domain_op_id` como alternativas;
- [x] cutover manifestado por `domain + contract_version + cutover_id`;
- [x] manifesto com estados `PREPARED`, `APPLYING`, `APPLIED` e `FAILED`;
- [x] ativação de `contract_version` somente após conclusão e commit do cutover;
- [x] interrupção do cutover sem liberação de enqueue do contrato novo;
- [x] preservação da fila compartilhada de outros domínios, sem limpeza integral;
- [x] projeção visível de sucesso parcial;
- [x] proibição de usar `PARTIAL` ou status de sync diretamente como evidência de Conformidade;
- [x] unique por agenda restrita à execução primária;
- [x] correções append-only com referência explícita ao evento corrigido;
- [x] feature flag cumulativa no cliente e no servidor;
- [x] feature flag do servidor autoritativa;
- [x] fonte autoritativa da feature flag persistida no banco e consultada pelo `sync-batch` e pela função;
- [x] nenhuma autorização dependente apenas de flag local ou configuração do cliente;
- [x] limites de payload/alvos rejeitados antes da escrita, sem quebra da atomicidade por particionamento;
- [x] `eventos.source_sanitario_agenda_v2_id` como única referência factual canônica Evento → Agenda.

Depois do aceite arquitetural, a primeira migration proposta ainda deverá demonstrar aderência testável a esses contratos, além de UUID desde a origem, RLS/fazenda, idempotência, conflitos, pull não destrutivo pós-ativação e recálculo local da Conformidade. Nenhum caminho feliz isolado será aceito como incremento implementável.
