import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StateBanner } from "@/components/ui/state-banner";

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
    <div
      aria-busy={isFinalizing}
      className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-40 -mx-4 -mb-4 mt-4 rounded-b-xl border-t bg-card px-4 py-3 shadow-soft sm:-mx-5 sm:-mb-5 sm:px-5 md:bottom-0"
    >
      {isChooseActionStep && actionStepIssues.length > 0 && (
        <StateBanner
          className="mb-4"
          tone="error"
          live="assertive"
          title="Revise antes de continuar"
          description={actionStepIssues[0]}
        />
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
