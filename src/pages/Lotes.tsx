import { useLiveQuery } from "dexie-react-hooks";
import { Beef, Layers, Plus, Upload } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/offline/db";
import { useLotes } from "@/hooks/useLotes";
import type { Lote } from "@/lib/offline/types";

function LoteCard({ lote }: { lote: Lote }) {
  const pasto = useLiveQuery(
    () => (lote.pasto_id ? db.state_pastos.get(lote.pasto_id) : null),
    [lote.pasto_id],
  );
  const touro = useLiveQuery(
    () => (lote.touro_id ? db.state_animais.get(lote.touro_id) : null),
    [lote.touro_id],
  );
  const totalAnimais = useLiveQuery(
    () => db.state_animais.where("lote_id").equals(lote.id).count(),
    [lote.id],
  );
  const tipoLote =
    typeof lote.payload?.tipo === "string" && lote.payload.tipo.trim()
      ? lote.payload.tipo
      : "Agrupamento";
  const pesoMedio =
    typeof lote.payload?.peso_medio_kg === "number"
      ? `${Math.round(lote.payload.peso_medio_kg)} kg`
      : "-";

  return (
    <Link
      to={`/lotes/${lote.id}`}
      className="flex min-h-[150px] flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-none transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-base font-semibold text-foreground">{lote.nome}</p>
          <p className="truncate text-sm text-muted-foreground">{tipoLote}</p>
        </div>
        {lote.status !== "ativo" ? (
          <StatusBadge tone="neutral">Inativo</StatusBadge>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-border/70 pt-3 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Animais
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
            {typeof totalAnimais === "number" ? totalAnimais : "-"}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Peso medio
          </p>
          <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">
            {pesoMedio}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Pasto
          </p>
          <p className="mt-1 truncate text-lg font-semibold text-foreground">
            {pasto?.nome ?? "-"}
          </p>
        </div>
      </div>

      {touro ? (
        <div className="mt-auto flex items-center gap-2 text-xs text-muted-foreground">
          <Beef className="h-4 w-4" />
          <span className="truncate">Reprodutor {touro.identificacao}</span>
        </div>
      ) : null}
    </Link>
  );
}

const Lotes = () => {
  const navigate = useNavigate();
  const lotes = useLotes();

  const totalAnimais = useLiveQuery(async () => {
    if (!lotes?.length) return 0;

    let total = 0;
    for (const lote of lotes) {
      total += await db.state_animais.where("lote_id").equals(lote.id).count();
    }
    return total;
  }, [lotes]);

  const ativos = lotes?.filter((lote) => lote.status === "ativo").length ?? 0;
  const comPasto = lotes?.filter((lote) => Boolean(lote.pasto_id)).length ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageIntro
        variant="plain"
        title="Lotes"
        description="Agrupamento operacional do rebanho. Pendencias e indicadores por lote."
        meta={
          <>
            <StatusBadge tone="neutral">{lotes?.length ?? 0} lotes</StatusBadge>
            <StatusBadge tone="success">{ativos} ativos</StatusBadge>
          </>
        }
        actions={
          <>
            <Link to="/lotes/importar">
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Importar planilha
              </Button>
            </Link>
            <Button onClick={() => navigate("/lotes/novo")}>
              <Plus className="mr-2 h-4 w-4" />
              Novo lote
            </Button>
          </>
        }
      />

      {!lotes || lotes.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Nenhum lote cadastrado"
          action={{
            label: "Criar primeiro lote",
            onClick: () => navigate("/lotes/novo"),
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lotes.map((lote) => (
            <LoteCard key={lote.id} lote={lote} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Lotes;

