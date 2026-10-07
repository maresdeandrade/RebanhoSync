import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { AnimalVisualAvatar } from "@/components/animals/AnimalVisualAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AnimalDetailHeaderProps {
  identification: string;
  name: string | null;
  sex: "M" | "F";
  sexLabel: string;
  breedLabel: string | null;
  categoryLabel: string | null;
  status: string;
  lotLabel: string;
  children: ReactNode;
}

export function AnimalDetailHeader({
  identification,
  name,
  sex,
  sexLabel,
  breedLabel,
  categoryLabel,
  status,
  lotLabel,
  children,
}: AnimalDetailHeaderProps) {
  return (
    <header className="rounded-xl border border-border/70 bg-card p-4 shadow-none">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link to="/animais" aria-label="Voltar para a lista de animais">
              <ChevronLeft />
            </Link>
          </Button>
          <AnimalVisualAvatar
            categoriaLabel={categoryLabel}
            sexo={sex}
            size="md"
            className="hidden border-border bg-muted text-primary sm:grid"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <h1 className="break-words text-2xl font-semibold text-foreground sm:text-3xl">
              {identification}{name ? ` — ${name}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground">
              {[sexLabel, breedLabel, categoryLabel].filter(Boolean).join(" · ")}
            </p>
            <p className="break-words text-sm text-muted-foreground">{lotLabel}</p>
            <Badge variant="outline">Estado atual: {status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:ml-auto lg:max-w-sm lg:justify-end">
          {children}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Estado, status e classificacao sao leitura operacional; nao autorizam venda ou abate.
      </p>
    </header>
  );
}
