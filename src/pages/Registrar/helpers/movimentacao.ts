export function isMovimentacaoDestinoIgualOrigem(input: {
  origemLoteId: string | null;
  destinoLoteId: string;
}) {
  return Boolean(input.origemLoteId) && input.destinoLoteId === input.origemLoteId;
}

export function shouldClearMovimentacaoDestino(input: {
  origemLoteId: string | null;
  destinoLoteId: string;
}) {
  return (
    input.destinoLoteId.trim().length > 0 &&
    isMovimentacaoDestinoIgualOrigem(input)
  );
}
