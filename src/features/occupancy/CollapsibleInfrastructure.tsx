import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfrastructureCard } from "./InfrastructureCard";

interface InfrastructureData {
  cochos?: {
    estado?: string;
    quantidade?: number;
    tipo?: string;
    capacidade?: number;
  };
  bebedouros?: {
    estado?: string;
    quantidade?: number;
    tipo?: string;
    capacidade?: number;
  };
  cerca?: {
    estado?: string;
    tipo?: string;
    comprimento_metros?: number;
  };
  saleiros?: {
    estado?: string;
    quantidade?: number;
    tipo?: string;
  };
}

interface CollapsibleInfrastructureProps {
  infraestrutura: InfrastructureData;
}

export function CollapsibleInfrastructure({
  infraestrutura,
}: CollapsibleInfrastructureProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Contar itens com estado ruim
  const itemsRuim = [
    infraestrutura.cochos?.estado === "ruim",
    infraestrutura.bebedouros?.estado === "ruim",
    infraestrutura.cerca?.estado === "ruim",
    infraestrutura.saleiros?.estado === "ruim",
  ].filter(Boolean).length;

  return (
    <section className="rounded-xl border border-border/70 bg-card p-5 shadow-none sm:p-6">
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between p-0 h-auto hover:bg-transparent"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-foreground">Infraestrutura</h2>
          {itemsRuim > 0 && (
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
              {itemsRuim}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-5 w-5 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </Button>

      {isOpen && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {infraestrutura?.cochos && (
            <InfrastructureCard
              name="Cochos"
              estado={infraestrutura.cochos.estado}
              details={[
                { label: "Qtd", value: infraestrutura.cochos.quantidade || 0 },
                {
                  label: "Tipo",
                  value: infraestrutura.cochos.tipo || "Nao informado",
                },
                {
                  label: "Capacidade",
                  value: `${infraestrutura.cochos.capacidade || 0} m`,
                },
              ]}
            />
          )}
          {infraestrutura?.bebedouros && (
            <InfrastructureCard
              name="Bebedouros"
              estado={infraestrutura.bebedouros.estado}
              details={[
                {
                  label: "Qtd",
                  value: infraestrutura.bebedouros.quantidade || 0,
                },
                {
                  label: "Tipo",
                  value: infraestrutura.bebedouros.tipo || "Nao informado",
                },
                {
                  label: "Capacidade",
                  value: `${infraestrutura.bebedouros.capacidade || 0} L`,
                },
              ]}
            />
          )}
          {infraestrutura?.cerca && (
            <InfrastructureCard
              name="Cerca"
              estado={infraestrutura.cerca.estado}
              details={[
                {
                  label: "Tipo",
                  value: infraestrutura.cerca.tipo || "Nao informado",
                },
                {
                  label: "Extensão",
                  value: `${infraestrutura.cerca.comprimento_metros || 0} m`,
                },
              ]}
            />
          )}
          {infraestrutura?.saleiros && (
            <InfrastructureCard
              name="Saleiros"
              estado={infraestrutura.saleiros.estado}
              details={[
                {
                  label: "Qtd",
                  value: infraestrutura.saleiros.quantidade || 0,
                },
                {
                  label: "Tipo",
                  value: infraestrutura.saleiros.tipo || "Nao informado",
                },
              ]}
            />
          )}
        </div>
      )}
    </section>
  );
}
