# Protocolos Sanitários — Local Agent

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Escopo

Tela de orquestração sanitária:

```txt
src/pages/ProtocolosSanitarios/**
```

Cobre pack oficial, overlay regulatório, protocolos operacionais e composição de tela.

---

## Leitura mínima

1. `AGENTS.md` da raiz.
2. `src/pages/AGENTS.md`.
3. `src/lib/sanitario/AGENTS.md`.
4. `docs/domain/SANITARIO.md`.
5. `docs/ux/FORM_PATTERNS.md`.

---

## Regras locais

- Preservar separação entre:
  1. base oficial;
  2. overlay regulatório/operacional;
  3. protocolo operacional da fazenda.
- Protocolo = regra/configuração.
- Agenda sanitária = tarefa futura/pendência.
- Evento sanitário = fato executado.
- Não introduzir regra normativa nova na UI.
- Não duplicar cálculo sanitário se já existir serviço dedicado.
- Preferir patch pequeno sem alterar comportamento consolidado.
- Não transformar protocolo configurado em execução.
- Não usar tela como fonte primária regulatória.

---

## Não fazer sem tarefa própria

- Reestruturar contratos sanitários.
- Alterar regras regulatórias canônicas.
- Alterar invariantes de compliance.
- Transformar carência sanitária em liberação de venda/abate.
- Materializar evento a partir de protocolo sem fluxo explícito.
- Reintroduzir regra hardcoded na UI.
- Tratar checklist como conformidade universal.

---

## Checagens antes de alterar

1. A mudança é de UI, overlay, protocolo ou regra sanitária?
2. A regra já existe em `src/lib/sanitario/**`?
3. O protocolo continua sendo configuração?
4. A agenda gerada continua explicável?
5. Há risco de confundir carência com aptidão comercial?

---

## Validação

```bash
pnpm run lint
pnpm test
pnpm run build
```