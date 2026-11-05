import { isMovementV1Operation, type MovementV1 } from "./movement-v1.ts";
import { isObitoAgendaOperation, type ObitoAgendaOperation } from "./obito-agenda.ts";
import { isCommercialPurchaseOperation, type CommercialPurchaseOperation } from "./commercial-purchase.ts";
import { isCommercialOperationV2, type CommercialOperationV2 } from "./commercial-operation-v2.ts";
import { isSanitarioSyncV2Operation, type SanitarioSyncV2Operation } from "./sanitario-v2.ts";
import { isSanitarioInventoryMovementOperation } from "./inventory-dependency.ts";
import type { Operation } from "./rules.ts";

type BatchOperation = Operation | SanitarioSyncV2Operation | CommercialPurchaseOperation |
  CommercialOperationV2 | MovementV1 | ObitoAgendaOperation;

export function isGenericSanitaryInventoryMovement(op: BatchOperation): boolean {
  return !isMovementV1Operation(op) && !isObitoAgendaOperation(op) &&
    !isCommercialPurchaseOperation(op) && !isCommercialOperationV2(op) &&
    isSanitarioInventoryMovementOperation(op);
}

export function isLegacyOperation(op: BatchOperation): op is Operation {
  return !isMovementV1Operation(op) && !isObitoAgendaOperation(op) &&
    !isSanitarioSyncV2Operation(op) && !isCommercialPurchaseOperation(op) &&
    !isCommercialOperationV2(op);
}
