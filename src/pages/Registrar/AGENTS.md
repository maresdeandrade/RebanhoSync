# Registrar — Local Agent

Atualizado em: 2026-05-31  
**Baseline Commit:** `32d7779`

## Escopo

Hotspot operacional de registro de manejo:

```txt
src/pages/Registrar/**
```

Use para ajustes incrementais de UI, composição, helpers locais e fluxo de registro.

---

## Leitura mínima

1. `AGENTS.md` da raiz.
2. `src/pages/AGENTS.md`.
3. `docs/technical/EVENTS_AGENDA_CONTRACT.md`.
4. `docs/ux/FORM_PATTERNS.md`.

Ler apenas se tocar domínio:

| Tema | Ler |
|---|---|
| Sanitário | `src/lib/sanitario/AGENTS.md` |
| Reprodução | `src/lib/reproduction/AGENTS.md` |
| Offline/sync | `src/lib/offline/AGENTS.md` |
| Copy/visual | `docs/ux/COPY_GUIDELINES.md`, `docs/ux/VISUAL_TOKENS.md` |

---

## Regras locais

- Manter `index.tsx` funcional.
- Extrair somente funções puras para `helpers/`.
- Colocalizar UI local em `components/`.
- Não duplicar regra de domínio.
- Não salvar fato sem confirmação explícita.
- Não tratar agenda como histórico.
- Registro executado deve virar evento, não apenas alteração visual.
- `Registrar` pode receber contexto, mas contexto não deve executar ação automaticamente.
- Salvamento local não deve ser apresentado como sincronização remota concluída.

---

## Não fazer sem tarefa própria

- Reescrever o fluxo completo.
- Alterar contrato de sync/offline.
- Alterar payload canônico.
- Alterar invariantes append-only.
- Introduzir política de negócio forte na camada de página.
- Criar regra sanitária, reprodutiva ou financeira dentro da UI.
- Transformar CTA contextual em execução automática sem revisão.

---

## Checagens antes de alterar

1. A mudança é UI, fluxo ou regra de domínio?
2. Existe serviço em `src/lib/**` que já resolve a regra?
3. O fluxo preserva revisão antes de salvar?
4. A ação cria evento, agenda ou apenas navega?
5. Há risco de duplicidade em retry/offline?

---

## Validação

```bash
pnpm run lint
pnpm test
pnpm run build
```