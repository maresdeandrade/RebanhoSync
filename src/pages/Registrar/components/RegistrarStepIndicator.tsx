import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface RegistrarStepIndicatorProps {
  step: number;
  registrationSteps: number[];
  stepLabels: Record<number, string>;
}

export function RegistrarStepIndicator({
  step,
  registrationSteps,
  stepLabels,
}: RegistrarStepIndicatorProps) {
  return (
    <ol aria-label="Progresso do registro" className="grid grid-cols-3 gap-2">
      {registrationSteps.map((currentStep) => {
        const isActive = step === currentStep;
        const isCompleted = step > currentStep;
        return (
          <li
            key={currentStep}
            aria-current={isActive ? "step" : undefined}
            className={cn(
              "flex min-w-0 items-start rounded-xl border px-2 py-3 transition-colors sm:px-3",
              isActive || isCompleted
                ? "border-primary/25 bg-primary/5"
                : "border-border/70 bg-card text-muted-foreground",
            )}
          >
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs sm:h-8 sm:w-8 sm:text-sm",
                  isActive || isCompleted
                    ? "bg-primary font-bold text-primary-foreground"
                    : "border border-border font-semibold text-muted-foreground",
                )}
              >
                {isCompleted ? (
                  <>
                    <Check aria-hidden="true" className="h-4 w-4" />
                    <span className="sr-only">
                      Etapa {currentStep} concluída
                    </span>
                  </>
                ) : (
                  currentStep
                )}
              </span>
              <div className="min-w-0">
                <p className="hidden truncate text-[10px] font-semibold uppercase text-muted-foreground sm:block">
                  Etapa {currentStep}
                </p>
                <p className="break-words text-xs font-medium leading-snug text-foreground sm:mt-0.5 sm:text-sm">
                  {stepLabels[currentStep]}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
