import { createGesture } from "@/lib/offline/ops";
import type { OperationInput } from "@/lib/offline/types";

type CreateGestureFn = typeof createGesture;

export async function runRegistrarFinalizeGestureEffect(input: {
  fazendaId: string;
  ops: OperationInput[];
  createGestureFn?: CreateGestureFn;
}) {
  const createGestureFn = input.createGestureFn ?? createGesture;
  return await createGestureFn(input.fazendaId, input.ops);
}
