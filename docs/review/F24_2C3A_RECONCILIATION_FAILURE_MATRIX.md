# F24.2C3A — Reconciliation Failure Matrix (R1–R10)

Complemento de `F24_2C3A_DURABLE_RECONCILIATION_AUDIT.md`. Cada cenário responde com base no código real em `src/lib/offline/syncWorker.ts`, `src/lib/offline/pull.ts`, `src/lib/reproduction/remoteSync.ts` e `src/hooks/useAuth.tsx` no baseline `def7976`.

Convenções:

```text
ACK DONE = queue_gestures.status = "DONE" commitado em transação Dexie
obrigação durável = registro persistido que obriga retomada futura da reconciliation
initial pull = runInitialOfflinePullForActiveFarmOnce (fazenda ativa, replace full + catálogos + cutover + reprodução)
```

---

## R1 — ACK DONE, pull inicia e falha

```text
remote = APPLIED
gesture = DONE
queue_ops = removidas
pull = network error
```

- **FATO CONFIRMADO**: todos os pontos de pull pós-ACK (P1–P7) envolvem o pull em `try/catch` e registram `console.warn` (`[sync-worker] post-sync pull failed for TX ...`). Nenhum estado é escrito; nenhuma obrigação é registrada.
- Existe obrigação durável de retry? **NÃO.**
- Recuperação possível: apenas (a) restart/reload (initial pull da fazenda ativa), (b) reentrada na fazenda, (c) inicial pull ainda não memoizado nesta sessão (se o ACK ocorreu antes do primeiro initial pull bem-sucedido, o próximo tick retenta). Se o initial pull da fazenda já foi bem-sucedido nesta sessão, a falha do pull pós-ACK fica sem retomada até restart.
- Classificação: **GAP-1 (P1)** para categoria A; sem impacto para categoria C.

## R2 — ACK DONE, crash antes do pull

```text
DONE commitado → crash → pull nunca iniciou
```

Após restart:

- **FATO CONFIRMADO**: o initial pull da fazenda ativa roda no `startSyncWorker` (e a cada tick até sucesso). Para a fazenda ativa, `pullDataForFarm(DEFAULT_REMOTE_TABLES, replace)` reescreve as stores padrão; cutover sanitário v2 e reprodução usam cursor persistido (`sync_pull_cursors`) — o cursor não avançou, então o dado pós-ACK é incluído.
- Cobre o dado? **Sempre para a fazenda ativa**; **não** para outras fazendas (somente ao reativá-las). Todas as tabelas DEFAULT + catálogos + cutover + reprodução são cobertas; não há tabela factual fora de `DEFAULT_REMOTE_TABLES`.
- A recuperação é por **reconstrução**, não por obrigação persistida — aceitável para correção, mas não satisfaz o contrato "obrigação necessariamente retomada".

## R3 — pull parcial (alguns fetches completam, outros falham)

- **FATO CONFIRMADO**: `pullDataForFarm` faz fetch-all fail-fast (throw no primeiro erro) e escreve tudo em uma única transação Dexie → all-or-nothing por chamada. Teste: `pull.test.ts` "aborts immediately if any table fetch fails"; `financePull.test.ts` "does not partially write when a later finance pull fails".
- Pulls sanitários v2 (`pullSanitarioV2CutoverState`): fetches sequenciais com throw no erro; escrita em `writeMergeResults` única → all-or-nothing por chamada; teste provê "não grava estado parcial nem recalcula conformidade quando uma fonte factual falha".
- Parcialidade real existe **entre chamadas** do fluxo pós-ACK (refreshTables → reprodução → agenda v2): uma chamada pode commitar e a seguinte falhar. Coerência local: cada chamada é atômica; dados brutos e cursores são escritos na mesma transação (`writeMergeResults` inclui `sync_pull_cursors` na transação); cursor não avança quando rows protegidas foram descartadas (`cursorBlockedTables`) → cursor e dados permanecem coerentes.
- Read models: recompute de conformidade só roda após commit completo do merge; falha antes não grava estado parcial (FATO CONFIRMADO em `sanitarioV2PullCutover` + `recomputeSanitaryComplianceAfterPullV2`).
- Veredito: **coerente por chamada; sem compensação entre chamadas** (a chamada que falhou não tem obrigação de retomada — GAP-1).

## R4 — pull termina, recompute falha

Separação entre dado bruto e read model:

- **FATO CONFIRMADO**: `recomputeSanitaryComplianceAfterPullV2` é computação pura a partir de `loadSource(fazendaId)` (Dexie local) e **não persiste** o read model; os painéis (`SanitaryCompliancePanelV2`, `SanitaryLotSummaryPanelV2`, `SanitaryAnimalSummaryPanelV2`) recomputam `buildSanitaryComplianceV2` on-demand.
- Portanto: raw remote data atualizado = correto; read model pendente = rederivado na próxima leitura. Falha de recompute após o merge não deixa estado falso persistido.
- Exceção dentro do fluxo de reprodução: `rebuildReproductionCaches` atualiza `state_animais` **dentro da mesma transação** dos dados → atômico com o pull (sem janela de raw-data-sem-projeção).
- Veredito: **SAFE** (categoria B se resolve por recompute; sem recompute persistido a staleness não se materializa).

## R5 — usuário continua offline após ACK

- **FATO CONFIRMADO**: ACK local não agenda nenhuma request futura de pull. Não há listener `online` que dispare sync (os listeners existentes são apenas indicadores de UI em `OfflineIndicator`, `TopBar`, `Admin`).
- Retomada posterior: somente pelo intervalo de 5s do worker enquanto a página estiver aberta — e o tick só retenta **gestures PENDING** e o **initial pull não memoizado**; não retenta pull pós-ACK falho.
- Se a página for fechada offline e reaberta online: initial pull da fazenda ativa cobre (R2).
- Veredito: retomada **implícita e limitada** — GAP-3 (P2).

## R6 — app fecha após DONE

```text
DONE → app kill → restart offline → restart online posteriormente
```

- A obrigação não é persistida; porém **sobrevive por reconstrução**: no restart online, o initial pull da fazenda ativa (replace full, sem cursor) inclui o dado ACKed; para cutover/reprodução, o cursor persistido garante que o delta pós-ACK seja buscado.
- Restart offline: initial pull falha (engolido), `initialPullFarmId` unset → retentativa a cada tick quando rede voltar (mesma sessão) ou no próximo restart.
- Veredito: obrigação **não sobrevive como obrigação**, mas a convergência é atingida no restart online para a fazenda ativa. Fazendas não ativas: não convergem.

## R7 — mudança de fazenda antes do reconcile

```text
farm A recebe ACK → usuário muda para farm B
```

- **FATO CONFIRMADO**: `useAuth.setActiveFarm` atualiza estado/localStorage; o worker reexecuta initial pull para B no próximo tick (guarda por `initialPullFarmId !== activeFarmId`). Nada registra obrigação de A.
- A obrigação de A é: **abandonada in-session**; recuperada **somente ao voltar para A** (initial pull replace de A reconverge; cursores de A persistem em `sync_pull_cursors`).
- Veredito: GAP-2 (P1) — "farm não converge sem ação manual" (a ação = reativar a fazenda).

## R8 — logout/login

```text
ACK user A → reconcile não ocorre → logout → login
```

- **FATO CONFIRMADO**: logout (`useAuth.signOut`) chama `supabase.auth.signOut` + `removeActiveFarmId`; **não limpa Dexie** (nenhum `db.delete()` no codebase fora de testes).
- No login, `refreshSettings` resolve a fazenda ativa (remota ou local) e o initial pull da sessão reconverge essa fazenda.
- Isolamento: pulls e cursores escopados por `fazenda_id`; RLS como barreira primária; o replace-mode sobrescreve as stores padrão da fazenda ativa resolvida. INFERÊNCIA: resíduo local de fazenda/usuário anterior permanece em IndexedDB até o replace — cache local, sem caminho de leitura remota indevido; registrado como observação P2/informativa, fora do escopo C3A.
- Retomada: o reconcile pendente do usuário A converge quando a fazenda ativa resolvida for a mesma (initial pull). Isolamento e retomada: **SAFE com observação de cache local**.

## R9 — multi-tab (C2.1 integrada)

- **FATO CONFIRMADO**: processamento de gestures protegido por Web Locks + atomic claim + stale recovery (C2/C2.1). Tabs compartilham IndexedDB.
- Pulls pós-ACK não são lock-protected: duas tabs podem executar o mesmo pull simultaneamente. Efeitos: bulkPut idempotente por id; `appendEventoAnimais` com guards de identidade/append-only; cursor em transação — duplicação de Evento impossível (fato vem do remoto, dedup por id).
- Perda de obrigação: nenhuma obrigação existe para perder; duplicação de trabalho é custo, não correção.
- Veredito: **SAFE** (idempotência domina); custo de dupla execução é P2/telemetria.

## R10 — reconciliation repetida

- **FATO CONFIRMADO por teste**: `sanitarioV2PullCutover` ("faz merge append-only idempotente e rejeita colisão divergente"), `sanitarioIncrementalPullCursor` (cursor incremental re-busca empates sem duplicar), `pull` (replace idempotente), `factualDetailsPull` (reconstrução repetida em database limpo).
- Executar a mesma reconciliation duas vezes: sem novo fato, sem duplicação de Evento, mesmo resultado final; divergência de fato local x remoto é detectada (`REPRO_PULL_*_CONFLICT`, `SANITARIO_V2_EVENT_ANIMAL_APPEND_ONLY_VIOLATION`) em vez de sobrescrita silenciosa.
- Veredito: **idempotente**.

---

## Sumário

| Cenário | Obrigação durável? | Converge? | Como | Gap |
|---------|--------------------|-----------|------|-----|
| R1 | Não | só em restart/reentrada | reconstrução | GAP-1 (P1) |
| R2 | Não | fazenda ativa no restart | initial pull replace | parcial (fazenda ativa ok) |
| R3 | Não | por chamada | transações atômicas + cursor coerente | sem retomada da chamada falha (GAP-1) |
| R4 | — | sim | recompute on-demand (não persistido) | nenhum |
| R5 | Não | tick (se página aberta) / restart | worker interval | GAP-3 (P2) |
| R6 | Não | restart online (fazenda ativa) | reconstrução | GAP-2 para não ativas |
| R7 | Não | só ao reativar a fazenda | initial pull da fazenda | GAP-2 (P1) |
| R8 | Não | fazenda ativa resolvida no login | initial pull | observação de cache local (P2) |
| R9 | — | sim | idempotência (bulkPut/append-only) | custo de duplicação (P2) |
| R10 | — | sim | idempotência provada por teste | nenhum |
