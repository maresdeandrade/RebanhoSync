import { isMatch } from "date-fns";

/** Valida a entrada do campo date antes da conversão ISO já usada pelo formulário. */
export function validateFinanceDateInput(value: string): string | null {
  if (!value.trim()) return "Informe a data do registro.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !isMatch(value, "yyyy-MM-dd")) {
    return "Informe uma data de registro válida.";
  }
  return null;
}
