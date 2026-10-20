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
    <dl className="grid gap-2 text-sm [&_dd]:min-w-0 [&_dd]:flex-1 [&_dt]:shrink-0 [&_dd]:break-words [&_dd]:text-right">
      <div className="flex gap-4 rounded-lg bg-background/70 px-3 py-3">
        <dt className="text-muted-foreground">Manejo:</dt>
        <dd className="font-semibold capitalize">{props.manejoLabel}</dd>
      </div>
      <div className="flex gap-4 rounded-lg bg-background/70 px-3 py-3">
        <dt className="text-muted-foreground">Animais:</dt>
        <dd className="font-semibold">{props.animaisCount}</dd>
      </div>

      {props.showAlvoLote ? (
        <div className="flex gap-4 rounded-lg bg-background/70 px-3 py-3">
          <dt className="text-muted-foreground">Alvo (lote):</dt>
          <dd className="font-semibold">{props.alvoLoteLabel}</dd>
        </div>
      ) : null}

      {props.showDestinoMovimentacao ? (
        <div className="flex gap-4 rounded-lg bg-background/70 px-3 py-3">
          <dt className="text-muted-foreground">Destino:</dt>
          <dd className="font-semibold">{props.destinoMovimentacaoLabel}</dd>
        </div>
      ) : null}

      {props.showNutricaoAlimento ? (
        <div className="flex gap-4 rounded-lg bg-background/70 px-3 py-3">
          <dt className="text-muted-foreground">Alimento:</dt>
          <dd className="font-semibold">{props.nutricaoAlimentoLabel}</dd>
        </div>
      ) : null}
    </dl>
  );
}
