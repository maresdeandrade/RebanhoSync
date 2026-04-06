import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, Map as MapIcon, Plus, Upload } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/offline/db";
import { useAuth } from "@/hooks/useAuth";
import type { Pasto } from "@/lib/offline/types";

function PastoCard({ pasto }: { pasto: Pasto }) {
  const lotesNoPasto = useLiveQuery(
    () => db.state_lotes.where("pasto_id").equals(pasto.id).count(),
    [pasto.id],
  );
  const animaisNoPasto = useLiveQuery(async () => {
    const lotes = await db.state_lotes.where("pasto_id").equals(pasto.id).toArray();
    if (lotes.length === 0) return 0;

    let total = 0;
    for (const lote of lotes) {
      total += await db.state_animais.where("lote_id").equals(lote.id).count();
    }
    return total;
  }, [pasto.id]);

  return (
    <Link
      to={`/pastos/${pasto.id}`}
      className="app-surface flex flex-col gap-4 p-4 transition-shadow hover:shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{pasto.nome}</p>
          <p className="text-sm text-muted-foreground">
            {pasto.area_ha} ha {pasto.capacidade_ua ? `| ${pasto.capacidade_ua} UA` : ""}
          </p>
        </div>
        <StatusBadge tone="neutral">{pasto.tipo_pasto ?? "Nao informado"}</StatusBadge>
      </div>

      <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
        <div>
          <p className="font-medium text-foreground">{lotesNoPasto ?? 0}</p>
          <p>Lote(s) alocados</p>
        </div>
        <div>
          <p className="font-medium text-foreground">{animaisNoPasto ?? 0}</p>
          <p>Animal(is) no pasto</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/70 pt-3 text-sm">
        <span className="text-muted-foreground">Abrir detalhes e infraestrutura</span>
        <span className="inline-flex items-center gap-1 font-medium text-foreground">
          Ver pasto
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

const Pastos = () => {
  const navigate = useNavigate();
  const { activeFarmId } = useAuth();
  const pastos = useLiveQuery(async () => {
    if (!activeFarmId) return [];
    return db.state_pastos
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((pasto) => !pasto.deleted_at)
      .toArray();
  }, [activeFarmId]);

  const capacidadeTotal = (pastos ?? []).reduce(
    (total, pasto) => total + (pasto.capacidade_ua ?? 0),
    0,
  );
  const areaTotal = (pastos ?? []).reduce(
    (total, pasto) => total + (pasto.area_ha ?? 0),
    0,
  );
  const animaisNoCampo = useLiveQuery(async () => {
    if (!pastos?.length) return 0;

    let total = 0;
    for (const pasto of pastos) {
      const lotes = await db.state_lotes.where("pasto_id").equals(pasto.id).toArray();
      for (const lote of lotes) {
        total += await db.state_animais.where("lote_id").equals(lote.id).count();
      }
    }

    return total;
  }, [pastos]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Estrutura do rebanho"
        title="Pastos"
        description="Centralize area, lotacao e infraestrutura em uma leitura simples para decidir movimentacoes sem ruido visual."
        actions={
          <>
            <Link to="/pastos/importar">
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Importar planilha
              </Button>
            </Link>
            <Button onClick={() => navigate("/pastos/novo")}>
              <Plus className="mr-2 h-4 w-4" />
              Novo pasto
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Pastos cadastrados"
          value={pastos?.length ?? 0}
          hint={`${areaTotal.toFixed(1)} ha em area total cadastrada.`}
          icon={<MapIcon className="h-4 w-4" />}
        />
        <MetricCard
          label="Capacidade declarada"
          value={capacidadeTotal.toFixed(1)}
          hint="UA usadas como referencia de lotacao."
        />
        <MetricCard
          label="Animais no campo"
          value={animaisNoCampo ?? 0}
          hint="Total distribuido nos lotes alocados aos pastos."
        />
      </div>

      {!pastos || pastos.length === 0 ? (
        <EmptyState
          icon={MapIcon}
          title="Nenhum pasto cadastrado"
          description="Cadastre as areas de pastagem para apoiar lotacao, rotacao e leitura rapida da operacao."
          action={{
            label: "Cadastrar primeiro pasto",
            onClick: () => navigate("/pastos/novo"),
          }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pastos.map((pasto) => (
            <PastoCard key={pasto.id} pasto={pasto} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Pastos;
