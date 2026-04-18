import { createGesture } from "@/lib/offline/ops";

export interface RegistrarNovaContraparteDraft {
  tipo: "pessoa" | "empresa";
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
}

type CreateGestureFn = typeof createGesture;

export async function runRegistrarCreateContraparteEffect(input: {
  fazendaId: string;
  draft: RegistrarNovaContraparteDraft;
  createGestureFn?: CreateGestureFn;
}) {
  const contraparteId = crypto.randomUUID();
  const gesture = input.createGestureFn ?? createGesture;
  const txId = await gesture(input.fazendaId, [
    {
      table: "contrapartes",
      action: "INSERT",
      record: {
        id: contraparteId,
        tipo: input.draft.tipo,
        nome: input.draft.nome.trim(),
        documento: input.draft.documento.trim() || null,
        telefone: input.draft.telefone.trim() || null,
        email: input.draft.email.trim() || null,
        endereco: input.draft.endereco.trim() || null,
        payload: {
          origem: "registrar_financeiro",
        },
      },
    },
  ]);

  return { contraparteId, txId };
}
