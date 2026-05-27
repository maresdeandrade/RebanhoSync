/**
 * eslint-plugin-ds-tokens
 *
 * DS §3 Fase 3 — Regra custom: proibir cores hex hardcoded em JSX/TSX.
 *
 * Motivo: o Design System do RebanhoSync usa exclusivamente tokens semânticos
 * HSL via variáveis CSS (`--primary`, `--accent`, etc.) mapeadas no
 * tailwind.config.ts. Cores hex hardcoded (#rrggbb, #rgb) ou rgb/rgba inline
 * quebram a consistência visual e impedem o dark-mode automático.
 *
 * O que é bloqueado:
 *   - className="... text-[#abc] ..."        → hex em classe Tailwind arbitrária
 *   - style={{ color: '#abc' }}              → hex em style inline
 *   - style={{ backgroundColor: 'rgb(...)' }} → rgb/rgba inline
 *
 * O que é permitido:
 *   - className="text-primary"               → token semântico Tailwind
 *   - style={{ color: 'hsl(var(--primary))' }} → token CSS
 *   - boxShadow com rgba (sombras do DS)     → exceção explícita
 */

/** @type {import("eslint").Rule.RuleModule} */
const noHardcodedColors = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Proibir cores hex/rgb hardcoded em JSX — use tokens semânticos do Design System (DS §3 Fase 3)",
      recommended: true,
    },
    messages: {
      noHexInClassName:
        "Cor hex hardcoded detectada em className: '{{ value }}'. Use um token semântico Tailwind (ex.: text-primary, bg-accent).",
      noHexInStyle:
        "Cor hex/rgb hardcoded detectada em style inline: '{{ value }}'. Use 'hsl(var(--token))' ou uma classe Tailwind semântica.",
    },
    schema: [],
  },

  create(context) {
    /**
     * Verifica se uma string contém cor hex (#rgb ou #rrggbb ou #rrggbbaa)
     * dentro de uma classe Tailwind arbitrária, ex.: text-[#abc] ou bg-[#aabbcc]
     */
    function containsHexInArbitraryClass(value) {
      return /\[#[0-9a-fA-F]{3,8}\]/.test(value);
    }

    /**
     * Verifica se uma string de valor CSS é uma cor hex ou rgb/rgba hardcoded.
     * Exceção: rgba usada em box-shadow (sombras do DS são rgba).
     */
    function isHardcodedColor(propName, value) {
      if (typeof value !== "string") return false;
      // Permitir sombras com rgba (shadow-soft / shadow-crisp do DS)
      if (propName === "boxShadow" || propName === "box-shadow") return false;
      // Hex: #rgb, #rrggbb, #rrggbbaa
      if (/^#[0-9a-fA-F]{3,8}$/.test(value.trim())) return true;
      // rgb() ou rgba() inline
      if (/^rgba?\s*\(/.test(value.trim())) return true;
      return false;
    }

    return {
      // Detecta className="..." com hex em valor arbitrário
      JSXAttribute(node) {
        if (node.name.name !== "className") return;
        const val = node.value;
        if (!val) return;

        let strValue = "";
        if (val.type === "Literal" && typeof val.value === "string") {
          strValue = val.value;
        } else if (
          val.type === "JSXExpressionContainer" &&
          val.expression.type === "Literal" &&
          typeof val.expression.value === "string"
        ) {
          strValue = val.expression.value;
        }

        if (strValue && containsHexInArbitraryClass(strValue)) {
          context.report({
            node,
            messageId: "noHexInClassName",
            data: { value: strValue },
          });
        }
      },

      // Detecta style={{ color: '#...' }} ou style={{ backgroundColor: 'rgb(...)' }}
      Property(node) {
        // Só nos objetos dentro de style={}
        if (
          !node.parent ||
          node.parent.type !== "ObjectExpression" ||
          !node.parent.parent ||
          node.parent.parent.type !== "JSXExpressionContainer" ||
          !node.parent.parent.parent ||
          node.parent.parent.parent.type !== "JSXAttribute" ||
          node.parent.parent.parent.name.name !== "style"
        ) {
          return;
        }

        const propName =
          node.key.type === "Identifier"
            ? node.key.name
            : node.key.type === "Literal"
              ? String(node.key.value)
              : "";

        const val = node.value;
        if (!val) return;

        let strValue = "";
        if (val.type === "Literal" && typeof val.value === "string") {
          strValue = val.value;
        } else if (
          val.type === "TemplateLiteral" &&
          val.quasis.length === 1
        ) {
          strValue = val.quasis[0].value.raw;
        }

        if (strValue && isHardcodedColor(propName, strValue)) {
          context.report({
            node,
            messageId: "noHexInStyle",
            data: { value: strValue },
          });
        }
      },
    };
  },
};

export default {
  meta: {
    name: "eslint-plugin-ds-tokens",
    version: "1.0.0",
  },
  rules: {
    "no-hardcoded-colors": noHardcodedColors,
  },
};
