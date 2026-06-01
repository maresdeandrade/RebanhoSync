/**
 * eslint-plugin-ds-tokens
 *
 * Regra customizada: proibir cores hardcoded em JSX/TSX.
 *
 * Motivo:
 * O Design System do RebanhoSync deve usar tokens semânticos HSL via variáveis CSS
 * (`--primary`, `--accent`, etc.) mapeadas no Tailwind.
 *
 * Cores hex/rgb hardcoded quebram consistência visual, dificultam dark mode e
 * desviam do contrato definido em `docs/ux/VISUAL_TOKENS.md`.
 *
 * Bloqueia:
 *   - className="text-[#abc]"
 *   - className={cn("bg-[#ffffff]", condition && "text-[#000]")}
 *   - className={`border-[#abc]`}
 *   - className="bg-[rgb(255,0,0)]"
 *   - className="text-[rgba(255,0,0,0.5)]"
 *   - className="shadow-[0_0_0_1px_#ff0000]"
 *   - style={{ color: "#abc" }}
 *   - style={{ backgroundColor: "rgb(...)" }}
 *   - style={{ borderColor: "rgba(...)" }}
 *   - style={{ boxShadow: "0 0 0 1px #ff0000" }}
 *
 * Permite:
 *   - className="text-primary"
 *   - className="bg-accent"
 *   - className="shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
 *   - className="[&_.recharts-dot[stroke='#fff']]:stroke-transparent"
 *   - style={{ color: "hsl(var(--primary))" }}
 *   - style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}
 *
 * Observação:
 * `rgba()` em sombras Tailwind arbitrárias e em `boxShadow` inline é permitido
 * para sombras do DS.
 *
 * Hex dentro de sombra continua bloqueado.
 */

/** @type {import("eslint").Rule.RuleModule} */
const noHardcodedColors = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Proibir cores hex/rgb hardcoded em JSX — use tokens semânticos do Design System",
      recommended: true,
    },
    messages: {
      noColorInClassName:
        "Cor hardcoded detectada em className: '{{ value }}'. Use um token semântico Tailwind (ex.: text-primary, bg-accent).",
      noColorInStyle:
        "Cor hex/rgb hardcoded detectada em style inline: '{{ value }}'. Use 'hsl(var(--token))' ou uma classe Tailwind semântica.",
    },
    schema: [],
  },

  create(context) {
    const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/;
    const RGB_COLOR_RE = /rgba?\s*\(/i;

    /**
     * Divide uma classe Tailwind por variantes, respeitando colchetes.
     *
     * Exemplo:
     * - hover:bg-[#fff] -> ["hover", "bg-[#fff]"]
     * - [&_.recharts-dot[stroke='#fff']]:stroke-transparent
     *   -> ["[&_.recharts-dot[stroke='#fff']]", "stroke-transparent"]
     */
    function splitTailwindClassByVariants(token) {
      const parts = [];
      let current = "";
      let bracketDepth = 0;

      for (const char of token) {
        if (char === "[") {
          bracketDepth += 1;
          current += char;
          continue;
        }

        if (char === "]") {
          bracketDepth = Math.max(0, bracketDepth - 1);
          current += char;
          continue;
        }

        if (char === ":" && bracketDepth === 0) {
          parts.push(current);
          current = "";
          continue;
        }

        current += char;
      }

      if (current) {
        parts.push(current);
      }

      return parts;
    }

    /**
     * Retorna apenas a utility final da classe, ignorando variantes.
     *
     * Exemplo:
     * - md:hover:bg-[#fff] -> bg-[#fff]
     * - [&_.x[stroke='#fff']]:stroke-border -> stroke-border
     */
    function getTailwindUtilitySegment(token) {
      const parts = splitTailwindClassByVariants(token);
      return parts[parts.length - 1] ?? token;
    }

    /**
     * Permite sombras arbitrárias com rgba().
     *
     * Motivo:
     * O DS usa sombras com rgba em classes como:
     * - shadow-[0_-8px_24px_rgba(0,0,0,0.15)]
     *
     * Mas continua bloqueando hex dentro da sombra:
     * - shadow-[0_0_0_1px_#ff0000]
     */
    function isAllowedShadowUtilityWithRgba(utility) {
      if (!RGB_COLOR_RE.test(utility)) return false;
      if (HEX_COLOR_RE.test(utility)) return false;

      return (
        utility.startsWith("shadow-[") ||
        utility.startsWith("drop-shadow-[")
      );
    }

    /**
     * Detecta cor hardcoded em classe Tailwind.
     *
     * Regra:
     * - bloquear hex/rgb/rgba em utilities finais;
     * - permitir rgba em shadow/drop-shadow;
     * - ignorar hex dentro de variante arbitrária de seletor, como Recharts:
     *   [&_.recharts-dot[stroke='#fff']]:stroke-transparent
     */
    function containsHardcodedColorInClassName(value) {
      if (typeof value !== "string") return false;

      const tokens = value.split(/\s+/).filter(Boolean);

      return tokens.some((token) => {
        const utility = getTailwindUtilitySegment(token);

        if (!utility.includes("[")) {
          return false;
        }

        if (isAllowedShadowUtilityWithRgba(utility)) {
          return false;
        }

        if (HEX_COLOR_RE.test(utility)) {
          return true;
        }

        if (RGB_COLOR_RE.test(utility)) {
          return true;
        }

        return false;
      });
    }

    /**
     * Detecta cor hardcoded em valor CSS inline.
     *
     * Regra:
     * - hex direto é bloqueado;
     * - rgb()/rgba() direto é bloqueado;
     * - rgba() em boxShadow é permitido;
     * - hex em boxShadow continua bloqueado.
     */
    function isHardcodedColorInStyle(propName, value) {
      if (typeof value !== "string") return false;

      const trimmed = value.trim();
      const isBoxShadow = propName === "boxShadow" || propName === "box-shadow";

      if (isBoxShadow) {
        return HEX_COLOR_RE.test(trimmed);
      }

      if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) {
        return true;
      }

      if (/^rgba?\s*\(/i.test(trimmed)) {
        return true;
      }

      return false;
    }

    /**
     * Extrai strings estáticas de expressões usadas em className.
     *
     * Cobre:
     * - "..."
     * - {"..."}
     * - `...`
     * - cn("...", condition && "...")
     * - clsx("...")
     * - classNames("...")
     * - ["..."].join(" ")
     * - condition ? "..." : "..."
     */
    function collectStaticStrings(expression, output = []) {
      if (!expression) return output;

      switch (expression.type) {
        case "Literal": {
          if (typeof expression.value === "string") {
            output.push(expression.value);
          }
          break;
        }

        case "TemplateLiteral": {
          if (expression.expressions.length === 0) {
            output.push(
              expression.quasis.map((quasi) => quasi.value.raw).join(""),
            );
          } else {
            for (const quasi of expression.quasis) {
              if (quasi.value.raw) {
                output.push(quasi.value.raw);
              }
            }
          }
          break;
        }

        case "CallExpression": {
          for (const arg of expression.arguments) {
            collectStaticStrings(arg, output);
          }
          break;
        }

        case "ArrayExpression": {
          for (const element of expression.elements) {
            collectStaticStrings(element, output);
          }
          break;
        }

        case "ConditionalExpression": {
          collectStaticStrings(expression.consequent, output);
          collectStaticStrings(expression.alternate, output);
          break;
        }

        case "LogicalExpression": {
          collectStaticStrings(expression.left, output);
          collectStaticStrings(expression.right, output);
          break;
        }

        case "BinaryExpression": {
          if (expression.operator === "+") {
            collectStaticStrings(expression.left, output);
            collectStaticStrings(expression.right, output);
          }
          break;
        }

        default:
          break;
      }

      return output;
    }

    function getPropertyName(node) {
      if (!node || !node.key) return "";

      if (node.key.type === "Identifier") {
        return node.key.name;
      }

      if (node.key.type === "Literal") {
        return String(node.key.value);
      }

      return "";
    }

    function getStaticStyleValue(node) {
      if (!node) return "";

      if (node.type === "Literal" && typeof node.value === "string") {
        return node.value;
      }

      if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
        return node.quasis.map((quasi) => quasi.value.raw).join("");
      }

      return "";
    }

    function isPropertyInsideInlineStyle(node) {
      return (
        node.parent &&
        node.parent.type === "ObjectExpression" &&
        node.parent.parent &&
        node.parent.parent.type === "JSXExpressionContainer" &&
        node.parent.parent.parent &&
        node.parent.parent.parent.type === "JSXAttribute" &&
        node.parent.parent.parent.name &&
        node.parent.parent.parent.name.name === "style"
      );
    }

    return {
      JSXAttribute(node) {
        if (!node.name || node.name.name !== "className") return;
        if (!node.value) return;

        const strings = [];

        if (node.value.type === "Literal" && typeof node.value.value === "string") {
          strings.push(node.value.value);
        }

        if (node.value.type === "JSXExpressionContainer") {
          collectStaticStrings(node.value.expression, strings);
        }

        for (const value of strings) {
          if (containsHardcodedColorInClassName(value)) {
            context.report({
              node,
              messageId: "noColorInClassName",
              data: { value },
            });
            return;
          }
        }
      },

      Property(node) {
        if (!isPropertyInsideInlineStyle(node)) return;

        const propName = getPropertyName(node);
        const value = getStaticStyleValue(node.value);

        if (!value) return;

        if (isHardcodedColorInStyle(propName, value)) {
          context.report({
            node,
            messageId: "noColorInStyle",
            data: { value },
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