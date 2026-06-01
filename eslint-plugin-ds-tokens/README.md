```md
# eslint-plugin-ds-tokens — RebanhoSync

Plugin ESLint local para proteger o uso de tokens semânticos do Design System.

## Regra

`ds-tokens/no-hardcoded-colors`

### Bloqueia:
* hex hardcoded em classes Tailwind arbitrárias;
* hex em `style` inline;
* `rgb()` e `rgba()` em `style` inline, exceto sombras permitidas.

### Permite:
* tokens Tailwind semânticos;
* `hsl(var(--token))`;
* sombras DS com `rgba`.

---

## Fonte visual

Ver: `docs/ux/VISUAL_TOKENS.md`

---

## Observação

Este plugin é **tooling ativo**. Não mover para `docs/` nem `docs/archive/`.

### Patch incremental recomendado
1. **Prioridade 1:** Ajustar `boxShadow` para bloquear hex dentro da sombra.
2. **Prioridade 2:** Trocar `type: "suggestion"` para `type: "problem"`.
3. **Prioridade 3:** Adicionar testes unitários.
4. **Prioridade 4:** Ampliar detecção de `className` em `TemplateLiteral` e chamadas `cn()`/`clsx()`.

---

## Comandos de validação

### Inspeção de arquivos
```bash
rg "eslint-plugin-ds-tokens|no-hardcoded-colors|ds-tokens" package.json pnpm-workspace.yaml eslint.config.* .eslintrc* scripts src

```

### Executar Lint

```bash
pnpm run lint

```

### Executar Testes

Se adicionar testes, utilize:

```bash
# Caso utilize o filtro do pnpm
pnpm --filter eslint-plugin-ds-tokens test

# Ou, se houver script próprio definido no package.json
pnpm test -- eslint-plugin-ds-tokens

```

```

```