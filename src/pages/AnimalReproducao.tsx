import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  Dna,
  HeartPulse,
  History,
} from "lucide-react";
import {
  ReproductionForm,
  type ReproductionEventData,
} from "@/components/events/ReproductionForm";
import { AnimalCategoryBadge } from "@/components/animals/AnimalCategoryBadge";
import { AnimalKinshipBadges } from "@/components/animals/AnimalKinshipBadges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { classificarAnimal, getLabelCategoria } from "@/lib/domain/categorias";
import { isFemaleReproductionEligible } from "@/lib/animals/presentation";
import { EventValidationError } from "@/lib/events/validators";
import { db } from "@/lib/offline/db";
import type { Evento, EventoReproducao, ReproTipoEnum } from "@/lib/offline/types";
import { buildReproductionDashboard } from "@/lib/reproduction/dashboard";
import { registerReproductionGesture } from "@/lib/reproduction/register";
import { showError, showSuccess } from "@/utils/toast";

type EnrichedEvent = Evento & {
  details?: EventoReproducao;
  machoIdentificacao?: string;
};

const INITIAL_FORM: ReproductionEventData = {
  tipo: "cobertura",
  machoId: null,
  observacoes: "",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-BR");
}

function isReproTipoEnum(value: string | null): value is ReproTipoEnum {
  return (
    value === "cobertura" ||
    value === "IA" ||
    value === "diagnostico" ||
    value === "parto"
  );
}

function getRecommendedTipo(status: string | null | undefined): ReproTipoEnum {
  if (status === "SERVIDA") return "diagnostico";
  if (status === "PRENHA") return "parto";
  return "cobertura";
}

function withTipo(
  previous: ReproductionEventData,
  tipo: ReproTipoEnum,
): ReproductionEventData {
  return {
    ...previous,
    tipo,
    episodeEventoId: null,
    episodeLinkMethod: undefined,
  };
}

export default function AnimalReproducao() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<ReproductionEventData>(INITIAL_FORM);
  const [initializedTipo, setInitializedTipo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const animal = useLiveQuery(() => db.state_animais.get(id!), [id]);
  const lote = useLiveQuery(
    () => (animal?.lote_id ? db.state_lotes.get(animal.lote_id) : null),
    [animal?.lote_id],
  );
  const mae = useLiveQuery(
    () => (animal?.mae_id ? db.state_animais.get(animal.mae_id) : null),
    [animal?.mae_id],
  );
  const crias = useLiveQuery(async () => {
    if (!animal?.id || !animal.fazenda_id) return [];

    return await db.state_animais
      .where("fazenda_id")
      .equals(animal.fazenda_id)
      .filter((candidate) => candidate.mae_id === animal.id && !candidate.deleted_at)
      .sortBy("identificacao");
  }, [animal?.id, animal?.fazenda_id]);
  const categorias = useLiveQuery(async () => {
    if (!animal?.fazenda_id) return [];

    return await db.state_categorias_zootecnicas
      .where("fazenda_id")
      .equals(animal.fazenda_id)
      .filter((categoria) => !categoria.deleted_at && categoria.ativa)
      .toArray();
  }, [animal?.fazenda_id]);
  const eventos = useLiveQuery<EnrichedEvent[]>(async () => {
    if (!id) return [];

    const headers = await db.event_eventos
      .where("animal_id")
      .equals(id)
      .filter((event) => event.dominio === "reproducao" && !event.deleted_at)
      .reverse()
      .sortBy("occurred_at");

    return await Promise.all(
      headers.map(async (event) => {
        const details = await db.event_eventos_reproducao.get(event.id);
        let machoIdentificacao = undefined;

        if (details?.macho_id) {
          const macho = await db.state_animais.get(details.macho_id);
          machoIdentificacao = macho?.identificacao;
        }

        return {
          ...event,
          details,
          machoIdentificacao,
        };
      }),
    );
  }, [id]);

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
      events: eventos ?? [],
    });

    return dashboard.animals[0] ?? null;
  }, [animal, isReproductionEligible, lote, eventos]);
  const queryTipo = searchParams.get("tipo");

  useEffect(() => {
    if (!isReproTipoEnum(queryTipo)) return;

    setData((previous) => withTipo(previous, queryTipo));
    setInitializedTipo(true);
  }, [queryTipo]);

  useEffect(() => {
    if (initializedTipo || !reproResumo) return;

    setData((previous) =>
      withTipo(previous, getRecommendedTipo(reproResumo.reproStatus.status)),
    );
    setInitializedTipo(true);
  }, [initializedTipo, reproResumo]);

  const handleSave = async () => {
    if (!animal) return;

    setIsSaving(true);
    try {
      const { txId, eventId, calfIds } = await registerReproductionGesture({
        fazendaId: animal.fazenda_id,
        animalId: animal.id,
        animalIdentificacao: animal.identificacao,
        loteId: animal.lote_id,
        data,
      });
      showSuccess(`Evento reprodutivo salvo. TX: ${txId.slice(0, 8)}`);

      if (data.tipo === "parto" && calfIds.length > 0) {
        const nextParams = new URLSearchParams();
        nextParams.set("eventoId", eventId);
        calfIds.forEach((calfId) => nextParams.append("cria", calfId));
        navigate(`/animais/${animal.id}/pos-parto?${nextParams.toString()}`);
        return;
      }

      navigate(`/animais/${animal.id}`);
    } catch (error) {
      if (error instanceof EventValidationError) {
        showError(error.issues[0]?.message ?? "Dados invalidos para reproducao.");
      } else {
        showError("Erro ao salvar evento reprodutivo.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!animal) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Carregando matriz...
      </div>
    );
  }

  if (animal.sexo !== "F" || !isReproductionEligible) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fluxo dedicado a novilhas e vacas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta area so deve ser usada para femeas em fase reprodutiva.
            Categoria atual: {categoriaLabel ?? "Nao classificada"}.
          </p>
          <p className="text-sm text-muted-foreground">
            Bezerras e outras femeas fora da faixa reprodutiva nao entram no
            ciclo de cobertura, diagnostico ou parto.
          </p>
          <Button asChild>
            <Link to={`/animais/${animal.id}`}>Voltar para a ficha do animal</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-gradient-to-br from-rose-50 via-white to-amber-50 p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit gap-2"
              onClick={() => navigate(`/animais/${animal.id}`)}
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar para a ficha
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Area dedicada</Badge>
              <AnimalCategoryBadge animal={animal} categoriaLabel={categoriaLabel} />
              {reproResumo && (
                <Badge
                  variant="outline"
                  className={
                    reproResumo.urgency === "atencao"
                      ? "border-amber-200 bg-amber-100 text-amber-800"
                      : "border-emerald-200 bg-emerald-100 text-emerald-800"
                  }
                >
                  {reproResumo.urgency === "atencao"
                    ? "Passo prioritario"
                    : "Fluxo sob controle"}
                </Badge>
              )}
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Rotina reprodutiva da matriz {animal.identificacao}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Tela focada em registrar cobertura, diagnostico e parto com o
                contexto do ciclo atual, lote e vinculos familiares.
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              type="button"
              variant={data.tipo === "cobertura" || data.tipo === "IA" ? "default" : "outline"}
              className="justify-start"
              onClick={() => setData((previous) => withTipo(previous, "cobertura"))}
            >
              <Dna className="h-4 w-4" />
              Cobertura / IA
            </Button>
            <Button
              type="button"
              variant={data.tipo === "diagnostico" ? "default" : "outline"}
              className="justify-start"
              onClick={() => setData((previous) => withTipo(previous, "diagnostico"))}
            >
              <HeartPulse className="h-4 w-4" />
              Diagnostico
            </Button>
            <Button
              type="button"
              variant={data.tipo === "parto" ? "default" : "outline"}
              className="justify-start"
              onClick={() => setData((previous) => withTipo(previous, "parto"))}
            >
              <CalendarClock className="h-4 w-4" />
              Parto
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-rose-700" />
              Leitura do ciclo atual
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Status atual
              </p>
              <p className="mt-2 font-semibold">
                {reproResumo
                  ? reproResumo.reproStatus.status.replaceAll("_", " ").toLowerCase()
                  : "sem leitura"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {lote ? `Lote ${lote.nome}` : "Sem lote definido"}
              </p>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Ultimo marco
              </p>
              <p className="mt-2 font-semibold">
                {reproResumo?.lastEventLabel ?? "Sem historico"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {reproResumo?.lastEventDateLabel
                  ? formatDate(reproResumo.lastEventDateLabel)
                  : "Sem data registrada"}
              </p>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Proximo passo
              </p>
              <p className="mt-2 font-semibold">
                {reproResumo?.nextActionLabel ?? "Registrar primeiro evento"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {reproResumo?.nextActionDate
                  ? formatDate(reproResumo.nextActionDate)
                  : "Sem data prevista"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dna className="h-5 w-5 text-slate-700" />
              Vinculos maternos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AnimalKinshipBadges mother={mae} calves={crias ?? []} />
            <div className="space-y-1 text-sm text-muted-foreground">
              {mae && <p>Matriz de origem: {mae.identificacao}</p>}
              {(crias?.length ?? 0) > 0 && (
                <p>
                  {animal.identificacao} possui {(crias?.length ?? 0)} cria(s)
                  vinculada(s).
                </p>
              )}
              {!mae && (crias?.length ?? 0) === 0 && (
                <p>Sem vinculos maternos registrados para esta matriz.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Registrar evento reprodutivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <ReproductionForm
              fazendaId={animal.fazenda_id}
              animalId={animal.id}
              data={data}
              onChange={setData}
            />

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar evento"}
              </Button>
              <Button variant="outline" asChild>
                <Link to={`/animais/${animal.id}`}>Voltar para ficha</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to={`/registrar?dominio=reproducao&animalId=${animal.id}`}>
                  Abrir modo completo
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historico reprodutivo recente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(eventos ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Nenhum evento reprodutivo registrado para esta matriz.
              </div>
            ) : (
              (eventos ?? []).slice(0, 6).map((event) => (
                <div key={event.id} className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium capitalize">
                        {event.details?.tipo ?? "Registro reprodutivo"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {event.observacoes || "Sem observacoes adicionais."}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(event.occurred_at)}
                    </span>
                  </div>
                  {event.details?.macho_id && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Reprodutor: {event.machoIdentificacao || event.details.macho_id}
                    </p>
                  )}
                </div>
              ))
            )}

            <Button variant="outline" asChild className="w-full">
              <Link to={`/animais/${animal.id}`}>
                <ArrowLeft className="h-4 w-4" />
                Voltar para timeline completa
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
