import { ReproductionForm, type ReproductionEventData } from "@/components/events/ReproductionForm";

type RegistrarReproducaoSectionProps = {
  partoRequiresSingleMatrix: boolean;
  fazendaId: string;
  animalId: string | undefined;
  data: ReproductionEventData;
  onChange: (value: ReproductionEventData) => void;
};

export function RegistrarReproducaoSection(props: RegistrarReproducaoSectionProps) {
  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
      {props.partoRequiresSingleMatrix ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          Para gerar a cria e vincular mae e pai com seguranca, registre o parto de uma matriz por vez.
        </div>
      ) : null}
      <ReproductionForm
        fazendaId={props.fazendaId}
        animalId={props.animalId}
        data={props.data}
        onChange={props.onChange}
      />
    </div>
  );
}

