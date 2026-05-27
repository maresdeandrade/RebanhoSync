import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RegistrarStickyActionBarProps {
  step: number;
  isFinalizing: boolean;
  canAdvanceToConfirm: boolean;
  tipoManejo: string | null;
  sourceTaskId: string | null;
  actionStepIssues: string[];
  onBack: () => void;
  onNext: () => void;
  onFinalize: () => void;
}

export function RegistrarStickyActionBar({
  step,
  isFinalizing,
  canAdvanceToConfirm,
  tipoManejo,
  sourceTaskId,
  actionStepIssues,
  onBack,
  onNext,
  onFinalize,
}: RegistrarStickyActionBarProps) {
  const isChooseActionStep = step === 2; // RegistrationStep.CHOOSE_ACTION
  const isConfirmStep = step === 3; // RegistrationStep.CONFIRM

  return (
    <div className="sticky bottom-0 z-40 bg-card py-3 border-t mt-4 -mx-4 px-4 -mb-4 rounded-b-xl shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.1)] sm:-mx-5 sm:px-5 sm:-mb-5">
      {isChooseActionStep && actionStepIssues.length > 0 && (
        <div className="mb-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm font-medium text-destructive">
          {actionStepIssues[0]}
        </div>
      )}
      
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        
        {isChooseActionStep && (
          <Button
            className="flex-1"
            disabled={!tipoManejo || !canAdvanceToConfirm}
            onClick={onNext}
          >
            Revisar informações <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}

        {isConfirmStep && (
          <Button
            className="min-h-12 flex-1 text-base font-semibold shadow-sm"
            onClick={onFinalize}
            disabled={isFinalizing}
          >
            <Check className="mr-2 h-4 w-4" />{" "}
            {isFinalizing
              ? "Registrando..."
              : sourceTaskId
                ? "Registrar manejo e voltar para agenda"
                : "Registrar manejo"}
          </Button>
        )}
      </div>
    </div>
  );
}
