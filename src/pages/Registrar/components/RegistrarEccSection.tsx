import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type RegistrarEccSectionProps = {
  selectedAnimalIds: string[];
  animaisNoLote: Array<{ id: string; identificacao: string }> | undefined;
  invalidAnimalIds: string[];
  eccData: Record<string, string>;
  eccObservacoes: Record<string, string>;
  onEccChange: (animalId: string, value: string) => void;
  onObservacoesChange: (animalId: string, value: string) => void;
};

export function RegistrarEccSection(props: RegistrarEccSectionProps) {
  const isSingle = props.selectedAnimalIds.length === 1;

  const validateLocalValue = (valStr: string) => {
    if (!valStr || valStr.trim() === "") return { isValid: true, isEmpty: true };
    const num = Number(valStr);
    if (isNaN(num) || num < 1.0 || num > 5.0) {
      return { isValid: false, isEmpty: false };
    }
    const diff = (num - 1.0) / 0.25;
    const stepDiff = Math.abs(diff - Math.round(diff));
    return { isValid: stepDiff <= 1e-9, isEmpty: false };
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          {isSingle ? "Avaliação de ECC Individual" : `Avaliação de ECC por Lote (${props.selectedAnimalIds.length} animais)`}
        </p>

        <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
          {props.selectedAnimalIds.map((animalId) => {
            const animal = props.animaisNoLote?.find((item) => item.id === animalId);
            const val = props.eccData[animalId] || "";
            const obs = props.eccObservacoes[animalId] || "";
            const isInvalid = props.invalidAnimalIds.includes(animalId);
            const { isValid, isEmpty } = validateLocalValue(val);
            const showWarning = isInvalid || (!isEmpty && !isValid);

            return (
              <div
                key={animalId}
                className={cn(
                  "grid gap-3 rounded-lg border border-border/40 bg-background/80 p-3 shadow-sm transition-all sm:grid-cols-12 sm:items-start",
                  showWarning && "border-destructive/30 bg-destructive/5"
                )}
              >
                <div className="sm:col-span-3 pt-2">
                  <Label className="font-semibold text-sm block truncate">
                    {animal?.identificacao || "Animal"}
                  </Label>
                  {!isSingle && isEmpty && (
                    <span className="text-[10px] text-muted-foreground">Não avaliado</span>
                  )}
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <Input
                    className={cn(
                      "h-10 rounded-xl bg-background text-sm",
                      showWarning && "border-destructive focus-visible:ring-destructive/30"
                    )}
                    type="number"
                    step={0.25}
                    min={1.0}
                    max={5.0}
                    placeholder="ECC (1.00 - 5.00)"
                    value={val}
                    onChange={(event) => props.onEccChange(animalId, event.target.value)}
                  />
                  {showWarning && (
                    <p className="text-[11px] text-destructive leading-tight">
                      ECC de 1.0 a 5.0 (passo 0.25).
                    </p>
                  )}
                </div>

                <div className="sm:col-span-6">
                  <Input
                    className="h-10 rounded-xl bg-background text-sm"
                    type="text"
                    placeholder="Observações (opcional)"
                    value={obs}
                    onChange={(event) => props.onObservacoesChange(animalId, event.target.value)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {!isSingle && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
          <p>
            <strong>Dica de manejo por lote:</strong> Deixe em branco os animais que não deseja avaliar nesta rodada. Apenas registros com valor preenchido válido serão salvos como eventos individuais.
          </p>
        </div>
      )}
    </div>
  );
}
