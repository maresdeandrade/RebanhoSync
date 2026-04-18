type RegistrarPostPartoRedirect = {
  motherId: string;
  eventId: string;
  calfIds: string[];
};

export function buildRegistrarFinalizeSuccessMessage(input: {
  compraGerandoAnimais: boolean;
  createdAnimalCount: number;
  txId: string;
}) {
  if (input.compraGerandoAnimais) {
    return `Compra salva neste aparelho com ${input.createdAnimalCount} novo(s) animal(is). Sincronizacao pendente. TX ${input.txId.slice(0, 8)}.`;
  }

  return `Manejo salvo neste aparelho. Sincronizacao pendente. TX ${input.txId.slice(0, 8)}.`;
}

export function buildRegistrarPostFinalizeNavigationPath(
  postPartoRedirect: RegistrarPostPartoRedirect | null,
) {
  if (!postPartoRedirect) {
    return "/home";
  }

  const nextParams = new URLSearchParams();
  nextParams.set("eventoId", postPartoRedirect.eventId);
  postPartoRedirect.calfIds.forEach((calfId) => nextParams.append("cria", calfId));
  return `/animais/${postPartoRedirect.motherId}/pos-parto?${nextParams.toString()}`;
}
