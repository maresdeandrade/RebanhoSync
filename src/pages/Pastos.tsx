import { useLiveQuery } from "dexie-react-hooks";
import { Map as MapIcon, Plus, Upload } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { PageIntro } from "@/components/ui/page-intro";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/offline/db";
import { useAuth } from "@/hooks/useAuth";
import type { Pasto } from "@/lib/offline/types";

function getPastoDisplayLabels(pasto: Pasto) {
  const tipoArea = pasto.tipo_area || pasto.tipo_pasto || "Nao informado";
  const forrageira =
    pasto.forrageira_cultivar ||
    pasto.forrageira_nome ||
    pasto.forrageira_genero ||
    tipoArea;

  return { tipoArea, forrageira };
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function PastoCard({ pasto }: { pasto: Pasto }) {
  const lotesNoPasto = useLiveQuery(
    () => db.state_lotes.where("pasto_id").equals(pasto.id).toArray(),
    [pasto.id],
  );
  const ocupacaoAberta = useLiveQuery(
    () =>
      db.state_pasto_ocupacoes
        .where("pasto_id")
        .equals(pasto.id)
        .filter((ocupacao) => ocupacao.status === "aberta" && !ocupacao.deleted_at)
        .first(),
    [pasto.id],
  );
  const ultimaRonda = useLiveQuery(async () => {
    const detalhes = await db.event_eventos_pasto_avaliacao
      .where("pasto_id")
      .equals(pasto.id)
      .filter((avaliacao) => !avaliacao.deleted_at)
      .toArray();

    if (detalhes.length === 0) return null;

    const eventos = await db.event_eventos
      .bulkGet(detalhes.map((avaliacao) => avaliacao.evento_id));
    const eventosById = new Map(
      eventos.filter(Boolean).map((evento) => [evento!.id, evento!]),
    );

    return detalhes
      .map((avaliacao) => ({
        avaliacao,
        evento: eventosById.get(avaliacao.evento_id) ?? null,
      }))
      .sort((a, b) => {
        const aDate = a.evento?.occurred_at ?? a.avaliacao.created_at;
        const bDate = b.evento?.occurred_at ?? b.avaliacao.created_at;
        return bDate.localeCompare(aDate);
      })[0];
  }, [pasto.id]);
  const animaisNoPasto = useLiveQuery(async () => {
    const lotes = await db.state_lotes
      .where("pasto_id")
      .equals(pasto.id)
      .toArray();
    if (lotes.length === 0) return 0;

    let total = 0;
    for (const lote of lotes) {
      total += await db.state_animais.where("lote_id").equals(lote.id).count();
    }
    return total;
  }, [pasto.id]);
  const labels = getPastoDisplayLabels(pasto);
  const capacidade = pasto.capacidade_ua ?? 0;
  const ocupacaoUa = ocupacaoAberta?.ua_inicio ?? animaisNoPasto ?? 0;
  const percentual =
    capacidade > 0 ? Math.min(100, Math.round((ocupacaoUa / capacidade) * 100)) : 0;
  const loteAtual = lotesNoPasto?.[0]?.nome ?? "Vazio";
  const ultimaRondaData = formatDateLabel(
    ultimaRonda?.evento?.occurred_at ?? ultimaRonda?.avaliacao?.created_at,
  );

  return (
    <Link
      to={`/pastos/${pasto.id}`}
      className="flex min-h-[220px] flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-none transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-base font-semibold text-foreground">
            {pasto.nome}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {labels.forrageira} · {pasto.area_ha ?? 0} ha
          </p>
        </div>
        <StatusBadge tone={percentual >= 85 ? "warning" : "success"}>
          {percentual}%
        </StatusBadge>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Ocupacao UA</span>
          <span className="font-medium tabular-nums text-foreground">
            {ocupacaoUa} / {capacidade || "-"}
          </span>
        </div>
        <Progress value={percentual} />
      </div>

      <div className="mt-auto grid grid-cols-2 gap-4 border-t border-border/70 pt-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Lote atual
          </p>
          <p className="mt-1 truncate font-semibold text-foreground">{loteAtual}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Ultima ronda
          </p>
          <p className="mt-1 truncate font-semibold text-foreground">
            {ultimaRondaData}
          </p>
        </div>
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
      const lotes = await db.state_lotes
        .where("pasto_id")
        .equals(pasto.id)
        .toArray();
      for (const lote of lotes) {
        total += await db.state_animais
          .where("lote_id")
          .equals(lote.id)
          .count();
      }
    }

    return total;
  }, [pastos]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageIntro
        variant="plain"
        title="Pastos"
        description="Ocupacao atual e ultima ronda. Capacidade UA e descanso entram como contexto secundario."
        meta={
          <>
            <StatusBadge tone="neutral">
              {pastos?.length ?? 0} pastos
            </StatusBadge>
            <StatusBadge tone="neutral">{areaTotal.toFixed(1)} ha</StatusBadge>
          </>
        }
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

      {!pastos || pastos.length === 0 ? (
        <EmptyState
          icon={MapIcon}
          title="Nenhum pasto cadastrado"
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

