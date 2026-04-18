type FinanceiroResumoConfirmacaoProps = {
  naturezaLabel: string;
  contraparteNome: string;
  valorLabel: string;
  isFinanceiroSociedade: boolean;
  quantidadeAnimais: number;
  precoLabel: string;
  pesoLabel: string;
  showAnimaisGerados: boolean;
  animaisGeradosCount: number;
};

export function FinanceiroResumoConfirmacao(props: FinanceiroResumoConfirmacaoProps) {
  return (
    <>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Natureza:</span>
        <span className="font-bold capitalize">{props.naturezaLabel}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Contraparte:</span>
        <span className="font-bold">{props.contraparteNome}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Valor:</span>
        <span className="font-bold">{props.valorLabel}</span>
      </div>

      {!props.isFinanceiroSociedade ? (
        <>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Quantidade:</span>
            <span className="font-bold">{props.quantidadeAnimais}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Preco:</span>
            <span className="font-bold">{props.precoLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Peso:</span>
            <span className="font-bold">{props.pesoLabel}</span>
          </div>
        </>
      ) : null}

      {props.showAnimaisGerados ? (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Animais gerados:</span>
          <span className="font-bold">{props.animaisGeradosCount}</span>
        </div>
      ) : null}
    </>
  );
}
