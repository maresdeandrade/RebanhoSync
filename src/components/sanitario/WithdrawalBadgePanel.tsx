import React from "react";
import type { WithdrawalReadModel, WithdrawalItem } from "@/lib/sanitario/compliance/withdrawalReadModel";
import { AlertTriangle, Calendar, ShieldCheck, HelpCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface WithdrawalBadgePanelProps {
  readModel: WithdrawalReadModel | null;
  className?: string;
}

export function WithdrawalBadgePanel({ readModel, className }: WithdrawalBadgePanelProps) {
  if (!readModel) return null;

  const { status, carne, leite } = readModel;

  const hasCarneCarencia = carne && carne.status !== "sem_evento_sanitario";
  const hasLeiteCarencia = leite && leite.status !== "sem_evento_sanitario";

  // Se não houver nenhum evento sanitário cadastrado na história de aplicações deste alvo
  if (status === "sem_evento_sanitario") {
    return (
      <div className={cn("rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4.5 text-center", className)}>
        <p className="text-xs text-muted-foreground font-medium flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-4.5 w-4.5 text-muted-foreground/60" />
          Nenhuma carência sanitária ativa ou anterior registrada para este lote/animal
        </p>
      </div>
    );
  }

  const renderModalidadeCard = (title: string, item: WithdrawalItem | undefined) => {
    if (!item || item.status === "sem_evento_sanitario") return null;

    const isActive = item.status === "carencia_ativa";
    const isExpired = item.status === "carencia_expirada";
    const isIndeterminate = item.status === "carencia_indeterminada";
    const isNoSnapshot = item.status === "sem_snapshot";
    const isNoConfig = item.status === "sem_carencia_configurada";

    // Formatacao de datas
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return "-";
      const [year, month, day] = dateStr.split("-");
      return `${day}/${month}/${year}`;
    };

    return (
      <div
        className={cn(
          "rounded-xl border p-3.5 space-y-3 transition-all duration-200",
          isActive && "bg-amber-500/5 border-amber-500/20 text-amber-900 dark:text-amber-300",
          isExpired && "bg-slate-500/5 border-slate-500/10 text-muted-foreground",
          isIndeterminate && "bg-destructive/5 border-destructive/10 text-destructive",
          (isNoSnapshot || isNoConfig) && "bg-blue-500/5 border-blue-500/10 text-blue-900 dark:text-blue-300"
        )}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider">
            Modalidade: {title}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full border",
              isActive && "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
              isExpired && "bg-slate-500/10 border-slate-500/20 text-slate-500 dark:text-slate-400",
              isIndeterminate && "bg-destructive/10 border-destructive/30 text-destructive",
              (isNoSnapshot || isNoConfig) && "bg-blue-500/10 border-blue-500/30 text-blue-500"
            )}
          >
            {isActive && "Carência Ativa"}
            {isExpired && "Carência Expirada"}
            {isIndeterminate && "Carência Indeterminada"}
            {isNoSnapshot && "Sem Snapshot (Legado)"}
            {isNoConfig && "Carencia Nao Configurada"}
          </Badge>
        </div>

        {/* Informacoes de Datas e Custo/Lote se houver carência configurada */}
        {(isActive || isExpired) && (
          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-dashed border-border/40">
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground block">Aplicação</span>
              <span className="font-semibold flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 opacity-60" />
                {formatDate(item.inicio)}
              </span>
            </div>
            <div className="space-y-0.5 text-right">
              <span className="text-[10px] text-muted-foreground block">Término Estimado</span>
              <span className="font-semibold">
                {formatDate(item.fim)}
              </span>
            </div>
          </div>
        )}

        {/* Informações Complementares do Produto e Principio Ativo */}
        <div className="space-y-1 pt-1.5 border-t border-dashed border-border/40 text-xs">
          <div className="flex justify-between">
            <span className="text-[10px] text-muted-foreground">Produto:</span>
            <span className="font-semibold truncate max-w-[180px]">{item.produtoNome || "Não informado"}</span>
          </div>
          {item.principioAtivo && (
            <div className="flex justify-between">
              <span className="text-[10px] text-muted-foreground">Princípio Ativo:</span>
              <span className="font-medium truncate max-w-[180px]">{item.principioAtivo}</span>
            </div>
          )}
          {item.dias !== undefined && item.dias !== null && (
            <div className="flex justify-between">
              <span className="text-[10px] text-muted-foreground">Período de Carência:</span>
              <span className="font-semibold">{item.dias} dias</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[10px] text-muted-foreground">Rastreabilidade:</span>
            <span className="font-semibold text-[10px] uppercase">
              {item.status === "sem_snapshot" ? "Indeterminada (Legado)" : "Completa / Assistida"}
            </span>
          </div>
        </div>

        {/* Limitações e Notas explicativas */}
        {item.limitations && item.limitations.length > 0 && (
          <div className="mt-2 rounded-lg bg-black/5 dark:bg-white/5 p-2 space-y-0.5">
            <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
              <HelpCircle className="h-3 w-3" /> Limitações do Rastreamento
            </span>
            {item.limitations.map((lim, i) => (
              <p key={i} className="text-[10px] text-muted-foreground pl-4 relative before:absolute before:left-1 before:top-1.5 before:h-1 before:w-1 before:rounded-full before:bg-muted-foreground/60">
                {lim}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("space-y-3.5 rounded-2xl border border-border/80 bg-background/30 p-4.5", className)}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle className={cn(
          "h-5 w-5 shrink-0 mt-0.5",
          status === "carencia_ativa" ? "text-amber-500" : "text-slate-400"
        )} />
        <div className="space-y-1">
          <h4 className="text-sm font-bold tracking-tight">Carência Sanitária Assistida</h4>
          <p className="text-[11px] leading-normal text-muted-foreground max-w-[420px]">
            Carência sanitária calculada a partir dos eventos registrados. Não representa liberação automática para venda ou abate.
          </p>
        </div>
      </div>

      {/* Grid de Carne & Leite */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1.5">
        {hasCarneCarencia && renderModalidadeCard("Carne (Abate)", carne)}
        {hasLeiteCarencia && renderModalidadeCard("Leite", leite)}
      </div>
    </div>
  );
}
