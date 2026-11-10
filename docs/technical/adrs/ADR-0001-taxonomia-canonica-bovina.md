# ADR-0001: Taxonomia Canonica Bovina

- Status: Accepted
- Data: 2026-04-06

## Contexto

O RebanhoSync precisava fechar uma taxonomia bovina canonica sem quebrar:

- offline-first
- modelo Two Rails
- sync-batch autoritativo
- compatibilidade com `animais.payload` legado

O problema central era padronizar tres eixos derivados:

- `categoria_zootecnica`
- `fase_veterinaria`
- `estado_produtivo_reprodutivo`

sem transformar labels derivados em nova fonte de verdade.

## Decisao

### Fonte operacional da verdade

A fonte operacional da regra fica em `src/lib/animals/taxonomy.ts`.

Persistimos apenas fatos minimos em `animais.payload.taxonomy_facts`, sob contrato versionado definido em `src/lib/animals/taxonomyFactsContract.ts`.

### Papel SQL pos-baseline

Na baseline ativa pos-squash, a fonte operacional da taxonomia permanece em TypeScript e os testes protegem fixtures canonicas. A implementacao SQL historica foi movida para `supabase/migrations_legacy_pre_baseline/` como referencia documental e nao e dependencia da pasta ativa.

Qualquer nova projecao SQL deve continuar subordinada a essa regra: nao substituir a derivacao principal do cliente nem criar uma segunda fonte de verdade.

### Ownership dos fatos

Manual:

- `castrado`
- `puberdade_confirmada`
- `secagem_realizada`
- `data_secagem`
- `em_lactacao`

Writer `reproduction_event`:

- `prenhez_confirmada`
- `data_prevista_parto`
- `data_ultimo_parto`

Writer `reproduction_event` tambem pode ajustar:

- `puberdade_confirmada`
- `secagem_realizada`
- `data_secagem`
- `em_lactacao`

Regra de conflito:

- campos event-driven nao aceitam override manual
- correcao de fatos event-driven deve vir por novo evento

### Compatibilidade legada

- o shape fisico de `animais` nao foi redesenhado
- `taxonomy_facts` fica dentro de `payload`
- a leitura continua reutilizando `sexo`, `data_nascimento`, `payload.weaning.*`, `payload.lifecycle.*`, `payload.male_profile.*` e eventos reprodutivos
- compatibilidade com `papel_macho` e `habilitado_monta` foi mantida

### Regras validadas apos o PR #283

- a categoria zootecnica `vaca` exige historico factual de parto; maturidade, peso, prenhez, lactacao, secagem ou `lifecycle.estagio_vida = "vaca_adulta"` nao substituem esse fato;
- ausencia de idade nao e evidencia suficiente para inferir estagio por idade, e a base configurada (`idade` ou `peso`) deve ser respeitada;
- sugestoes e autoaplicacoes de transicao de lifecycle exigem evidencia suficiente e compativel com a base configurada.

Os testes focados de lifecycle e classificacao foram executados apos a correcao: 44 testes aprovados em 2 arquivos.

### Camadas e limites de consumo

Os tres eixos canônicos permanecem distintos: categoria zootécnica, fase veterinária/estágio de vida e estado produtivo-reprodutivo. O snapshot é projeção de leitura e apresentação; não é fonte de fato nem autorização operacional. Reprodução, Sanitário e Comercial devem consultar seus próprios eventos, estados, protocolos e guards.

Fatos event-driven e contexto reprodutivo efetivo prevalecem sobre labels legados. A ausência, conflito ou defasagem temporal de evidência deve ser exposta como limitação, sem conversão automática de legado em fato persistido. As fronteiras entre Agenda, Evento, `state_*` e regra permanecem as definidas em `docs/domain/ANIMAIS_TAXONOMIA.md` e nos contratos de cada domínio.

## Consequencias

Positivas:

- sem migration destrutiva
- sem nova store Dexie
- rollback local continua funcionando por `before_snapshot`
- aliases regionais ficam fora do canônico

Custos:

- existe duplicacao inevitavel entre regra TS e view SQL
- a view precisa ser mantida em paridade com a regra operacional

## Mitigacoes

- contrato versionado com `schema_version = 1`
- validacao local antes do enqueue em `src/lib/offline/ops.ts`
- validacao autoritativa no `sync-batch`
- teste de paridade TS vs SQL em `src/lib/animals/__tests__/taxonomySqlParity.test.ts`
- E2E minimo de sync e rollback em `src/lib/offline/__tests__/taxonomySync.e2e.test.ts`

## Riscos Conhecidos

- divergencia futura entre `taxonomy.ts` e `vw_animais_taxonomia`
- inferencia conservadora para legados sem fatos de desmama/puberdade
- risco de espalhamento de regra se novas telas ignorarem o modulo central

## Nao Escolhido

Persistir labels canonicos em colunas dedicadas de `animais`.

Motivo:

- aumentaria custo de backfill
- elevaria risco de drift entre fato e label
- complicaria rollback offline e compatibilidade legada
