type RegistrarPostPartoRedirect = {
  motherId: string;
  eventId: string;
  calfIds: string[];
};

export function buildRegistrarFinalizeSuccessMessage(input: {
  compraGerandoAnimais: boolean;
  createdAnimalCount: number;
  txId: string;
  sourceTaskId?: string | null;
}) {
  if (input.compraGerandoAnimais) {
    return `Execução registrada com sucesso. Entrada salva neste aparelho com ${input.createdAnimalCount} novo(s) animal(is). Sincronização pendente.`;
  }

  if (input.sourceTaskId) {
    return "Execução registrada com sucesso. Registro vinculado à agenda. Sincronização pendente.";
  }

  return "Execução registrada com sucesso. Sincronização pendente.";
}

export function buildRegistrarPostFinalizeNavigationPath(
  postPartoRedirect: RegistrarPostPartoRedirect | null,
  sourceTaskId: string | null = null,
) {
  if (!postPartoRedirect) {
    return sourceTaskId ? "/agenda" : "/home";
  }

  const nextParams = new URLSearchParams();
  nextParams.set("eventoId", postPartoRedirect.eventId);
  postPartoRedirect.calfIds.forEach((calfId) => nextParams.append("cria", calfId));
  return `/animais/${postPartoRedirect.motherId}/pos-parto?${nextParams.toString()}`;
}
