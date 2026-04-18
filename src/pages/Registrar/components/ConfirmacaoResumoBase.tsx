type ConfirmacaoResumoBaseProps = {
  manejoLabel: string;
  animaisCount: number;
  showAlvoLote: boolean;
  alvoLoteLabel: string;
  showDestinoMovimentacao: boolean;
  destinoMovimentacaoLabel: string;
  showNutricaoAlimento: boolean;
  nutricaoAlimentoLabel: string;
};

export function ConfirmacaoResumoBase(props: ConfirmacaoResumoBaseProps) {
  return (
    <>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Manejo:</span>
        <span className="font-bold capitalize">{props.manejoLabel}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Animais:</span>
        <span className="font-bold">{props.animaisCount}</span>
      </div>

      {props.showAlvoLote ? (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Alvo (lote):</span>
          <span className="font-bold">{props.alvoLoteLabel}</span>
        </div>
      ) : null}

      {props.showDestinoMovimentacao ? (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Destino:</span>
          <span className="font-bold">{props.destinoMovimentacaoLabel}</span>
        </div>
      ) : null}

      {props.showNutricaoAlimento ? (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Alimento:</span>
          <span className="font-bold">{props.nutricaoAlimentoLabel}</span>
        </div>
      ) : null}
    </>
  );
}
