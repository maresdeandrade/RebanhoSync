import { isCalfJourneyAgendaItem } from "@/lib/reproduction/calfJourney";
import type { AgendaItem } from "@/lib/offline/types";
import { readString } from "@/pages/Agenda/helpers/formatting";

type AgendaActionControllerDeps = {
  activeFarmId: string | null;
  navigate: (path: string) => void;
  createGesture: (
    farmId: string,
    ops: Array<{
      table: string;
      action: "UPDATE";
      record: Record<string, unknown>;
    }>,
  ) => Promise<unknown>;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
};

export function createAgendaActionController(deps: AgendaActionControllerDeps) {
  const inFlightStatusUpdates = new Set<string>();

  const goToRegistrar = (item: AgendaItem) => {
    if (item.dominio === "sanitario") {
      const agendaV2Id = readString(item.source_ref, "agenda_v2_id");
      deps.navigate(
        agendaV2Id
          ? `/protocolos-sanitarios?tab=agenda&agendaId=${agendaV2Id}`
          : "/protocolos-sanitarios?tab=agenda",
      );
      return;
    }

    if (item.animal_id && isCalfJourneyAgendaItem(item)) {
      const params = new URLSearchParams();
      params.set("agendaItemId", item.id);
      if (item.source_evento_id) {
        params.set("eventoId", item.source_evento_id);
      }
      deps.navigate(`/animais/${item.animal_id}/cria-inicial?${params.toString()}`);
      return;
    }

    const params = new URLSearchParams();
    params.set("sourceTaskId", item.id);
    params.set("dominio", item.dominio);
    if (item.animal_id) params.set("animalId", item.animal_id);
    if (item.lote_id) params.set("loteId", item.lote_id);

    const protocoloId = readString(item.source_ref, "protocolo_id");
    const protocoloItemId = item.protocol_item_version_id;
    const produto =
      readString(item.source_ref, "produto") ?? readString(item.payload, "produto");
    if (protocoloId) params.set("protocoloId", protocoloId);
    if (protocoloItemId) params.set("protocoloItemId", protocoloItemId);
    if (produto) params.set("produto", produto);

    deps.navigate(`/registrar?${params.toString()}`);
  };

  const updateStatus = async (item: AgendaItem, status: "concluido" | "cancelado") => {
    if (!deps.activeFarmId) {
      deps.showError("Fazenda ativa não encontrada.");
      return;
    }
    if (inFlightStatusUpdates.has(item.id)) return;

    inFlightStatusUpdates.add(item.id);
    try {
      if (item.dominio === "sanitario") {
        deps.showError(
          "Itens sanitários devem ser gerenciados exclusivamente na Central Sanitária.",
        );
        return;
      }

      try {
        await deps.createGesture(deps.activeFarmId, [
          {
            table: "agenda_itens",
            action: "UPDATE",
            record: {
              id: item.id,
              status,
              source_evento_id: item.source_evento_id ?? null,
            },
          },
        ]);
        deps.showSuccess(
          `Item ${
            status === "concluido" ? "concluído" : "cancelado"
          } direto na agenda neste aparelho. Sincronização pendente.`,
        );
      } catch {
        deps.showError("Falha ao atualizar item da agenda.");
      }
    } finally {
      inFlightStatusUpdates.delete(item.id);
    }
  };

  return {
    updateStatus,
    goToRegistrar,
    goToEvent: (eventoId: string) => deps.navigate(`/eventos?eventoId=${eventoId}`),
    goToAnimal: (animalId: string) => deps.navigate(`/animais/${animalId}`),
  };
}
