import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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
      role="group"
      aria-label="Ações do registro"
      className="relative -mx-4 -mb-4 mt-4 rounded-b-xl border-t bg-card px-4 py-2 sm:-mx-5 sm:-mb-5 sm:px-5 md:sticky md:bottom-0 md:z-40 md:py-3 md:shadow-soft"
    >
      {isChooseActionStep && actionStepIssues.length > 0 && (
        <StateBanner
          className="mb-2 p-2 text-xs md:mb-4 md:p-4 md:text-base"
          tone="error"
          live="assertive"
          title="Revise antes de continuar"
          description={actionStepIssues[0]}
        />
      )}

      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={isFinalizing}
          onClick={onBack}
        >
          <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>

        {isChooseActionStep && (
          <Button
            type="button"
            className="h-auto min-h-12 min-w-0 flex-1 whitespace-normal px-2 text-xs sm:px-4 sm:text-sm md:h-12 md:px-5"
            disabled={!tipoManejo || !canAdvanceToConfirm}
            onClick={onNext}
          >
            Revisar informações <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}

        {isConfirmStep && (
          <Button
            type="button"
            className="h-auto min-h-12 min-w-0 flex-1 whitespace-normal px-2 text-sm font-semibold shadow-sm sm:px-4 sm:text-base md:h-12 md:px-5"
            onClick={onFinalize}
            disabled={isFinalizing}
          >
            {isFinalizing ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Check aria-hidden="true" className="h-4 w-4" />
            )}{" "}
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
