import React, { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Scale,
  Activity,
  ArrowRightLeft,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Layers,
  Calendar,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface TimelineFactualItem {
  id: string;
  dominio: string;
  occurred_at: string;
  animalId?: string | null;
  animalIdentificacao?: string | null;
  descricao: string;
  detalhe?: string | null;
}

interface TimelineFactualProps {
  items: TimelineFactualItem[];
  title?: string;
}

export const TimelineFactual: React.FC<TimelineFactualProps> = ({
  items,
  title = "Linha do Tempo Factual",
}) => {
  const [limit, setLimit] = useState(15);

  // Defensive sorting by occurred_at desc
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  }, [items]);

  const visibleItems = useMemo(() => {
    return sortedItems.slice(0, limit);
  }, [sortedItems, limit]);

  const getDomainIcon = (dominio: string) => {
    switch (dominio.toLowerCase()) {
      case "pesagem":
        return <Scale className="h-4 w-4 text-emerald-500" />;
      case "movimentacao":
        return <ArrowRightLeft className="h-4 w-4 text-blue-500" />;
      case "ecc":
        return <Layers className="h-4 w-4 text-purple-500" />;
      case "sanitario":
        return <Activity className="h-4 w-4 text-rose-500" />;
      case "reproducao":
        return <Sparkles className="h-4 w-4 text-amber-500" />;
      default:
        return <ShieldCheck className="h-4 w-4 text-slate-500" />;
    }
  };

  const getDomainBadgeStyle = (dominio: string) => {
    switch (dominio.toLowerCase()) {
      case "pesagem":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40";
      case "movimentacao":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40";
      case "ecc":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40";
      case "sanitario":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40";
      case "reproducao":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800";
    }
  };

  const getDomainLabel = (dominio: string) => {
    switch (dominio.toLowerCase()) {
      case "pesagem":
        return "Pesagem";
      case "movimentacao":
        return "Movimentação";
      case "ecc":
        return "ECC";
      case "sanitario":
        return "Sanitário";
      case "reproducao":
        return "Reprodução";
      default:
        return dominio.charAt(0).toUpperCase() + dominio.slice(1);
    }
  };

  const formatDateStr = (dateStr: string) => {
    try {
      const parsed = parseISO(dateStr);
      return format(parsed, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="shadow-sm border border-slate-100 dark:border-slate-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          {title}
        </CardTitle>
        <span className="text-xs text-slate-500 font-normal">
          {sortedItems.length} {sortedItems.length === 1 ? "evento" : "eventos"}
        </span>
      </CardHeader>
      <CardContent>
        {sortedItems.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">
            Nenhum evento registrado nesta linha do tempo.
          </div>
        ) : (
          <div className="relative border-l border-slate-200 dark:border-slate-800 ml-3 pl-6 space-y-6">
            {visibleItems.map((item) => (
              <div key={item.id} className="relative group">
                {/* Timeline Dot with Icon */}
                <div className="absolute -left-[38px] top-0.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-full p-1.5 shadow-sm group-hover:scale-105 transition-transform">
                  {getDomainIcon(item.dominio)}
                </div>

                <div className="flex flex-col space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      {formatDateStr(item.occurred_at)}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getDomainBadgeStyle(
                        item.dominio
                      )}`}
                    >
                      {getDomainLabel(item.dominio)}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {item.descricao}
                  </p>

                  {item.animalIdentificacao && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Animal:{" "}
                      <span className="font-semibold text-slate-600 dark:text-slate-300">
                        {item.animalIdentificacao}
                      </span>
                    </p>
                  )}

                  {item.detalhe && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic mt-0.5">
                      {item.detalhe}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {sortedItems.length > limit && (
          <div className="mt-4 pt-2 flex justify-center border-t border-slate-50 dark:border-slate-900">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLimit((prev) => prev + 15)}
              className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1.5"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Ver mais {Math.min(15, sortedItems.length - limit)} de{" "}
              {sortedItems.length - limit} eventos
            </Button>
          </div>
        )}

        {limit > 15 && sortedItems.length > 15 && (
          <div className="mt-2 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLimit(15)}
              className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1.5"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              Recolher linha do tempo
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
