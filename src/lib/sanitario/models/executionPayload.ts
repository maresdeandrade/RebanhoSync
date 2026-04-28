import type { ProtocoloSanitarioItem, SanitarioTipoEnum } from "@/lib/offline/types";
import type { VeterinaryProductSelection } from "@/lib/sanitario/catalog/products";
import { buildVeterinaryProductMetadata } from "@/lib/sanitario/catalog/products";
import { readSanitaryRegimen } from "@/lib/sanitario/engine/regimen";

export type SanitaryExecutionProtocolItem = Pick<
  ProtocoloSanitarioItem,
  "id" | "protocolo_id" | "produto" | "tipo" | "payload"
>;

export type ResolveSanitaryProtocolProductSelection = (
  payload: Record<string, unknown> | null | undefined,
  productName: string,
  sanitaryType: SanitarioTipoEnum,
) => VeterinaryProductSelection | null;

export type BuildSanitaryExecutionPayloadInput = {
  isSanitaryExecution?: boolean;
  protocoloItem?: SanitaryExecutionProtocolItem | null;
  typedProductName?: string | null;
  selectedVeterinaryProductSelection?: VeterinaryProductSelection | null;
  resolveProtocolProductSelection?: ResolveSanitaryProtocolProductSelection;
};

export type SanitaryExecutionPayload = {
  sanitaryProductName: string;
  sanitaryProductSelection: VeterinaryProductSelection | null;
  sanitaryProductMetadata: Record<string, unknown>;
};

export function buildSanitaryExecutionPayload(
  input: BuildSanitaryExecutionPayloadInput,
): SanitaryExecutionPayload {
  if (input.isSanitaryExecution === false) {
    return {
      sanitaryProductName: "",
      sanitaryProductSelection: null,
      sanitaryProductMetadata: {},
    };
  }

  const protocoloItem = input.protocoloItem ?? null;
  const typedProductName = input.typedProductName?.trim() ?? "";
  const sanitaryProductName = typedProductName || protocoloItem?.produto || "";
  const protocolRegimen = protocoloItem
    ? readSanitaryRegimen(protocoloItem.payload)
    : null;
  const protocolProductSelection =
    protocoloItem && input.resolveProtocolProductSelection
      ? input.resolveProtocolProductSelection(
          protocoloItem.payload,
          protocoloItem.produto,
          protocoloItem.tipo,
        )
      : null;
  const sanitaryProductSelection =
    input.selectedVeterinaryProductSelection ?? protocolProductSelection;

  const sanitaryProductMetadata = {
    ...buildVeterinaryProductMetadata({
      selectedProduct: sanitaryProductSelection,
      typedName: sanitaryProductName,
      source: sanitaryProductSelection?.origem,
      matchMode: sanitaryProductSelection?.matchMode ?? null,
    }),
    ...(protocoloItem
      ? {
          protocolo_item_id: protocoloItem.id,
          protocolo_id: protocoloItem.protocolo_id,
        }
      : {}),
    ...(protocolRegimen
      ? {
          family_code: protocolRegimen.family_code,
          regimen_version: protocolRegimen.regimen_version,
          milestone_code: protocolRegimen.milestone_code,
          regime_sanitario: protocolRegimen,
        }
      : {}),
  };

  return {
    sanitaryProductName,
    sanitaryProductSelection,
    sanitaryProductMetadata,
  };
}
