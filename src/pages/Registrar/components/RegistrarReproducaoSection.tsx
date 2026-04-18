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
    <div className="space-y-4 border-t pt-4">
      {props.partoRequiresSingleMatrix ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
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
