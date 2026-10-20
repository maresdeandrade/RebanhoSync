import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RegistrarContextEntry = {
  kind: string;
  id: string;
  title: string;
  description: string;
  found: boolean;
};

interface RegistrarContextSummaryProps {
  hasRegistrarDisplayContext: boolean;
  registrarContextRecords: unknown;
  registrarDisplayContext: RegistrarContextEntry[];
  showTechDetails: boolean;
  setShowTechDetails: (show: boolean) => void;
}

export function RegistrarContextSummary({
  hasRegistrarDisplayContext,
  registrarContextRecords,
  registrarDisplayContext,
  showTechDetails,
  setShowTechDetails,
}: RegistrarContextSummaryProps) {
  if (!hasRegistrarDisplayContext) return null;

  return (
    <section
      aria-label="Contexto recebido"
      className="min-w-0 space-y-3 rounded-xl border border-border bg-muted/20 p-4 text-sm text-foreground"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 font-medium">
          <Info className="h-4 w-4 text-muted-foreground" />
          Contexto
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={showTechDetails}
          onClick={() => setShowTechDetails(!showTechDetails)}
          className="min-h-11 whitespace-normal text-xs text-muted-foreground"
        >
          {showTechDetails
            ? "Ocultar detalhes técnicos"
            : "Ver detalhes técnicos"}
        </Button>
      </div>
      {registrarContextRecords === undefined ? (
        <p role="status" className="text-muted-foreground">
          Carregando contexto...
        </p>
      ) : (
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          {registrarDisplayContext.map((entry) => (
            <div
              key={`${entry.kind}-${entry.id}`}
              className={cn(
                "flex min-w-0 flex-col gap-1 rounded-lg border px-3 py-2",
                entry.found
                  ? "bg-background"
                  : "border-warning/30 bg-warning/10",
              )}
            >
              <span className="text-[10px] font-medium uppercase text-muted-foreground">
                {entry.title}
              </span>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="max-w-full whitespace-normal break-words text-foreground bg-muted/50 font-normal"
                >
                  {entry.description}
                </Badge>
              </div>
              {showTechDetails && (
                <span className="break-all text-xs text-muted-foreground font-mono mt-1">
                  ID: {entry.id}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Confira o contexto recebido. O registro só será salvo após sua
        confirmação na revisão.
      </p>
    </section>
  );
}
