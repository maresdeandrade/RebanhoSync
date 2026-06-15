# Resultado validacao adapter — 12F5

## Comando

```bash
node scripts/codex/validate-sanitario-adapter-payloads-12f5.mjs
```

## Saida consolidada

```txt
12F5 sanitario adapter validation
PASS: 300
WARNING: 1
FAIL: 0
```

## PASS principais

- Flags proibidas ausentes.
- Bundle 12F4 com `execute_import=false`.
- Contagens esperadas confirmadas:
  - protocolos: 10 adaptados / 0 rejeitados;
  - itens: 13 adaptados / 6 rejeitados;
  - ProductClassGroups: 4 adaptados / 0 rejeitados;
  - ProductClassGroup members: 0 adaptados / 16 rejeitados.
- Enums de protocolos validos.
- B19 nacional validada.
- Aftosa archived/blocked validada.
- 13 itens adaptaveis documentados sem `product_class_group`.
- B19 item validado.
- Aftosa item validado.
- 6 itens rejeitados com `PRODUCT_CLASS_GROUP_NOT_SUPPORTED_BY_SQL_ITEM_ENUM`.
- 16 members bloqueados com `PRODUCT_CLASS_ID_REQUIRED_FOR_GROUP_MEMBER`.
- 4 grupos antiparasitarios adaptados parcialmente.
- SourceRefs direcionados para JSONB correto.
- RotationRules direcionadas para JSONB.
- Invariantes sanitarios preservados.

## WARNING

`12F4 documenta exemplos JSON completos para todos os 13 itens adaptaveis`.

Interpretacao: a validacao completa de shape JSON por item foi aplicada aos exemplos B19/aftosa. Os demais 11 itens foram validados pela tabela documental de adapter e pelas rejeicoes/contagens. Isso e suficiente para 12F5, mas a etapa que gerar payload JSON completo por item deve expandir essa cobertura.

## FAIL

Nenhum.

## Decisao

12F5 aprovada. 12F6 pode ser aberta como decisao estrutural sobre ProductClassGroup em itens, sem seed/import real.
