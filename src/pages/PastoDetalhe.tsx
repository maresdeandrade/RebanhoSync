import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Map as MapIcon, PawPrint, Pencil, Ruler, Trees } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/offline/db";

const PastoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const pasto = useLiveQuery(() => (id ? db.state_pastos.get(id) : undefined), [id]);
  const lotes = useLiveQuery(
    () => (id ? db.state_lotes.where("pasto_id").equals(id).toArray() : []),
    [id],
  );
  const animaisCount = useLiveQuery(async () => {
    if (!id) return 0;

    const lotesNoPasto = await db.state_lotes.where("pasto_id").equals(id).toArray();
    let total = 0;
    for (const lote of lotesNoPasto) {
      total += await db.state_animais.where("lote_id").equals(lote.id).count();
    }
    return total;
  }, [id]);

  if (!id || !pasto) {
    return (
      <div className="space-y-6">
        <PageIntro
          eyebrow="Estrutura do rebanho"
          title="Pasto nao encontrado"
          description="O registro nao esta mais disponivel ou ainda nao foi sincronizado neste dispositivo."
          actions={
            <Button variant="outline" onClick={() => navigate("/pastos")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          }
        />
      </div>
    );
  }

  const infraestrutura = pasto.infraestrutura;

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Estrutura do rebanho"
        title={pasto.nome}
        description="Leia area, lotacao e infraestrutura do pasto em uma unica superficie de consulta."
        meta={<StatusBadge tone="neutral">{pasto.tipo_pasto ?? "Tipo nao informado"}</StatusBadge>}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/pastos")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Link to={`/pastos/${id}/editar`}>
              <Button>
                <Pencil className="mr-2 h-4 w-4" />
                Editar cadastro
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Area"
          value={pasto.area_ha}
          hint="Hectares declarados para o piquete."
          icon={<MapIcon className="h-4 w-4" />}
        />
        <MetricCard
          label="Capacidade"
          value={pasto.capacidade_ua ?? "Nao informada"}
          hint="UA usadas como referencia de lotacao."
          icon={<Ruler className="h-4 w-4" />}
        />
        <MetricCard
          label="Animais no pasto"
          value={animaisCount ?? 0}
          hint={`${lotes?.length ?? 0} lote(s) vinculados a este pasto.`}
          icon={<PawPrint className="h-4 w-4" />}
        />
      </div>

      {infraestrutura ? (
        <section className="app-surface space-y-5 p-5 sm:p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
              Infraestrutura
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Leitura objetiva dos recursos de suporte ao manejo neste pasto.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-medium text-foreground">Cochos</p>
                <StatusBadge
                  tone={
                    infraestrutura.cochos?.estado === "ruim" ? "danger" : "neutral"
                  }
                >
                  {infraestrutura.cochos?.estado || "Sem estado"}
                </StatusBadge>
              </div>
              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                <span>Qtd: {infraestrutura.cochos?.quantidade || 0}</span>
                <span>Tipo: {infraestrutura.cochos?.tipo || "Nao informado"}</span>
                <span>Capacidade: {infraestrutura.cochos?.capacidade || 0} m</span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-medium text-foreground">Bebedouros</p>
                <StatusBadge
                  tone={
                    infraestrutura.bebedouros?.estado === "ruim"
                      ? "danger"
                      : "neutral"
                  }
                >
                  {infraestrutura.bebedouros?.estado || "Sem estado"}
                </StatusBadge>
              </div>
              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                <span>Qtd: {infraestrutura.bebedouros?.quantidade || 0}</span>
                <span>Tipo: {infraestrutura.bebedouros?.tipo || "Nao informado"}</span>
                <span>Capacidade: {infraestrutura.bebedouros?.capacidade || 0} L</span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-medium text-foreground">Cerca</p>
                <StatusBadge
                  tone={infraestrutura.cerca?.estado === "ruim" ? "danger" : "neutral"}
                >
                  {infraestrutura.cerca?.estado || "Sem estado"}
                </StatusBadge>
              </div>
              <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                <span>Tipo: {infraestrutura.cerca?.tipo || "Nao informado"}</span>
                <span>
                  Extensao: {infraestrutura.cerca?.comprimento_metros || 0} m
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-medium text-foreground">Saleiro e curral</p>
                <StatusBadge
                  tone={
                    infraestrutura.curral?.possui_brete || infraestrutura.curral?.possui_balanca
                      ? "info"
                      : "neutral"
                  }
                >
                  Apoio ao manejo
                </StatusBadge>
              </div>
              <div className="grid gap-2 text-sm text-muted-foreground">
                <span>Saleiros: {infraestrutura.saleiros?.quantidade || 0}</span>
                <span>Brete: {infraestrutura.curral?.possui_brete ? "Sim" : "Nao"}</span>
                <span>
                  Balanca: {infraestrutura.curral?.possui_balanca ? "Sim" : "Nao"}
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {lotes && lotes.length > 0 ? (
        <section className="app-surface space-y-4 p-5 sm:p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
              Lotes neste pasto
            </h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Acesse rapidamente os grupos vinculados e a lotacao atual do campo.
            </p>
          </div>

          <div className="grid gap-3">
            {lotes.map((lote) => (
              <Link
                key={lote.id}
                to={`/lotes/${lote.id}`}
                className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{lote.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {lote.status === "ativo" ? "Em operacao" : "Fora da rotina principal"}
                  </p>
                </div>
                <StatusBadge tone={lote.status === "ativo" ? "success" : "neutral"}>
                  {lote.status}
                </StatusBadge>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Trees}
          title="Nenhum lote neste pasto"
          description="Vincule um lote ao pasto para acompanhar ocupacao e lotacao diretamente por aqui."
        />
      )}
    </div>
  );
};

export default PastoDetalhe;
