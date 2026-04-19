import { isCalfJourneyAgendaItem } from "@/lib/reproduction/calfJourney";
import type { AgendaItem, ProtocoloSanitarioItem } from "@/lib/offline/types";
import { asSanitarioTipo, readString } from "@/pages/Agenda/helpers/formatting";
import { pickVeterinaryProductMetadata } from "@/lib/sanitario/products";

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
  concludePendingSanitary: (input: {
    agendaItemId: string;
    occurredAt: string;
    tipo?: "vacinacao" | "vermifugacao" | "medicamento";
    produto?: string;
    payload?: Record<string, unknown>;
  }) => Promise<string>;
  pullDataForFarm: (
    farmId: string,
    tables: string[],
    options: { mode: "merge" },
  ) => Promise<unknown>;
  getProtocolItemById: (id: string) => Promise<ProtocoloSanitarioItem | null>;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  nowIso: () => string;
  logError: (...args: unknown[]) => void;
};

export function createAgendaActionController(deps: AgendaActionControllerDeps) {
  const goToRegistrar = (item: AgendaItem) => {
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
    const protocoloItemId =
      readString(item.source_ref, "protocolo_item_id") ?? item.protocol_item_version_id;
    const produto =
      readString(item.source_ref, "produto") ?? readString(item.payload, "produto");
    const sanitarioTipo = asSanitarioTipo(readString(item.source_ref, "tipo"));

    if (protocoloId) params.set("protocoloId", protocoloId);
    if (protocoloItemId) params.set("protocoloItemId", protocoloItemId);
    if (produto) params.set("produto", produto);
    if (sanitarioTipo) params.set("sanitarioTipo", sanitarioTipo);

    deps.navigate(`/registrar?${params.toString()}`);
  };

  const updateStatus = async (item: AgendaItem, status: "concluido" | "cancelado") => {
    if (!deps.activeFarmId) {
      deps.showError("Fazenda ativa nao encontrada.");
      return;
    }

    const sourceTipo = asSanitarioTipo(readString(item.source_ref, "tipo"));
    const sourceProduto =
      readString(item.source_ref, "produto") ??
      readString(item.payload, "produto") ??
      null;
    const protocolItem = item.protocol_item_version_id
      ? await deps.getProtocolItemById(item.protocol_item_version_id)
      : null;
    const sanitaryProductMetadata = {
      ...pickVeterinaryProductMetadata(protocolItem?.payload),
      ...pickVeterinaryProductMetadata(item.source_ref),
      ...pickVeterinaryProductMetadata(item.payload),
    };

    if (item.dominio === "sanitario" && status === "concluido") {
      try {
        const eventoId = await deps.concludePendingSanitary({
          agendaItemId: item.id,
          occurredAt: deps.nowIso(),
          tipo: sourceTipo ?? undefined,
          produto: sourceProduto ?? undefined,
          payload: {
            origem: "agenda_concluir",
            ...sanitaryProductMetadata,
          },
        });

        await deps.pullDataForFarm(
          deps.activeFarmId,
          ["agenda_itens", "eventos", "eventos_sanitario"],
          { mode: "merge" },
        );

        deps.showSuccess(
          `Aplicacao sanitaria confirmada no servidor. Evento ${eventoId.slice(0, 8)}.`,
        );
        return;
      } catch (error) {
        deps.logError("[agenda] failed to conclude sanitary item with event", error);
        deps.showError("Falha ao concluir pendencia sanitaria com evento.");
        return;
      }
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
          status === "concluido" ? "concluido" : "cancelado"
        } neste aparelho. Sincronizacao pendente.`,
      );
    } catch {
      deps.showError("Falha ao atualizar item da agenda.");
    }
  };

  return {
    updateStatus,
    goToRegistrar,
    goToEvent: (eventoId: string) => deps.navigate(`/eventos?eventoId=${eventoId}`),
    goToAnimal: (animalId: string) => deps.navigate(`/animais/${animalId}`),
  };
}
