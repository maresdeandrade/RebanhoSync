import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import {
  CalfInitialEditor,
  type CalfInitialDraft,
} from "@/components/animals/CalfInitialEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { Animal } from "@/lib/offline/types";
import {
  buildPostPartumOps,
} from "@/lib/reproduction/postPartum";
import {
  getBirthEventId,
  getNeonatalSetup,
  hasPendingNeonatalSetup,
} from "@/lib/reproduction/neonatal";
import { showError, showSuccess } from "@/utils/toast";

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

export default function AnimalPosParto() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [drafts, setDrafts] = useState<CalfInitialDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const eventId = searchParams.get("eventoId");
  const calfIds = useMemo(
    () =>
      Array.from(
        new Set(
          searchParams
            .getAll("cria")
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ),
    [searchParams],
  );
  const calfIdsKey = calfIds.join(",");

  const mother = useLiveQuery(() => (id ? db.state_animais.get(id) : undefined), [id]);
  const motherLote = useLiveQuery(
    () => (mother?.lote_id ? db.state_lotes.get(mother.lote_id) : null),
    [mother?.lote_id],
  );
  const lotes = useLiveQuery(async () => {
    if (!mother?.fazenda_id) return [];

    return await db.state_lotes
      .where("fazenda_id")
      .equals(mother.fazenda_id)
      .filter((lote) => lote.status === "ativo" && !lote.deleted_at)
      .sortBy("nome");
  }, [mother?.fazenda_id]);
  const pastos = useLiveQuery(async () => {
    if (!mother?.fazenda_id) return [];

    return await db.state_pastos
      .where("fazenda_id")
      .equals(mother.fazenda_id)
      .filter((pasto) => !pasto.deleted_at)
      .sortBy("nome");
  }, [mother?.fazenda_id]);
  const calves = useLiveQuery(async () => {
    if (!mother?.id || !mother.fazenda_id) return [];

    const herd = await db.state_animais
      .where("fazenda_id")
      .equals(mother.fazenda_id)
      .filter((candidate) => candidate.mae_id === mother.id && !candidate.deleted_at)
      .toArray();

    let filtered = herd;
    if (calfIds.length > 0) {
      const calfIdSet = new Set(calfIds);
      filtered = herd.filter((candidate) => calfIdSet.has(candidate.id));
    } else if (eventId) {
      filtered = herd.filter(
        (candidate) => getBirthEventId(candidate.payload) === eventId,
      );
    } else {
      filtered = herd.filter((candidate) =>
        hasPendingNeonatalSetup(candidate.payload),
      );
    }

    return filtered.sort((left, right) =>
      left.identificacao.localeCompare(right.identificacao),
    );
  }, [mother?.id, mother?.fazenda_id, calfIdsKey, eventId]);
  const fathers = useLiveQuery(async () => {
    if (!calves || calves.length === 0) {
      return new Map<string, Animal>();
    }

    const fatherIds = Array.from(
      new Set(
        calves
          .map((calf) => calf.pai_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (fatherIds.length === 0) {
      return new Map<string, Animal>();
    }

    const records = await db.state_animais.bulkGet(fatherIds);
    return new Map(
      records
        .filter((animal): animal is Animal => Boolean(animal))
        .map((animal) => [animal.id, animal]),
    );
  }, [calves]);

  const pastoById = useMemo(() => {
    return new Map((pastos ?? []).map((pasto) => [pasto.id, pasto]));
  }, [pastos]);
  const fallbackLoteId = mother?.lote_id ?? lotes?.[0]?.id ?? null;

  useEffect(() => {
    if (!calves || calves.length === 0) return;

    setDrafts((previous) => {
      const previousMap = new Map(previous.map((draft) => [draft.calfId, draft]));
      return calves.map((calf) => previousMap.get(calf.id) ?? getInitialDraft(calf, fallbackLoteId));
    });
  }, [calves, fallbackLoteId]);

  const selectedCount = drafts.length;
  const suggestedPasto =
    motherLote?.pasto_id && pastoById.has(motherLote.pasto_id)
      ? pastoById.get(motherLote.pasto_id)
      : null;

  const updateDraft = (
    calfId: string,
    patch: Partial<CalfInitialDraft>,
  ) => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.calfId === calfId ? { ...draft, ...patch } : draft,
      ),
    );
  };

  const applySuggestedLoteToAll = () => {
    setDrafts((current) =>
      current.map((draft) => ({
        ...draft,
        loteId: fallbackLoteId,
      })),
    );
  };

  const handleSave = async () => {
    if (!mother || !calves || calves.length === 0) {
      showError("Nenhuma cria disponivel para finalizar o pos-parto.");
      return;
    }

    const invalidDraft = drafts.find((draft) => !draft.identificacao.trim());
    if (invalidDraft) {
      showError("Todas as crias precisam ter identificacao final.");
      return;
    }

    setIsSaving(true);
    try {
      const occurredAt = new Date().toISOString();
      const { ops, weighedCount, umbigoCount } = buildPostPartumOps({
        fazendaId: mother.fazenda_id,
        mother: {
          id: mother.id,
          identificacao: mother.identificacao,
        },
        calves,
        drafts,
        occurredAt,
        birthEventId: eventId,
      });

      if (ops.length === 0) {
        showError("Nenhuma atualizacao valida para salvar.");
        return;
      }

      const txId = await createGesture(mother.fazenda_id, ops);
      showSuccess(
        `Pos-parto finalizado para ${calves.length} cria(s). ${
          weighedCount > 0 ? `${weighedCount} pesagem(ns) neonatal(is) registrada(s). ` : ""
        }${
          umbigoCount > 0 ? `${umbigoCount} cura(s) de umbigo registrada(s). ` : ""
        }TX: ${txId.slice(0, 8)}`,
      );

      if (calves.length === 1) {
        const params = new URLSearchParams();
        if (eventId) {
          params.set("eventoId", eventId);
        }
        params.set("mae", mother.id);
        navigate(`/animais/${calves[0].id}/cria-inicial?${params.toString()}`);
        return;
      }

      navigate(`/animais/${mother.id}`);
    } catch (error) {
      void error;
      showError("Erro ao finalizar o pos-parto das crias.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!mother) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        Carregando matriz...
      </div>
    );
  }

  if (mother.sexo !== "F") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pos-parto disponivel apenas para matrizes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esta etapa serve para finalizar as crias logo apos o parto.
          </p>
          <Button asChild>
            <Link to={`/animais/${mother.id}`}>Voltar para a ficha do animal</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (calves && calves.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nenhuma cria encontrada para este parto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Evidencia insuficiente para recuperar as crias geradas neste parto.
            Reabra o fluxo pela ficha da matriz ou confira se o parto foi salvo.
          </p>
          <Button asChild>
            <Link to={`/animais/${mother.id}/reproducao?tipo=parto`}>
              Voltar ao fluxo reprodutivo
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit gap-2"
              onClick={() => navigate(`/animais/${mother.id}/reproducao?tipo=parto`)}
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar ao parto
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Fechamento do parto</Badge>
              <Badge variant="outline" className="border-amber-200 bg-white text-amber-800">
                {selectedCount} cria(s) pronta(s) para revisar
              </Badge>
              {motherLote && (
                <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-800">
                  Lote sugerido: {motherLote.nome}
                </Badge>
              )}
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Pos-parto da matriz {mother.identificacao}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Revise as crias recem-geradas, confirme a identificacao final,
                ajuste o lote inicial e avance cada cria para a rotina dedicada
                de crescimento inicial sem depender do Registrar.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Matriz
              </p>
              <p className="mt-1 text-lg font-semibold">{mother.identificacao}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(mother.updated_at)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Lote inicial
              </p>
              <p className="mt-1 text-lg font-semibold">
                {motherLote?.nome ?? "Sem lote definido"}
              </p>
              <p className="text-xs text-muted-foreground">
                {suggestedPasto ? `Pasto ${suggestedPasto.nome}` : "Sem pasto vinculado"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Evento de origem
              </p>
              <p className="mt-1 text-lg font-semibold">
                {eventId ? eventId.slice(0, 8) : "Parto atual"}
              </p>
              <p className="text-xs text-muted-foreground">
                Varia as crias sem esperar sincronizacao.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Hub do pos-parto neonatal</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Aplique o lote sugerido em lote e, quando precisar, abra a
                ficha dedicada da cria para concluir peso, umbigo e timeline.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applySuggestedLoteToAll}
              disabled={!fallbackLoteId || drafts.length === 0}
            >
              Aplicar lote sugerido a todas
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="text-sm font-medium">Identificacao final</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Cada cria pode ser fechada aqui e depois seguir para a rotina
              individual de acompanhamento.
            </p>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="text-sm font-medium">Lote e pasto inicial</div>
            <p className="mt-2 text-sm text-muted-foreground">
              O lote da matriz segue como sugestao para acelerar a largada da
              cria no rebanho.
            </p>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <div className="text-sm font-medium">Ficha da cria</div>
            <p className="mt-2 text-sm text-muted-foreground">
              A tela dedicada da cria concentra pai, matriz, peso inicial,
              cura do umbigo e timeline do nascimento.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {(calves ?? []).map((calf) => {
          const draft = drafts.find((item) => item.calfId === calf.id);
          if (!draft) return null;
          const father = calf.pai_id ? fathers?.get(calf.pai_id) ?? null : null;
          const nextParams = new URLSearchParams();
          if (eventId) {
            nextParams.set("eventoId", eventId);
          }
          nextParams.set("mae", mother.id);

          return (
            <Card key={calf.id} className="border-slate-200 bg-white/95">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">
                  Conferencia inicial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CalfInitialEditor
                  calf={calf}
                  draft={draft}
                  mother={mother}
                  father={father}
                  lotes={lotes ?? []}
                  pastoById={pastoById}
                  onChange={(patch) => updateDraft(calf.id, patch)}
                  action={
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/animais/${calf.id}/cria-inicial?${nextParams.toString()}`}>
                        Abrir rotina da cria
                      </Link>
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border bg-white/90 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          O salvamento continua atomico: identificacao, lote, primeira pesagem e
          cura do umbigo entram no mesmo gesto offline-first.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => navigate(`/animais/${mother.id}`)}>
            Revisar depois
          </Button>
          <Button onClick={handleSave} disabled={isSaving || drafts.length === 0}>
            {isSaving ? "Salvando..." : "Finalizar pos-parto"}
          </Button>
        </div>
      </div>
    </div>
  );
}
