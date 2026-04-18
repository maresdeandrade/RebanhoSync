import type { ReactNode } from "react";

type ReproducaoResumoConfirmacaoProps = {
  tipoLabel: string;
  showCriasGeradas: boolean;
  criasGeradas: number;
  reprodutorLabel: ReactNode | null;
  observacoes: string;
};

export function ReproducaoResumoConfirmacao(props: ReproducaoResumoConfirmacaoProps) {
  return (
    <>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Tipo:</span>
        <span className="font-bold capitalize">{props.tipoLabel}</span>
      </div>

      {props.showCriasGeradas ? (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Crias geradas:</span>
          <span className="font-bold">{props.criasGeradas}</span>
        </div>
      ) : null}

      {props.reprodutorLabel ? (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Reprodutor:</span>
          {props.reprodutorLabel}
        </div>
      ) : null}

      {props.observacoes ? (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Obs:</span>
          <span className="font-bold truncate max-w-[150px]">{props.observacoes}</span>
        </div>
      ) : null}
    </>
  );
}
