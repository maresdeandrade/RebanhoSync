import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeftRight,
  Calendar,
  ChevronLeft,
  Dna,
  HeartPulse,
  History,
  Scale,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnimalCategoryBadge } from "@/components/animals/AnimalCategoryBadge";
import { AnimalKinshipBadges } from "@/components/animals/AnimalKinshipBadges";
import { MoverAnimalLote } from "@/components/manejo/MoverAnimalLote";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isFemaleReproductionEligible } from "@/lib/animals/presentation";
import { classificarAnimal, getLabelCategoria } from "@/lib/domain/categorias";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { Animal, Evento, EventoReproducao } from "@/lib/offline/types";
import { buildReproductionDashboard } from "@/lib/reproduction/dashboard";
import {
  getBirthEventId,
  hasPendingNeonatalSetup,
  wasGeneratedFromBirthEvent,
} from "@/lib/reproduction/neonatal";
import { showError, showSuccess } from "@/utils/toast";

type EnrichedEvent = Evento & {
  details?: EventoReproducao;
  machoIdentificacao?: string;
};

type ReproDetailsPayload = {
  diagnostico_resultado?: unknown;
  resultado?: unknown;
  numero_crias?: unknown;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function getReproStatusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

const AnimalDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showMoverLote, setShowMoverLote] = useState(false);

  const animal = useLiveQuery(() => db.state_animais.get(id!), [id]);
  const lote = useLiveQuery(
    () => (animal?.lote_id ? db.state_lotes.get(animal.lote_id) : null),
    [animal?.lote_id],
  );
  const mae = useLiveQuery(
    () => (animal?.mae_id ? db.state_animais.get(animal.mae_id) : null),
    [animal?.mae_id],
  );
  const pai = useLiveQuery(
    () => (animal?.pai_id ? db.state_animais.get(animal.pai_id) : null),
    [animal?.pai_id],
  );
  const crias = useLiveQuery(async () => {
    if (!animal?.id || !animal.fazenda_id) return [];

    return await db.state_animais
      .where("fazenda_id")
      .equals(animal.fazenda_id)
      .filter((candidate) => candidate.mae_id === animal.id && !candidate.deleted_at)
      .sortBy("identificacao");
  }, [animal?.id, animal?.fazenda_id]);

  const eventos = useLiveQuery<EnrichedEvent[]>(async () => {
    if (!id) return [];
    const evts = await db.event_eventos
      .where("animal_id")
      .equals(id)
      .reverse()
      .sortBy("occurred_at");

    return Promise.all(
      evts.map(async (evt) => {
        if (evt.dominio === "reproducao") {
          const details = await db.event_eventos_reproducao.get(evt.id);
          let machoIdentificacao = undefined;
          if (details?.macho_id) {
            const macho = await db.state_animais.get(details.macho_id);
            machoIdentificacao = macho?.identificacao;
          }
          return { ...evt, details, machoIdentificacao } as EnrichedEvent;
        }
        return evt as EnrichedEvent;
      }),
    );
  }, [id]);

  const agenda = useLiveQuery(
    () => db.state_agenda_itens.where("animal_id").equals(id!).toArray(),
    [id],
  );

  const ultimoPeso = useLiveQuery(async () => {
    if (!id) return null;

    const registros = await db.event_eventos
      .where("animal_id")
      .equals(id)
      .filter((event) => event.dominio === "pesagem")
      .toArray();

    if (!registros.length) return null;

    const ultimo = registros.reduce((best, current) => {
      const bestTimestamp = new Date(
        best.server_received_at ?? best.occurred_at,
      ).getTime();
      const currentTimestamp = new Date(
        current.server_received_at ?? current.occurred_at,
      ).getTime();
      return currentTimestamp > bestTimestamp ? current : best;
    }, registros[0]);

    const details = await db.event_eventos_pesagem.get(ultimo.id);

    return details?.peso_kg
      ? {
          peso_kg: details.peso_kg,
          data: ultimo.server_received_at || ultimo.occurred_at,
        }
      : null;
  }, [id]);
  const historicoPeso = useLiveQuery(async () => {
    if (!id) return [];

    const registros = await db.event_eventos
      .where("animal_id")
      .equals(id)
      .filter((event) => event.dominio === "pesagem" && !event.deleted_at)
      .toArray();

    const pontos = await Promise.all(
      registros.map(async (event) => {
        const details = await db.event_eventos_pesagem.get(event.id);
        if (!details?.peso_kg) return null;

        const dataReferencia = event.server_received_at || event.occurred_at;
        return {
          id: event.id,
          data: dataReferencia.slice(0, 10),
          dataLabel: formatDate(dataReferencia),
          pesoKg: details.peso_kg,
        };
      }),
    );

    return pontos
      .filter(
        (
          ponto,
        ): ponto is {
          id: string;
          data: string;
          dataLabel: string;
          pesoKg: number;
        } => ponto !== null,
      )
      .sort((left, right) => left.data.localeCompare(right.data));
  }, [id]);

  const proximaAgenda = useLiveQuery(async () => {
    if (!animal) return null;
    const hoje = new Date().toISOString().split("T")[0];
    const agendas = await db.state_agenda_itens
      .where("[fazenda_id+data_prevista]")
      .between([animal.fazenda_id, hoje], [animal.fazenda_id, "9999-12-31"])
      .filter(
        (item) =>
          item.animal_id === animal.id &&
          item.status === "agendado" &&
          (!item.deleted_at || item.deleted_at === null),
      )
      .toArray();

    return agendas.sort(
      (left, right) =>
        new Date(left.data_prevista).getTime() -
        new Date(right.data_prevista).getTime(),
    )[0];
  }, [animal]);

  const sociedadeAtiva = useLiveQuery(async () => {
    if (!animal?.id || animal.origem !== "sociedade") return null;
    const sociedades = await db.state_animais_sociedade
      .where("[fazenda_id+animal_id]")
      .equals([animal.fazenda_id, animal.id])
      .and((item) => item.deleted_at === null && item.fim === null)
      .toArray();
    return sociedades[0] || null;
  }, [animal]);

  const contraparte = useLiveQuery(async () => {
    if (!sociedadeAtiva?.contraparte_id) return null;
    return await db.state_contrapartes.get(sociedadeAtiva.contraparte_id);
  }, [sociedadeAtiva?.contraparte_id]);

  const categorias = useLiveQuery(async () => {
    if (!animal?.fazenda_id) return [];
    return await db.state_categorias_zootecnicas
      .where("fazenda_id")
      .equals(animal.fazenda_id)
      .filter((categoria) => !categoria.deleted_at && categoria.ativa)
      .toArray();
  }, [animal?.fazenda_id]);

  const categoriaAtual =
    animal && categorias ? classificarAnimal(animal, categorias) : null;
  const categoriaLabel = categoriaAtual ? getLabelCategoria(categoriaAtual) : null;
  const isReproductionEligible =
    animal && isFemaleReproductionEligible(animal, categoriaLabel);
  const reproResumo = useMemo(() => {
    if (!animal || !isReproductionEligible) return null;

    const dashboard = buildReproductionDashboard({
      animals: [animal],
      lotes: lote ? [lote] : [],
      events: (eventos ?? [])
        .filter((evt) => evt.dominio === "reproducao" && !evt.deleted_at)
        .map((evt) => ({
          ...evt,
          details: evt.details,
        })),
    });

    return dashboard.animals[0] ?? null;
  }, [animal, isReproductionEligible, lote, eventos]);
  const resumoPeso = useMemo(() => {
    if (!historicoPeso || historicoPeso.length === 0) return null;

    const primeiro = historicoPeso[0];
    const ultimo = historicoPeso[historicoPeso.length - 1];
    const variacaoKg = ultimo.pesoKg - primeiro.pesoKg;
    const diasEntreRegistros = Math.max(
      1,
      Math.round(
        (new Date(ultimo.data).getTime() - new Date(primeiro.data).getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const ganhoMedioDiaKg =
      historicoPeso.length > 1 ? variacaoKg / diasEntreRegistros : null;

    return {
      primeiro,
      ultimo,
      variacaoKg,
      ganhoMedioDiaKg,
      totalPesagens: historicoPeso.length,
    };
  }, [historicoPeso]);
  const pendingNeonatalCount = useMemo(
    () =>
      (crias ?? []).filter((calf) => hasPendingNeonatalSetup(calf.payload)).length,
    [crias],
  );
  const isNeonatalCalf = wasGeneratedFromBirthEvent(animal.payload);
  const calfInitialRoute = useMemo(() => {
    if (!animal) return null;

    const params = new URLSearchParams();
    const birthEventId = getBirthEventId(animal.payload);
    if (birthEventId) {
      params.set("eventoId", birthEventId);
    }
    if (mae?.id) {
      params.set("mae", mae.id);
    }

    return params.size > 0
      ? `/animais/${animal.id}/cria-inicial?${params.toString()}`
      : `/animais/${animal.id}/cria-inicial`;
  }, [animal, mae?.id]);

  if (!animal) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Carregando animal...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/animais">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{animal.identificacao}</h1>
            <AnimalCategoryBadge animal={animal} categoriaLabel={categoriaLabel} />
            <Badge
              variant="outline"
              className={
                animal.sexo === "F"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-sky-200 bg-sky-50 text-sky-700"
              }
            >
              {animal.sexo === "M" ? "Macho" : "Femea"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {lote ? `Lote: ${lote.nome}` : "Sem lote definido"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              params.set("dominio", "financeiro");
              params.set("animalId", animal.id);
              if (animal.lote_id) {
                params.set("loteId", animal.lote_id);
              }
              navigate(`/registrar?${params.toString()}`);
            }}
          >
            Registrar venda
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMoverLote(true)}
          >
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Mover lote
          </Button>
          <Link to={`/animais/${id}/editar`}>
            <Button variant="outline" size="sm">
              Editar
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-none bg-primary/5 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Peso atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ultimoPeso ? (
              <div>
                <div className="flex items-center gap-2 text-2xl font-bold">
                  <Scale className="h-5 w-5 text-primary" />
                  {ultimoPeso.peso_kg} kg
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(ultimoPeso.data)}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-2xl font-bold text-muted-foreground">
                <Scale className="h-5 w-5" />
                Sem pesagem
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Informacoes basicas
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <AnimalCategoryBadge animal={animal} categoriaLabel={categoriaLabel} />
            <Badge
              variant="outline"
              className={
                animal.sexo === "F"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-sky-200 bg-sky-50 text-sky-700"
              }
            >
              {animal.sexo === "M" ? "Macho" : "Femea"}
            </Badge>
            <Badge variant="default">{animal.status}</Badge>
            {animal.origem && animal.origem !== "nascimento" && (
              <Badge variant="secondary">
                {animal.origem.charAt(0).toUpperCase() + animal.origem.slice(1)}
              </Badge>
            )}
            {animal.raca && <Badge variant="outline">{animal.raca}</Badge>}
            {animal.origem === "sociedade" && sociedadeAtiva && contraparte && (
              <Badge variant="default" className="bg-blue-600">
                {contraparte.nome}
                {sociedadeAtiva.percentual && ` (${sociedadeAtiva.percentual}%)`}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="border-none bg-primary/5 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Proximo manejo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {proximaAgenda ? formatDate(proximaAgenda.data_prevista) : "Sem agenda"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Evolucao de peso</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {resumoPeso && (
                <Badge
                  variant="outline"
                  className={
                    resumoPeso.variacaoKg >= 0
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }
                >
                  {resumoPeso.variacaoKg >= 0 ? "+" : ""}
                  {resumoPeso.variacaoKg.toFixed(1)} kg no periodo
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set("dominio", "pesagem");
                  params.set("animalId", animal.id);
                  if (animal.lote_id) {
                    params.set("loteId", animal.lote_id);
                  }
                  navigate(`/registrar?${params.toString()}`);
                }}
              >
                Registrar pesagem
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {historicoPeso && historicoPeso.length > 0 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Pesagens
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {resumoPeso?.totalPesagens ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Primeiro registro
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {resumoPeso ? `${resumoPeso.primeiro.pesoKg} kg` : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {resumoPeso?.primeiro.dataLabel ?? "Sem data"}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Ultimo registro
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {resumoPeso ? `${resumoPeso.ultimo.pesoKg} kg` : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {resumoPeso?.ultimo.dataLabel ?? "Sem data"}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    GMD
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {resumoPeso?.ganhoMedioDiaKg !== null &&
                    resumoPeso?.ganhoMedioDiaKg !== undefined
                      ? `${resumoPeso.ganhoMedioDiaKg.toFixed(2)} kg/dia`
                      : "Aguardando serie"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Media entre o primeiro e o ultimo registro
                  </p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historicoPeso}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dataLabel" tickLine={false} axisLine={false} />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(value) => `${value}kg`}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value} kg`, "Peso"]}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="pesoKg"
                      stroke="#059669"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sem historico de pesagem para acompanhar a evolucao deste animal.
            </p>
          )}
        </CardContent>
      </Card>

      <div className={`grid gap-4 ${animal.sexo === "F" ? "lg:grid-cols-2" : "grid-cols-1"}`}>
        {animal.sexo === "F" && (
          <Card className="border-rose-200 bg-rose-50/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-rose-900">
                <HeartPulse className="h-4 w-4" />
                Ciclo reprodutivo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isReproductionEligible && reproResumo ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className="border-rose-200 bg-white text-rose-800"
                    >
                      Status: {getReproStatusLabel(reproResumo.reproStatus.status)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        reproResumo.urgency === "atencao"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800"
                      }
                    >
                      {reproResumo.urgency === "atencao"
                        ? "Acao prioritaria"
                        : "Fluxo sob controle"}
                    </Badge>
                    <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                      {reproResumo.loteNome ? `Lote ${reproResumo.loteNome}` : "Sem lote"}
                    </Badge>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-white/70 bg-white/80 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Ultimo marco
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {reproResumo.lastEventLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reproResumo.lastEventDateLabel
                          ? formatDate(reproResumo.lastEventDateLabel)
                          : "Sem registro"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/70 bg-white/80 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Proximo passo
                      </p>
                      <p className="mt-1 font-semibold text-slate-900">
                        {reproResumo.nextActionLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reproResumo.nextActionDate
                          ? formatDate(reproResumo.nextActionDate)
                          : "Sem data prevista"}
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/70 bg-white/80 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Faixa do ciclo
                      </p>
                      <p className="mt-1 font-semibold capitalize text-slate-900">
                        {reproResumo.lane}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reproResumo.actionLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link to={`/animais/${animal.id}/reproducao?tipo=cobertura`}>
                      <Button size="sm">Cobertura / IA</Button>
                    </Link>
                    <Link to={`/animais/${animal.id}/reproducao?tipo=diagnostico`}>
                      <Button variant="outline" size="sm">
                        Diagnostico
                      </Button>
                    </Link>
                    <Link to={`/animais/${animal.id}/reproducao?tipo=parto`}>
                      <Button variant="outline" size="sm">
                        Parto
                      </Button>
                    </Link>
                    {pendingNeonatalCount > 0 && (
                      <Link to={`/animais/${animal.id}/pos-parto`}>
                        <Button variant="outline" size="sm">
                          Pos-parto ({pendingNeonatalCount})
                        </Button>
                      </Link>
                    )}
                  </div>
                </>
              ) : isReproductionEligible ? (
                <p className="text-sm text-muted-foreground">
                  Sem historico reprodutivo consolidado para esta matriz.
                </p>
              ) : (
                <div className="space-y-2">
                  <Badge
                    variant="outline"
                    className="border-slate-200 bg-white text-slate-700"
                  >
                    Categoria atual: {categoriaLabel ?? "Nao classificada"}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Esta femea ainda nao esta em fase reprodutiva. O fluxo de
                    reproducao so fica disponivel para novilhas e vacas.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Dna className="h-4 w-4 text-slate-600" />
              Vinculos familiares
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AnimalKinshipBadges mother={mae} father={pai} calves={crias ?? []} />
            <div className="space-y-1 text-sm text-muted-foreground">
              {mae && <p>Matriz de origem: {mae.identificacao}</p>}
              {pai && <p>Pai vinculado: {pai.identificacao}</p>}
              {(crias?.length ?? 0) > 0 && (
                <p>
                  {animal.identificacao} tem {(crias?.length ?? 0)} cria(s)
                  vinculada(s).
                </p>
              )}
              {!mae && !pai && (crias?.length ?? 0) === 0 && (
                <p>Sem vinculos maternos registrados para este animal.</p>
              )}
            </div>
            {isNeonatalCalf && calfInitialRoute && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to={calfInitialRoute}>
                    {hasPendingNeonatalSetup(animal.payload)
                      ? "Fechar ficha inicial da cria"
                      : "Acompanhar crescimento inicial"}
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {animal.origem === "sociedade" && sociedadeAtiva && contraparte && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-blue-900">
                Detalhes da sociedade
              </CardTitle>
              <Badge variant="default" className="bg-blue-600">
                {sociedadeAtiva.fim ? "Encerrada" : "Ativa"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Contraparte</p>
                <p className="font-semibold text-blue-900">{contraparte.nome}</p>
              </div>

              {sociedadeAtiva.percentual && (
                <div>
                  <p className="text-xs text-muted-foreground">Participacao da fazenda</p>
                  <p className="font-semibold text-blue-900">
                    {sociedadeAtiva.percentual}%
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Data de inicio</p>
                <p className="font-medium">{formatDate(sociedadeAtiva.inicio)}</p>
              </div>

              {sociedadeAtiva.fim && (
                <div>
                  <p className="text-xs text-muted-foreground">Data de encerramento</p>
                  <p className="font-medium">{formatDate(sociedadeAtiva.fim)}</p>
                </div>
              )}
            </div>

            {!sociedadeAtiva.fim && (
              <div className="border-t border-blue-200 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                  onClick={async () => {
                    if (!confirm("Deseja realmente encerrar esta sociedade?")) return;
                    const now = new Date().toISOString();
                    const hoje = new Date().toISOString().split("T")[0];

                    try {
                      await createGesture(animal.fazenda_id, [
                        {
                          table: "animais_sociedade",
                          action: "UPDATE",
                          record: {
                            id: sociedadeAtiva.id,
                            fim: hoje,
                            updated_at: now,
                          },
                        },
                      ]);
                      showSuccess("Sociedade encerrada!");
                    } catch {
                      showError("Erro ao encerrar sociedade.");
                    }
                  }}
                >
                  Encerrar sociedade
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid max-w-[400px] w-full grid-cols-2 bg-muted/50 p-1">
          <TabsTrigger value="timeline" className="gap-2 rounded-md">
            <History className="h-4 w-4" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-2 rounded-md">
            <Calendar className="h-4 w-4" /> Agenda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-6">
          <div className="ml-4 space-y-6 border-l-2 border-muted pl-4">
            {eventos?.length === 0 ? (
              <p className="py-4 text-muted-foreground">
                Nenhum evento registrado.
              </p>
            ) : (
              eventos?.map((evt) => (
                <div key={evt.id} className="relative">
                  <div
                    className={`absolute -left-[25px] h-4 w-4 rounded-full border-2 border-background ${
                      evt.dominio === "sanitario"
                        ? "bg-blue-500"
                        : evt.dominio === "pesagem"
                          ? "bg-emerald-500"
                          : evt.dominio === "reproducao"
                            ? "bg-rose-500"
                            : "bg-slate-500"
                    }`}
                  />
                  <div className="mb-1 flex items-start justify-between">
                    <h4 className="text-sm font-bold capitalize">
                      {evt.dominio === "reproducao" && evt.details
                        ? `Reproducao: ${evt.details.tipo}`
                        : evt.dominio}
                    </h4>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {formatDate(evt.occurred_at)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {evt.observacoes || "Manejo realizado no campo."}
                  </p>
                  {evt.dominio === "reproducao" && evt.details && (
                    <div className="mt-1 rounded border border-rose-100 bg-rose-50/50 p-2 text-xs">
                      {evt.details.macho_id && (
                        <p>Reprodutor: {evt.machoIdentificacao || evt.details.macho_id}</p>
                      )}
                      {evt.details.payload && (
                        <>
                          {typeof (evt.details.payload as ReproDetailsPayload).diagnostico_resultado ===
                            "string" && (
                            <p>
                              Diagnostico:{" "}
                              {
                                (evt.details.payload as ReproDetailsPayload)
                                  .diagnostico_resultado as string
                              }
                            </p>
                          )}
                          {typeof (evt.details.payload as ReproDetailsPayload).resultado ===
                            "string" && (
                            <p>
                              Diagnostico:{" "}
                              {
                                (evt.details.payload as ReproDetailsPayload).resultado as string
                              }
                            </p>
                          )}
                          {typeof (evt.details.payload as ReproDetailsPayload).numero_crias ===
                            "number" && (
                            <p>
                              Crias:{" "}
                              {
                                (evt.details.payload as ReproDetailsPayload)
                                  .numero_crias as number
                              }
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="agenda" className="mt-6">
          <div className="grid gap-3">
            {agenda?.map((item) => (
              <Card
                key={item.id}
                className={
                  item.status === "agendado"
                    ? "border-amber-200 bg-amber-50/30"
                    : ""
                }
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{item.tipo}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Previsto: {formatDate(item.data_prevista)}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      item.status === "agendado" ? "default" : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {item.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
            {agenda?.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">
                Sem tarefas agendadas.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <MoverAnimalLote
        animal={animal}
        open={showMoverLote}
        onOpenChange={setShowMoverLote}
        onSuccess={() => {}}
      />
    </div>
  );
};

export default AnimalDetalhe;
