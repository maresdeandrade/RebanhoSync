import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import {
  CalfInitialEditor,
  type CalfInitialDraft,
} from "@/components/animals/CalfInitialEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/useAuth";
import { formatWeightInput } from "@/lib/format/weight";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { Animal } from "@/lib/offline/types";
import { buildPostPartumOps } from "@/lib/reproduction/postPartum";
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

export default function AnimalPosParto() {
  const { farmMeasurementConfig } = useAuth();
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

  const mother = useLiveQuery(
    () => (id ? db.state_animais.get(id) : undefined),
    [id],
  );
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
      .filter(
        (candidate) => candidate.mae_id === mother.id && !candidate.deleted_at,
      )
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
  const journeyAgendaItems = useLiveQuery(async () => {
    if (!mother?.fazenda_id || !calves || calves.length === 0) return [];

    const calfIds = new Set(calves.map((calf) => calf.id));
    return await db.state_agenda_itens
      .where("fazenda_id")
      .equals(mother.fazenda_id)
      .filter(
        (item) =>
          Boolean(item.animal_id && calfIds.has(item.animal_id)) &&
          !item.deleted_at,
      )
      .toArray();
  }, [mother?.fazenda_id, calves]);

  const pastoById = useMemo(() => {
    return new Map((pastos ?? []).map((pasto) => [pasto.id, pasto]));
  }, [pastos]);
  const fallbackLoteId = mother?.lote_id ?? lotes?.[0]?.id ?? null;

  useEffect(() => {
    if (!calves || calves.length === 0) return;

    setDrafts((previous) => {
      const previousMap = new Map(
        previous.map((draft) => [draft.calfId, draft]),
      );
      return calves.map(
        (calf) =>
          previousMap.get(calf.id) ??
          getInitialDraft(
            calf,
            fallbackLoteId,
            farmMeasurementConfig.weight_unit,
          ),
      );
    });
  }, [calves, fallbackLoteId, farmMeasurementConfig.weight_unit]);

  const selectedCount = drafts.length;
  const suggestedPasto =
    motherLote?.pasto_id && pastoById.has(motherLote.pasto_id)
      ? pastoById.get(motherLote.pasto_id)
      : null;

  const updateDraft = (calfId: string, patch: Partial<CalfInitialDraft>) => {
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
    if (isSaving) return;

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
      const { ops, weighedCount, umbigoCount, agendaCount } =
        buildPostPartumOps({
          fazendaId: mother.fazenda_id,
          weightUnit: farmMeasurementConfig.weight_unit,
          mother: {
            id: mother.id,
            identificacao: mother.identificacao,
          },
          calves,
          drafts,
          occurredAt,
          birthEventId: eventId,
          existingAgendaItems: journeyAgendaItems ?? [],
        });

      if (ops.length === 0) {
        showError("Nenhuma atualizacao valida para salvar.");
        return;
      }

      await createGesture(mother.fazenda_id, ops);
      showSuccess(
        `Execução registrada com sucesso. Pós-parto finalizado para ${calves.length} cria(s). ${
          weighedCount > 0
            ? `${weighedCount} pesagem(ns) neonatal(is) registrada(s). `
            : ""
        }${
          umbigoCount > 0
            ? `${umbigoCount} cura(s) de umbigo registrada(s). `
            : ""
        }${
          agendaCount > 0
            ? `${agendaCount} etapa(s) ate o desmame criada(s). `
            : ""
        }${
          calves.length > 1 ? "Seguindo a rotina da primeira cria. " : ""
        }Sincronizacao pendente.`,
      );

      const params = new URLSearchParams();
      if (eventId) {
        params.set("eventoId", eventId);
      }
      params.set("mae", mother.id);
      for (const calf of calves) {
        params.append("cria", calf.id);
      }
      navigate(`/animais/${calves[0].id}/cria-inicial?${params.toString()}`);
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
          <Button asChild>
            <Link to={`/animais/${mother.id}`}>
              Voltar para a ficha do animal
            </Link>
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
    <div className="space-y-5">
      <PageIntro
        variant="plain"
        eyebrow="Fechamento do parto"
        title={`Pos-parto da matriz ${mother.identificacao}`}
        meta={
          <>
            <StatusBadge tone="neutral">Fluxo neonatal em lote</StatusBadge>
            <StatusBadge tone={selectedCount > 0 ? "warning" : "success"}>
              {selectedCount} cria(s) pronta(s) para revisar
            </StatusBadge>
            {motherLote ? (
              <StatusBadge tone="info">
                Lote sugerido: {motherLote.nome}
              </StatusBadge>
            ) : null}
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                navigate(`/animais/${mother.id}/reproducao?tipo=parto`)
              }
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar ao parto
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/animais/${mother.id}`}>Abrir ficha da matriz</Link>
            </Button>
          </>
        }
      />

      {drafts.length > 1 && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {drafts.length} cria(s) para revisar
              </p>
              <div className="flex h-2 w-48 overflow-hidden rounded-full bg-muted">
                <div
                  className="bg-primary transition-all"
                  style={{ width: `${(drafts.filter((d) => d.identificacao.trim()).length / drafts.length) * 100}%` }}
                />
              </div>
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
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {(calves ?? []).map((calf) => {
          const draft = drafts.find((item) => item.calfId === calf.id);
          if (!draft) return null;
          const father = calf.pai_id
            ? (fathers?.get(calf.pai_id) ?? null)
            : null;
          const nextParams = new URLSearchParams();
          if (eventId) {
            nextParams.set("eventoId", eventId);
          }
          nextParams.set("mae", mother.id);

          return (
            <Card key={calf.id} className="border-slate-200 bg-white/95">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">Conferencia inicial</CardTitle>
              </CardHeader>
              <CardContent>
                <CalfInitialEditor
                  calf={calf}
                  draft={draft}
                  mother={mother}
                  father={father}
                  lotes={lotes ?? []}
                  pastoById={pastoById}
                  weightUnit={farmMeasurementConfig.weight_unit}
                  onChange={(patch) => updateDraft(calf.id, patch)}
                  action={
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        to={`/animais/${calf.id}/cria-inicial?${nextParams.toString()}`}
                      >
                        Seguir rotina da cria
                      </Link>
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-white/90 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-end">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={() => navigate(`/animais/${mother.id}`)}
          >
            Revisar depois (voltar a ficha)
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || drafts.length === 0}
          >
            {isSaving ? "Registrando..." : "Registrar pós-parto"}
          </Button>
        </div>
      </div>
    </div>
  );
}


