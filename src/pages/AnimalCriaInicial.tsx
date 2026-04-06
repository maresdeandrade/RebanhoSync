import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ClipboardCheck,
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
import {
  CalfInitialEditor,
  type CalfInitialDraft,
} from "@/components/animals/CalfInitialEditor";
import { AnimalKinshipBadges } from "@/components/animals/AnimalKinshipBadges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/useAuth";
import { deriveAnimalTaxonomy } from "@/lib/animals/taxonomy";
import {
  formatWeight,
  formatWeightInput,
  formatWeightPerDay,
  formatWeightValue,
  getWeightInputStep,
  getWeightUnitLabel,
  parseWeightInput,
} from "@/lib/format/weight";
import { db } from "@/lib/offline/db";
import type { Animal, AgendaItem } from "@/lib/offline/types";
import { createGesture } from "@/lib/offline/ops";
import {
  buildCalfJourneyCompletionOps,
  getCalfJourneyMilestoneKey,
  getCalfJourneyStage,
  isCalfJourneyAgendaItem,
} from "@/lib/reproduction/calfJourney";
import {
  getBirthEventId,
  getNeonatalSetup,
  hasPendingNeonatalSetup,
  wasGeneratedFromBirthEvent,
} from "@/lib/reproduction/neonatal";
import { buildPostPartumOps } from "@/lib/reproduction/postPartum";
import { showError, showSuccess } from "@/utils/toast";

type TimelineItem = {
  id: string;
  occurredAt: string;
  title: string;
  detail: string;
  tone: string;
};

type JourneyActionDraft = {
  pesoKg: string;
  loteId: string;
};

const KEEP_CURRENT_LOTE = "__manter_lote__";

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-BR");
}

function getInitialDraft(
  calf: Animal,
  fallbackLoteId: string | null,
  weightUnit: "kg" | "arroba",
): CalfInitialDraft {
  const neonatalSetup = getNeonatalSetup(calf.payload);
  return {
    calfId: calf.id,
    identificacao: calf.identificacao,
    nome: calf.nome ?? "",
    loteId: calf.lote_id ?? fallbackLoteId,
    pesoKg:
      typeof neonatalSetup?.initial_weight_kg === "number"
        ? formatWeightInput(neonatalSetup.initial_weight_kg, weightUnit)
        : "",
    curaUmbigo: Boolean(neonatalSetup?.umbigo_curado_at),
  };
}

export default function AnimalCriaInicial() {
  const { farmMeasurementConfig, farmLifecycleConfig } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [draft, setDraft] = useState<CalfInitialDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionDrafts, setActionDrafts] = useState<Record<string, JourneyActionDraft>>({});

  const calf = useLiveQuery(() => (id ? db.state_animais.get(id) : undefined), [id]);
  const mother = useLiveQuery(
    () => (calf?.mae_id ? db.state_animais.get(calf.mae_id) : null),
    [calf?.mae_id],
  );
  const father = useLiveQuery(
    () => (calf?.pai_id ? db.state_animais.get(calf.pai_id) : null),
    [calf?.pai_id],
  );
  const lotes = useLiveQuery(async () => {
    if (!calf?.fazenda_id) return [];

    return await db.state_lotes
      .where("fazenda_id")
      .equals(calf.fazenda_id)
      .filter((lote) => lote.status === "ativo" && !lote.deleted_at)
      .sortBy("nome");
  }, [calf?.fazenda_id]);
  const pastos = useLiveQuery(async () => {
    if (!calf?.fazenda_id) return [];

    return await db.state_pastos
      .where("fazenda_id")
      .equals(calf.fazenda_id)
      .filter((pasto) => !pasto.deleted_at)
      .sortBy("nome");
  }, [calf?.fazenda_id]);
  const journeyAgendaItems = useLiveQuery(async () => {
    if (!calf?.id) return [];

    return await db.state_agenda_itens
      .where("animal_id")
      .equals(calf.id)
      .filter((item) => !item.deleted_at && isCalfJourneyAgendaItem(item))
      .sortBy("data_prevista");
  }, [calf?.id]);
  const historicoPeso = useLiveQuery(async () => {
    if (!calf?.id) return [];

    const registros = await db.event_eventos
      .where("animal_id")
      .equals(calf.id)
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
  }, [calf?.id]);
  const timeline = useLiveQuery<TimelineItem[]>(async () => {
    if (!calf?.id) return [];

    const items: TimelineItem[] = [];
    const birthEventId = getBirthEventId(calf.payload);

    if (birthEventId) {
      const birthEvent = await db.event_eventos.get(birthEventId);
      if (birthEvent) {
        items.push({
          id: `birth-${birthEvent.id}`,
          occurredAt: birthEvent.occurred_at,
          title: "Nascimento / parto",
          detail: mother
            ? `Criada a partir do parto da matriz ${mother.identificacao}.`
            : "Cria gerada no parto.",
          tone: "bg-rose-500",
        });
      }
    }

    const ownEvents = await db.event_eventos
      .where("animal_id")
      .equals(calf.id)
      .filter((event) => !event.deleted_at)
      .toArray();

    const enriched = await Promise.all(
      ownEvents.map(async (event) => {
        if (event.dominio === "pesagem") {
          const details = await db.event_eventos_pesagem.get(event.id);
          return {
            id: event.id,
            occurredAt: event.occurred_at,
            title: "Pesagem",
            detail: details?.peso_kg
              ? formatWeight(details.peso_kg, farmMeasurementConfig.weight_unit)
              : event.observacoes || "Pesagem registrada.",
            tone: "bg-emerald-500",
          } satisfies TimelineItem;
        }

        if (event.dominio === "sanitario") {
          const details = await db.event_eventos_sanitario.get(event.id);
          return {
            id: event.id,
            occurredAt: event.occurred_at,
            title:
              details?.produto === "Cura de umbigo"
                ? "Cura do umbigo"
                : "Manejo sanitario",
            detail: details?.produto || event.observacoes || "Sem detalhe adicional.",
            tone: "bg-blue-500",
          } satisfies TimelineItem;
        }

        if (event.dominio === "nutricao") {
          const details = await db.event_eventos_nutricao.get(event.id);
          return {
            id: event.id,
            occurredAt: event.occurred_at,
            title:
              details?.alimento_nome === "Desmame" ? "Desmame" : "Manejo nutricional",
            detail:
              details?.alimento_nome || event.observacoes || "Sem detalhe adicional.",
            tone: "bg-amber-500",
          } satisfies TimelineItem;
        }

        return {
          id: event.id,
          occurredAt: event.occurred_at,
          title: event.dominio,
          detail: event.observacoes || "Manejo registrado para a cria.",
          tone: "bg-slate-500",
        } satisfies TimelineItem;
      }),
    );

    return [...items, ...enriched].sort((left, right) =>
      left.occurredAt.localeCompare(right.occurredAt),
    );
  }, [calf?.id, calf?.payload, mother?.identificacao]);

  const fallbackLoteId = calf?.lote_id ?? mother?.lote_id ?? lotes?.[0]?.id ?? null;
  const pastoById = useMemo(
    () => new Map((pastos ?? []).map((pasto) => [pasto.id, pasto])),
    [pastos],
  );
  const categoriaLabel = calf
    ? deriveAnimalTaxonomy(calf, {
        config: farmLifecycleConfig,
      }).display.categoria
    : null;
  const journeyStage = useMemo(
    () => (calf ? getCalfJourneyStage(calf, journeyAgendaItems ?? []) : null),
    [calf, journeyAgendaItems],
  );
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

  useEffect(() => {
    if (!calf) return;
    setDraft(
      getInitialDraft(calf, fallbackLoteId, farmMeasurementConfig.weight_unit),
    );
  }, [calf, fallbackLoteId, farmMeasurementConfig.weight_unit]);
  useEffect(() => {
    if (!journeyAgendaItems) return;

    setActionDrafts((current) => {
      const next = { ...current };
      for (const item of journeyAgendaItems) {
        if (next[item.id]) continue;
        next[item.id] = {
          pesoKg: "",
          loteId: KEEP_CURRENT_LOTE,
        };
      }
      return next;
    });
  }, [journeyAgendaItems]);

  const neonatalSetup = calf ? getNeonatalSetup(calf.payload) : null;
  const backToMother = useMemo(() => {
    if (!mother) return "/animais";

    const params = new URLSearchParams();
    const eventId = searchParams.get("eventoId") ?? getBirthEventId(calf?.payload ?? {});
    if (eventId) {
      params.set("eventoId", eventId);
    }
    if (calf?.id) {
      params.append("cria", calf.id);
    }

    return params.size > 0
      ? `/animais/${mother.id}/pos-parto?${params.toString()}`
      : `/animais/${mother.id}/pos-parto`;
  }, [mother, searchParams, calf?.id, calf?.payload]);

  const handleSave = async () => {
    if (!calf || !mother || !draft) return;

    if (!draft.identificacao.trim()) {
      showError("A cria precisa de identificacao final.");
      return;
    }

    setIsSaving(true);
    try {
      const occurredAt = new Date().toISOString();
      const birthEventId = getBirthEventId(calf.payload);
      const { ops, weighedCount, umbigoCount, agendaCount } = buildPostPartumOps({
        fazendaId: calf.fazenda_id,
        weightUnit: farmMeasurementConfig.weight_unit,
        mother: {
          id: mother.id,
          identificacao: mother.identificacao,
        },
        calves: [calf],
        drafts: [draft],
        occurredAt,
        birthEventId,
        existingAgendaItems: journeyAgendaItems ?? [],
      });

      if (ops.length === 0) {
        showError("Nenhuma atualizacao valida para salvar.");
        return;
      }

      const txId = await createGesture(calf.fazenda_id, ops);
      showSuccess(
        `Ficha inicial salva. ${
          weighedCount > 0 ? `${weighedCount} pesagem inicial registrada. ` : ""
        }${
          umbigoCount > 0 ? `${umbigoCount} cura de umbigo registrada. ` : ""
        }${
          agendaCount > 0 ? `${agendaCount} marco(s) ate o desmame criado(s). ` : ""
        }TX: ${txId.slice(0, 8)}`,
      );
    } catch {
      showError("Erro ao salvar a ficha inicial da cria.");
    } finally {
      setIsSaving(false);
    }
  };
  const handleJourneyMilestone = async (item: AgendaItem) => {
    if (!calf) return;

    const itemDraft = actionDrafts[item.id] ?? {
      pesoKg: "",
      loteId: KEEP_CURRENT_LOTE,
    };

    try {
      const built = buildCalfJourneyCompletionOps({
        fazendaId: calf.fazenda_id,
        calf,
        mother: mother
          ? {
              id: mother.id,
              identificacao: mother.identificacao,
            }
          : null,
        agendaItem: item,
        pesoKg: parseWeightInput(
          itemDraft.pesoKg,
          farmMeasurementConfig.weight_unit,
        ),
        destinationLoteId:
          itemDraft.loteId === KEEP_CURRENT_LOTE ? calf.lote_id : itemDraft.loteId,
      });

      const txId = await createGesture(calf.fazenda_id, built.ops);
      showSuccess(
        `${built.milestone.title} concluido. TX: ${txId.slice(0, 8)}`,
      );
    } catch (error) {
      if (error instanceof Error) {
        showError(error.message);
        return;
      }
      showError("Falha ao concluir marco da cria.");
    }
  };

  if (!calf) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Carregando cria...
      </div>
    );
  }

  if (!wasGeneratedFromBirthEvent(calf.payload) && !calf.mae_id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ficha inicial disponivel apenas para crias vinculadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta tela foi pensada para a cria gerada no parto e vinculada a uma matriz.
          </p>
          <Button asChild>
            <Link to={`/animais/${calf.id}`}>Voltar para a ficha do animal</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Cria"
        title={`Jornada inicial da cria ${calf.identificacao}`}
        description="Finalize identificacao, lote inicial, primeira pesagem e cuidados neonatais sem sair do fluxo matriz > cria."
        meta={
          <>
            <StatusBadge tone="neutral">Rotina dedicada da cria</StatusBadge>
            <StatusBadge
              tone={hasPendingNeonatalSetup(calf.payload) ? "warning" : "success"}
            >
              {hasPendingNeonatalSetup(calf.payload)
                ? "Ajustes iniciais pendentes"
                : "Crescimento inicial em acompanhamento"}
            </StatusBadge>
            {journeyStage ? <StatusBadge tone="info">{journeyStage.label}</StatusBadge> : null}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(backToMother)}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar ao pos-parto
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/animais/${calf.id}`}>Abrir ficha completa</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Matriz"
          value={mother?.identificacao ?? "Nao informada"}
          hint={mother ? "Vinculo herdado do parto" : "Sem matriz carregada"}
          icon={<HeartPulse className="h-5 w-5" />}
        />
        <MetricCard
          label="Pai"
          value={father?.identificacao ?? "Nao informado"}
          hint={father ? "Vinculo reaproveitado do episodio" : "Sem pai no parto"}
          icon={<Dna className="h-5 w-5" />}
        />
        <MetricCard
          label="Status neonatal"
          value={
            journeyStage?.label ??
            (neonatalSetup?.completed_at ? "Fechado" : "Pendente")
          }
          hint={
            journeyStage?.helper ??
            (neonatalSetup?.completed_at
              ? `Concluido em ${formatDate(neonatalSetup.completed_at)}`
              : "Aguardando conferencia inicial")
          }
          tone={journeyStage ? "info" : neonatalSetup?.completed_at ? "success" : "warning"}
          icon={<ClipboardCheck className="h-5 w-5" />}
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-emerald-700" />
              Fechamento inicial da cria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {draft && mother ? (
              <CalfInitialEditor
                calf={calf}
                draft={draft}
                mother={mother}
                father={father}
                categoriaLabel={categoriaLabel}
                lotes={lotes ?? []}
                pastoById={pastoById}
                weightUnit={farmMeasurementConfig.weight_unit}
                onChange={(patch) =>
                  setDraft((current) => (current ? { ...current, ...patch } : current))
                }
                action={
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleSave} disabled={isSaving}>
                      {isSaving ? "Salvando..." : "Salvar ficha inicial"}
                    </Button>
                    <Button variant="outline" asChild>
                      <Link to={`/animais/${calf.id}`}>Abrir ficha completa</Link>
                    </Button>
                  </div>
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Carregando contexto da cria...
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dna className="h-5 w-5 text-slate-700" />
              Vinculos e contexto
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimalKinshipBadges mother={mother} father={father} />
            <div className="space-y-2 text-sm text-muted-foreground">
              {mother && <p>Matriz: {mother.identificacao}</p>}
              {father && <p>Pai: {father.identificacao}</p>}
              <p>
                Categoria atual: {categoriaLabel ?? "Nao classificada"}
              </p>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Resumo neonatal
              </p>
              <div className="mt-2 space-y-1 text-sm">
                <p>
                  Primeira pesagem:{" "}
                  {typeof neonatalSetup?.initial_weight_kg === "number"
                    ? formatWeight(
                        neonatalSetup.initial_weight_kg,
                        farmMeasurementConfig.weight_unit,
                      )
                    : "Nao registrada"}
                </p>
                <p>
                  Cura do umbigo:{" "}
                  {neonatalSetup?.umbigo_curado_at
                    ? formatDate(neonatalSetup.umbigo_curado_at)
                    : "Nao registrada"}
                </p>
                <p>
                  Marcos na agenda: {(journeyAgendaItems ?? []).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-sky-700" />
              Trilha da cria ate o desmame
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(journeyAgendaItems ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Salve a ficha inicial para gerar os marcos automaticos da cria.
              </p>
            ) : (
              (journeyAgendaItems ?? []).map((item) => {
                const milestoneKey = getCalfJourneyMilestoneKey(item);
                const itemDraft = actionDrafts[item.id] ?? {
                  pesoKg: "",
                  loteId: KEEP_CURRENT_LOTE,
                };
                const requiresWeight =
                  milestoneKey === "pesagem_d7" || milestoneKey === "pesagem_d30";
                const isWeaning = milestoneKey === "desmame";

                return (
                  <div key={item.id} className="rounded-xl border p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">
                          {(typeof item.payload?.milestone_label === "string"
                            ? item.payload.milestone_label
                            : item.tipo) || "Marco da cria"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Previsto para {formatDate(item.data_prevista)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className={
                            item.status === "concluido"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-amber-200 bg-amber-50 text-amber-800"
                          }
                        >
                          {item.status}
                        </Badge>
                        <Badge variant="outline">{item.dominio}</Badge>
                      </div>
                    </div>

                    {requiresWeight && item.status === "agendado" && (
                      <div className="space-y-2">
                        <Label htmlFor={`journey-weight-${item.id}`}>
                          Peso ({getWeightUnitLabel(farmMeasurementConfig.weight_unit)})
                        </Label>
                        <Input
                          id={`journey-weight-${item.id}`}
                          type="number"
                          min="0"
                          step={getWeightInputStep(farmMeasurementConfig.weight_unit)}
                          inputMode="decimal"
                          value={itemDraft.pesoKg}
                          onChange={(event) =>
                            setActionDrafts((current) => ({
                              ...current,
                              [item.id]: {
                                ...itemDraft,
                                pesoKg: event.target.value,
                              },
                            }))
                          }
                          placeholder={
                            farmMeasurementConfig.weight_unit === "arroba"
                              ? "Ex: 3,89"
                              : "Ex: 58,4"
                          }
                        />
                      </div>
                    )}

                    {isWeaning && item.status === "agendado" && (
                      <div className="space-y-2">
                        <Label>Lote de destino apos desmame</Label>
                        <Select
                          value={itemDraft.loteId}
                          onValueChange={(value) =>
                            setActionDrafts((current) => ({
                              ...current,
                              [item.id]: {
                                ...itemDraft,
                                loteId: value,
                              },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={KEEP_CURRENT_LOTE}>Manter lote atual</SelectItem>
                            {(lotes ?? []).map((lote) => (
                              <SelectItem key={lote.id} value={lote.id}>
                                {lote.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {item.status === "agendado" ? (
                        <Button size="sm" onClick={() => handleJourneyMilestone(item)}>
                          Concluir marco
                        </Button>
                      ) : item.source_evento_id ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/eventos?eventoId=${item.source_evento_id}`}>
                            Ver evento gerado
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-slate-700" />
              Leitura da fase atual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {journeyStage && (
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Estagio de vida da jornada
                </p>
                <p className="mt-1 text-xl font-semibold">{journeyStage.label}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {journeyStage.helper}
                </p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Pendentes abertas
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {(journeyAgendaItems ?? []).filter((item) => item.status === "agendado").length}
                </p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Marcos concluidos
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {(journeyAgendaItems ?? []).filter((item) => item.status === "concluido").length}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              A trilha nasce no fechamento inicial da cria e segue aberta ate o
              desmame, sempre com agenda mutavel e eventos imutaveis ao concluir cada marco.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-emerald-700" />
                Acompanhamento inicial de peso
              </CardTitle>
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
                  {formatWeight(
                    Math.abs(resumoPeso.variacaoKg),
                    farmMeasurementConfig.weight_unit,
                  )}{" "}
                  no periodo
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {historicoPeso && historicoPeso.length > 0 ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Pesagens
                    </p>
                    <p className="mt-1 text-xl font-semibold">
                      {resumoPeso?.totalPesagens ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Primeiro registro
                    </p>
                    <p className="mt-1 text-xl font-semibold">
                      {resumoPeso
                        ? formatWeight(
                            resumoPeso.primeiro.pesoKg,
                            farmMeasurementConfig.weight_unit,
                          )
                        : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {resumoPeso?.primeiro.dataLabel ?? "Sem data"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      GMD
                    </p>
                    <p className="mt-1 text-xl font-semibold">
                      {formatWeightPerDay(
                        resumoPeso?.ganhoMedioDiaKg,
                        farmMeasurementConfig.weight_unit,
                      )}
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
                        tickFormatter={(value) =>
                          formatWeightValue(
                            value,
                            farmMeasurementConfig.weight_unit,
                          )
                        }
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          formatWeight(value, farmMeasurementConfig.weight_unit),
                          "Peso",
                        ]}
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
                Sem pesagens suficientes para acompanhar a curva inicial.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Timeline da cria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="ml-4 space-y-6 border-l-2 border-muted pl-4">
              {(timeline ?? []).length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  Nenhum marco registrado ainda.
                </p>
              ) : (
                (timeline ?? []).map((item) => (
                  <div key={item.id} className="relative">
                    <div
                      className={`absolute -left-[25px] h-4 w-4 rounded-full border-2 border-background ${item.tone}`}
                    />
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <h4 className="text-sm font-bold">{item.title}</h4>
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {formatDate(item.occurredAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

