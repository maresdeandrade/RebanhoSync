import { useLiveQuery } from "dexie-react-hooks";
import { Beef, ChevronRight, Layers, MapPin, Plus, Upload } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/ui/metric-card";
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

  return (
    <Link
      to={`/lotes/${lote.id}`}
      className="app-surface flex flex-col gap-4 p-4 transition-shadow hover:shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{lote.nome}</p>
          <p className="text-sm text-muted-foreground">
            {pasto?.nome ? `Pasto ${pasto.nome}` : "Sem pasto vinculado"}
          </p>
        </div>
        <StatusBadge tone={lote.status === "ativo" ? "success" : "neutral"}>
          {lote.status === "ativo" ? "Ativo" : "Inativo"}
        </StatusBadge>
      </div>

      <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          <span>{pasto?.nome ?? "Sem pasto"}</span>
        </div>
        <div className="flex items-center gap-2">
          <Beef className="h-4 w-4" />
          <span>{touro?.identificacao ?? "Sem reprodutor"}</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/70 pt-3 text-sm">
        <span className="text-muted-foreground">
          {typeof totalAnimais === "number"
            ? `${totalAnimais} animal(is) no lote`
            : "Carregando ocupacao"}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-foreground">
          Ver lote
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
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
    <div className="space-y-6">
      <PageIntro
        eyebrow="Estrutura do rebanho"
        title="Lotes"
        description="Agrupe animais por manejo, fase ou local de permanencia sem poluir a rotina com excesso de controles."
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

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Lotes cadastrados"
          value={lotes?.length ?? 0}
          hint={`${ativos} ativo(s) na rotina atual.`}
          icon={<Layers className="h-4 w-4" />}
        />
        <MetricCard
          label="Animais alocados"
          value={totalAnimais ?? 0}
          hint="Total somado entre todos os lotes ativos e inativos."
        />
        <MetricCard
          label="Com pasto vinculado"
          value={comPasto}
          hint="Mostra quantos grupos ja estao posicionados no campo."
        />
      </div>

      {!lotes || lotes.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Nenhum lote cadastrado"
          description="Crie lotes para organizar a operacao por fase, local ou estrategia de manejo."
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
