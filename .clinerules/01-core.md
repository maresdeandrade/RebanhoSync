# RebanhoSync — Core Rules

Leia primeiro:
1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/PROCESS.md`

Regras gerais:
- Trabalhar com escopo estreito.
- Fechar a tarefa por `capability_id` ou `infra.*` sempre que possível.
- Preferir patch mínimo a refatoração ampla.
- Não reler o repositório inteiro sem necessidade.
- Não usar documentação histórica como fonte operacional.
- Em caso de conflito, confiar primeiro em:
  1. código + migrations
  2. `docs/CURRENT_STATE.md`
  3. docs normativos
  4. docs derivados
  5. histórico

Invariantes globais:
- Arquitetura Two Rails:
  - `agenda_itens` = intenção futura mutável
  - `eventos` + `eventos_*` = fatos passados append-only
- Correção de evento ocorre por novo evento / contra-lançamento, não por update destrutivo de negócio.
- `fazenda_id` é a fronteira de isolamento.
- Não inventar nova fonte de verdade fora de código, migrations e docs normativos.

Forma de entrega padrão:
- diff mínimo
- até 3 riscos
- até 5 arquivos principais afetados
- testes realmente necessários

Validação mínima:
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`

Não tocar por padrão:
- `docs/archive/**`
- `dist/**`
- `coverage/**`
- artefatos gerados