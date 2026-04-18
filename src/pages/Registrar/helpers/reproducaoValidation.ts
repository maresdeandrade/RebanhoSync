import type { ReproductionEventData } from "@/components/events/ReproductionForm";

export function resolveRegistrarReproducaoValidationIssue(
  data: ReproductionEventData,
) {
  if (data.tipo === "parto") {
    if (data.episodeLinkMethod === "unlinked") {
      return "Parto exige vínculo com evento anterior (Cobertura/IA). Selecione um episódio.";
    }

    if (data.episodeLinkMethod === "manual" && !data.episodeEventoId) {
      return "Selecione o evento de serviço para vincular o parto.";
    }
  }

  if ((data.tipo === "cobertura" || data.tipo === "IA") && !data.machoId) {
    return "Macho e obrigatorio para Cobertura/IA.";
  }

  return null;
}
