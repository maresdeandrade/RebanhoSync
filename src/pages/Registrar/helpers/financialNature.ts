import type { FinanceiroTipoEnum, OrigemEnum } from "@/lib/offline/types";
import type { FinanceiroNatureza } from "@/pages/Registrar/types";

export type FinanceiroNaturezaDirection = "entrada" | "saida";

export type FinanceiroNaturezaOption = {
  value: FinanceiroNatureza;
  label: string;
  requiresAnimals: boolean;
};

const NATUREZA_ENTRADA_OPTIONS: FinanceiroNaturezaOption[] = [
  { value: "compra", label: "Compra", requiresAnimals: false },
  {
    value: "sociedade_entrada",
    label: "Sociedade (Entrada)",
    requiresAnimals: false,
  },
  { value: "doacao_entrada", label: "Doacao", requiresAnimals: false },
  { value: "arrendamento", label: "Arrendamento", requiresAnimals: false },
];

const NATUREZA_SAIDA_OPTIONS: FinanceiroNaturezaOption[] = [
  { value: "venda", label: "Venda", requiresAnimals: true },
  {
    value: "sociedade_saida",
    label: "Sociedade (Saida)",
    requiresAnimals: true,
  },
  { value: "doacao_saida", label: "Doacao", requiresAnimals: true },
];

export function isFinanceiroSociedadeNatureza(natureza: FinanceiroNatureza) {
  return natureza === "sociedade_entrada" || natureza === "sociedade_saida";
}

export function isFinanceiroSaidaNatureza(natureza: FinanceiroNatureza) {
  return (
    natureza === "venda" ||
    natureza === "sociedade_saida" ||
    natureza === "doacao_saida"
  );
}

export function isFinanceiroDoacaoNatureza(natureza: FinanceiroNatureza) {
  return natureza === "doacao_entrada" || natureza === "doacao_saida";
}

export function supportsDraftAnimalsInFinanceiroNatureza(
  natureza: FinanceiroNatureza,
) {
  return (
    natureza === "compra" ||
    natureza === "doacao_entrada" ||
    natureza === "arrendamento"
  );
}

export function resolveFinanceiroNaturezaDirection(
  natureza: FinanceiroNatureza,
): FinanceiroNaturezaDirection {
  return isFinanceiroSaidaNatureza(natureza) ? "saida" : "entrada";
}

export function resolveFinanceiroNaturezaOptions(
  natureza: FinanceiroNatureza,
): FinanceiroNaturezaOption[] {
  return resolveFinanceiroNaturezaDirection(natureza) === "saida"
    ? NATUREZA_SAIDA_OPTIONS
    : NATUREZA_ENTRADA_OPTIONS;
}

export function resolveFinanceiroTipoFromNatureza(
  natureza: FinanceiroNatureza,
): FinanceiroTipoEnum {
  return isFinanceiroSaidaNatureza(natureza) ? "venda" : "compra";
}

export function resolveFinanceiroNaturezaLabel(natureza: FinanceiroNatureza) {
  const option =
    NATUREZA_ENTRADA_OPTIONS.find((item) => item.value === natureza) ??
    NATUREZA_SAIDA_OPTIONS.find((item) => item.value === natureza);
  return option?.label ?? natureza.replace(/_/g, " ");
}

export function resolveFinanceiroPayloadKindOverride(
  natureza: FinanceiroNatureza,
): string | null {
  if (natureza === "doacao_entrada") return "doacao_entrada";
  if (natureza === "doacao_saida") return "doacao_saida";
  if (natureza === "arrendamento") return "arrendamento";
  return null;
}

export function resolveFinanceiroEntryAnimalOrigin(
  natureza: FinanceiroNatureza,
): OrigemEnum {
  if (natureza === "doacao_entrada") return "doacao";
  if (natureza === "arrendamento") return "arrendamento";
  if (natureza === "sociedade_entrada") return "sociedade";
  return "compra";
}
