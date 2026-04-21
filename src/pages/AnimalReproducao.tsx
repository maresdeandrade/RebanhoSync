import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CalendarClock, ChevronLeft, Dna, HeartPulse, History } from "lucide-react";

import {
  ReproductionForm,
  type ReproductionEventData,
} from "@/components/events/ReproductionForm";
import { AnimalCategoryBadge } from "@/components/animals/AnimalCategoryBadge";
import { AnimalKinshipBadges } from "@/components/animals/AnimalKinshipBadges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { useAuth } from "@/hooks/useAuth";
import { deriveAnimalTaxonomy } from "@/lib/animals/taxonomy";
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

const REPRO_STATUS_LABEL: Record<string, string> = {
  VAZIA: "Vazia / aberta",
  SERVIDA: "Servida",
  PRENHA: "Prenha",
  PARIDA_PUERPERIO: "Parida em puerperio",
  PARIDA_ABERTA: "Parida e aberta",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatEventLabel(tipo?: string | null) {
  if (tipo === "cobertura") return "Cobertura";
  if (tipo === "IA") return "Inseminacao artificial";
  if (tipo === "diagnostico") return "Diagnostico";
  if (tipo === "parto") return "Parto";
  return "Registro reprodutivo";
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

function getStatusTone(status: string | null | undefined) {
  if (status === "PRENHA") return "success";
  if (status === "SERVIDA") return "info";
  if (status?.startsWith("PARIDA")) return "warning";
  return "neutral";
}

function getUrgencyTone(urgency: string | null | undefined) {
  if (urgency === "atencao") return "warning";
  return "success";
}

function getEventTone(tipo: string | null | undefined) {
  if (tipo === "parto") return "warning";
  if (tipo === "diagnostico") return "success";
  return "info";
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
  const { farmLifecycleConfig } = useAuth();
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

  const categoriaLabel = animal
    ? deriveAnimalTaxonomy(animal, {
        config: farmLifecycleConfig,
      }).display.categoria
    : null;
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
      const { eventId, calfIds } = await registerReproductionGesture({
        fazendaId: animal.fazenda_id,
        animalId: animal.id,
        animalIdentificacao: animal.identificacao,
        loteId: animal.lote_id,
        data,
      });
      showSuccess("Evento registrado com sucesso. Sincronizacao pendente.");

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
    <div className="space-y-5">
      <PageIntro
        eyebrow="Fluxo dedicado da matriz"
        title={`Reproducao da matriz ${animal.identificacao}`}
        description="Contexto do ciclo, formulario concentrado e historico recente na mesma tela para registrar o proximo passo sem dispersao."
        meta={
          <>
            <AnimalCategoryBadge animal={animal} categoriaLabel={categoriaLabel} />
            <StatusBadge tone={getStatusTone(reproResumo?.reproStatus.status)}>
              {reproResumo
                ? REPRO_STATUS_LABEL[reproResumo.reproStatus.status] ??
                  reproResumo.reproStatus.status
                : "Sem leitura"}
            </StatusBadge>
            <StatusBadge tone={getUrgencyTone(reproResumo?.urgency)}>
              {reproResumo?.urgency === "atencao"
                ? "Passo prioritario"
                : "Fluxo sob controle"}
            </StatusBadge>
            <StatusBadge tone="neutral">
              {lote ? `Lote ${lote.nome}` : "Sem lote definido"}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(`/animais/${animal.id}`)}
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar para ficha
            </Button>
            <Button asChild variant="outline">
              <Link to={`/registrar?dominio=reproducao&animalId=${animal.id}`}>
                Abrir modo completo
              </Link>
            </Button>
          </>
        }
      />

      <Toolbar>
        <ToolbarGroup className="gap-2">
          <Button
            type="button"
            size="sm"
            variant={data.tipo === "cobertura" || data.tipo === "IA" ? "default" : "outline"}
            onClick={() => setData((previous) => withTipo(previous, "cobertura"))}
          >
            <Dna className="h-4 w-4" />
            Cobertura / IA
          </Button>
          <Button
            type="button"
            size="sm"
            variant={data.tipo === "diagnostico" ? "default" : "outline"}
            onClick={() => setData((previous) => withTipo(previous, "diagnostico"))}
          >
            <HeartPulse className="h-4 w-4" />
            Diagnostico
          </Button>
          <Button
            type="button"
            size="sm"
            variant={data.tipo === "parto" ? "default" : "outline"}
            onClick={() => setData((previous) => withTipo(previous, "parto"))}
          >
            <CalendarClock className="h-4 w-4" />
            Parto
          </Button>
        </ToolbarGroup>
        <ToolbarGroup className="gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link to={`/animais/${animal.id}`}>Abrir ficha completa</Link>
          </Button>
        </ToolbarGroup>
      </Toolbar>

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Status atual"
          value={
            reproResumo
              ? REPRO_STATUS_LABEL[reproResumo.reproStatus.status] ??
                reproResumo.reproStatus.status
              : "Sem leitura"
          }
          hint={lote ? `Lote ${lote.nome}` : "Sem lote definido"}
          tone={
            reproResumo?.reproStatus.status === "PRENHA"
              ? "success"
              : reproResumo?.reproStatus.status === "SERVIDA"
                ? "info"
                : reproResumo?.reproStatus.status?.startsWith("PARIDA")
                  ? "warning"
                  : "default"
          }
        />
        <MetricCard
          label="Ultimo marco"
          value={reproResumo?.lastEventLabel ?? "Sem historico"}
          hint={
            reproResumo?.lastEventDateLabel
              ? formatDate(reproResumo.lastEventDateLabel)
              : "Sem data registrada"
          }
        />
        <MetricCard
          label="Proximo passo"
          value={reproResumo?.nextActionLabel ?? "Registrar primeiro evento"}
          hint={
            reproResumo?.nextActionDate
              ? formatDate(reproResumo.nextActionDate)
              : "Sem data prevista"
          }
          tone={reproResumo?.urgency === "atencao" ? "warning" : "info"}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <Card>
          <CardHeader>
            <CardTitle>Registrar evento reprodutivo</CardTitle>
            <CardDescription>
              Campos organizados por bloco logico, com um unico CTA final para
              gravar o evento da matriz.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ReproductionForm
              fazendaId={animal.fazenda_id}
              animalId={animal.id}
              data={data}
              onChange={setData}
            />

            <div className="app-divider" />

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="ghost" asChild>
                <Link to={`/registrar?dominio=reproducao&animalId=${animal.id}`}>
                  Modo completo
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to={`/animais/${animal.id}`}>Cancelar</Link>
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar evento"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contexto operacional</CardTitle>
              <CardDescription>
                Leitura rapida do ciclo, parentesco e sinais que influenciam o
                registro atual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="app-surface-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Lote atual
                  </p>
                  <p className="mt-2 font-medium">
                    {lote?.nome ?? "Sem lote definido"}
                  </p>
                </div>
                <div className="app-surface-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Nivel de atencao
                  </p>
                  <p className="mt-2 font-medium">
                    {reproResumo?.urgency === "atencao"
                      ? "Passo prioritario"
                      : "Sem alerta imediato"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Vinculos maternos
                </p>
                <AnimalKinshipBadges mother={mae} calves={crias ?? []} />
                <p className="text-sm leading-6 text-muted-foreground">
                  {mae
                    ? `Matriz de origem: ${mae.identificacao}.`
                    : "Sem matriz de origem registrada."}{" "}
                  {(crias?.length ?? 0) > 0
                    ? `${animal.identificacao} possui ${(crias?.length ?? 0)} cria(s) vinculada(s).`
                    : "Nenhuma cria vinculada ate o momento."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Historico reprodutivo recente</CardTitle>
              </div>
              <CardDescription>
                Sequencia real dos ultimos registros da matriz, sem transformar a
                timeline em formulario.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(eventos ?? []).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                  Nenhum evento reprodutivo registrado para esta matriz.
                </div>
              ) : (
                (eventos ?? []).slice(0, 6).map((event) => (
                  <div
                    key={event.id}
                    className="rounded-2xl border border-border/70 bg-muted/30 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {formatEventLabel(event.details?.tipo)}
                        </p>
                        <StatusBadge tone={getEventTone(event.details?.tipo)}>
                          {formatEventLabel(event.details?.tipo)}
                        </StatusBadge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(event.occurred_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {event.observacoes || "Sem observacoes adicionais."}
                    </p>
                    {event.details?.macho_id ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Reprodutor: {event.machoIdentificacao || event.details.macho_id}
                      </p>
                    ) : null}
                  </div>
                ))
              )}

              <Button variant="outline" asChild className="w-full">
                <Link to={`/animais/${animal.id}`}>Abrir timeline completa</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
