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
    <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-3 text-sm text-foreground">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 font-medium">
          <Info className="h-4 w-4 text-muted-foreground" />
          Contexto
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTechDetails(!showTechDetails)}
          className="h-8 text-xs text-muted-foreground"
        >
          {showTechDetails ? "Ocultar detalhes técnicos" : "Ver detalhes técnicos"}
        </Button>
      </div>
      {registrarContextRecords === undefined ? (
        <p className="text-muted-foreground">Carregando contexto...</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {registrarDisplayContext.map((entry) => (
            <div
              key={`${entry.kind}-${entry.id}`}
              className={cn(
                "flex flex-col gap-1 rounded-lg border px-3 py-2",
                entry.found ? "bg-background" : "border-warning/30 bg-warning/10",
              )}
            >
              <span className="text-[10px] font-medium uppercase text-muted-foreground">
                {entry.title}
              </span>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-foreground bg-muted/50 font-normal"
                >
                  {entry.description}
                </Badge>
              </div>
              {showTechDetails && (
                <span className="text-[10px] text-muted-foreground/70 font-mono mt-1">
                  ID: {entry.id}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
