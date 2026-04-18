type TransitChecklistResumoConfirmacaoProps = {
  purposeLabel: string;
  gtaLabel: string;
  isInterstate: boolean;
  destinationUf: string | null;
};

export function TransitChecklistResumoConfirmacao(
  props: TransitChecklistResumoConfirmacaoProps,
) {
  return (
    <>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Transito externo:</span>
        <span className="font-bold">Sim</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Finalidade:</span>
        <span className="font-bold capitalize">{props.purposeLabel}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">GTA/e-GTA:</span>
        <span className="font-bold">{props.gtaLabel}</span>
      </div>
      {props.isInterstate ? (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Destino UF:</span>
          <span className="font-bold">{props.destinationUf ?? "-"}</span>
        </div>
      ) : null}
    </>
  );
}
