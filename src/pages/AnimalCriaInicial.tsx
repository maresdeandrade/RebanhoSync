import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
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
import {
  CalfInitialEditor,
  type CalfInitialDraft,
} from "@/components/animals/CalfInitialEditor";
import { AnimalKinshipBadges } from "@/components/animals/AnimalKinshipBadges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { classificarAnimal, getLabelCategoria } from "@/lib/domain/categorias";
import { db } from "@/lib/offline/db";
import type { Animal, Evento } from "@/lib/offline/types";
import { createGesture } from "@/lib/offline/ops";
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

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-BR");
}

function getInitialDraft(
  calf: Animal,
  fallbackLoteId: string | null,
): CalfInitialDraft {
  const neonatalSetup = getNeonatalSetup(calf.payload);
  return {
    calfId: calf.id,
    identificacao: calf.identificacao,
    nome: calf.nome ?? "",
    loteId: calf.lote_id ?? fallbackLoteId,
    pesoKg:
      typeof neonatalSetup?.initial_weight_kg === "number"
        ? String(neonatalSetup.initial_weight_kg)
        : "",
    curaUmbigo: Boolean(neonatalSetup?.umbigo_curado_at),
  };
}

export default function AnimalCriaInicial() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [draft, setDraft] = useState<CalfInitialDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
  const categorias = useLiveQuery(async () => {
    if (!calf?.fazenda_id) return [];

    return await db.state_categorias_zootecnicas
      .where("fazenda_id")
      .equals(calf.fazenda_id)
      .filter((categoria) => !categoria.deleted_at && categoria.ativa)
      .toArray();
  }, [calf?.fazenda_id]);
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
              ? `${details.peso_kg} kg`
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
  const categoriaAtual =
    calf && categorias ? classificarAnimal(calf, categorias) : null;
  const categoriaLabel = categoriaAtual ? getLabelCategoria(categoriaAtual) : null;
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
    setDraft(getInitialDraft(calf, fallbackLoteId));
  }, [calf, fallbackLoteId]);

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
      const { ops, weighedCount, umbigoCount } = buildPostPartumOps({
        fazendaId: calf.fazenda_id,
        mother: {
          id: mother.id,
          identificacao: mother.identificacao,
        },
        calves: [calf],
        drafts: [draft],
        occurredAt,
        birthEventId,
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
        }TX: ${txId.slice(0, 8)}`,
      );
    } catch {
      showError("Erro ao salvar a ficha inicial da cria.");
    } finally {
      setIsSaving(false);
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
      <section className="rounded-3xl border bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit gap-2"
              onClick={() => navigate(backToMother)}
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar ao pos-parto da matriz
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Rotina dedicada da cria</Badge>
              {hasPendingNeonatalSetup(calf.payload) ? (
                <Badge
                  variant="outline"
                  className="border-amber-200 bg-amber-50 text-amber-800"
                >
                  Ajustes iniciais pendentes
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-emerald-800"
                >
                  Crescimento inicial em acompanhamento
                </Badge>
              )}
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Jornada inicial da cria {calf.identificacao}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Finalize a identificacao, o lote inicial, a primeira pesagem e os
                cuidados neonatais sem sair do fluxo matriz → cria.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Matriz
              </p>
              <p className="mt-1 text-lg font-semibold">
                {mother?.identificacao ?? "Nao informada"}
              </p>
              <p className="text-xs text-muted-foreground">
                {mother ? "Vinculo herdado do parto" : "Sem matriz carregada"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Pai
              </p>
              <p className="mt-1 text-lg font-semibold">
                {father?.identificacao ?? "Nao informado"}
              </p>
              <p className="text-xs text-muted-foreground">
                {father ? "Vinculo reaproveitado do episodio" : "Sem pai no parto"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Status neonatal
              </p>
              <p className="mt-1 text-lg font-semibold">
                {neonatalSetup?.completed_at ? "Fechado" : "Pendente"}
              </p>
              <p className="text-xs text-muted-foreground">
                {neonatalSetup?.completed_at
                  ? `Concluido em ${formatDate(neonatalSetup.completed_at)}`
                  : "Aguardando conferencia inicial"}
              </p>
            </div>
          </div>
        </div>
      </section>

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
                    ? `${neonatalSetup.initial_weight_kg} kg`
                    : "Nao registrada"}
                </p>
                <p>
                  Cura do umbigo:{" "}
                  {neonatalSetup?.umbigo_curado_at
                    ? formatDate(neonatalSetup.umbigo_curado_at)
                    : "Nao registrada"}
                </p>
              </div>
            </div>
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
                  {resumoPeso.variacaoKg.toFixed(1)} kg no periodo
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
                      {resumoPeso ? `${resumoPeso.primeiro.pesoKg} kg` : "-"}
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
                      {resumoPeso?.ganhoMedioDiaKg !== null &&
                      resumoPeso?.ganhoMedioDiaKg !== undefined
                        ? `${resumoPeso.ganhoMedioDiaKg.toFixed(2)} kg/dia`
                        : "Aguardando serie"}
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
