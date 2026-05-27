import { useEffect, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { db } from "@/lib/offline/db";
import type { ReproTipoEnum } from "@/lib/offline/types";
import {
  REPRODUCTION_BULL_REFERENCE_OPTIONS,
  REPRODUCTION_TECHNIQUE_OPTIONS,
} from "@/lib/animals/catalogs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { computeReproStatus } from "@/lib/reproduction/status";
import type { ReproEventJoined } from "@/lib/reproduction/selectors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type CandidateEpisode = {
  id: string;
  occurred_at: string;
  details: {
    tipo: string;
  };
};

export interface ReproductionCalfDraft {
  localId: string;
  identificacao: string;
  sexo: "M" | "F";
  nome?: string;
}

export interface ReproductionEventData {
  tipo: ReproTipoEnum;
  machoId: string | null;
  observacoes: string;
  resultadoDiagnostico?: string;
  dataPrevistaParto?: string;
  dataParto?: string;
  numeroCrias?: number;
  crias?: ReproductionCalfDraft[];
  tecnicaLivre?: string;
  reprodutorTag?: string;
  loteSemen?: string;
  doseSemenRef?: string;
  episodeEventoId?: string | null;
  episodeLinkMethod?: "manual" | "auto_last_open_service" | "unlinked";
}

interface ReproductionFormProps {
  fazendaId: string;
  animalId?: string | null;
  data: ReproductionEventData;
  onChange: (data: ReproductionEventData) => void;
}

function ensureCalfDraft(
  index: number,
  current?: ReproductionCalfDraft,
): ReproductionCalfDraft {
  if (current) return current;

  return {
    localId: crypto.randomUUID(),
    identificacao: "",
    sexo: index === 0 ? "F" : "M",
    nome: "",
  };
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="app-surface-muted p-4 sm:p-5">
      <div className="mb-4 space-y-1">
        <h3 className="text-base font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </h3>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function ReproductionForm({
  fazendaId,
  animalId,
  data,
  onChange,
}: ReproductionFormProps) {
  const animalReproStatus = useLiveQuery(async () => {
    if (!animalId) return null;
    const services = await db.event_eventos
      .where("animal_id")
      .equals(animalId)
      .filter((event) => event.dominio === "reproducao" && !event.deleted_at)
      .toArray();

    const joined: ReproEventJoined[] = await Promise.all(
      services.map(async (s) => ({
        ...s,
        details: await db.event_eventos_reproducao.get(s.id),
      })),
    );

    return computeReproStatus(joined);
  }, [animalId]);

  const machos = useLiveQuery(() => {
    return db.state_animais
      .where("fazenda_id")
      .equals(fazendaId)
      .filter(
        (animal) =>
          animal.sexo === "M" &&
          animal.status === "ativo" &&
          animal.habilitado_monta === true &&
          (!animal.deleted_at || animal.deleted_at === null),
      )
      .toArray();
  }, [fazendaId]);

  const candidateEpisodes = useLiveQuery(async () => {
    if (!animalId || (data.tipo !== "diagnostico" && data.tipo !== "parto")) {
      return [];
    }

    const services = await db.event_eventos
      .where("animal_id")
      .equals(animalId)
      .filter((event) => event.dominio === "reproducao" && !event.deleted_at)
      .reverse()
      .sortBy("occurred_at");

    const enriched: Array<CandidateEpisode | null> = await Promise.all(
      services.map(async (event) => {
        const details = await db.event_eventos_reproducao.get(event.id);
        if (
          details &&
          (details.tipo === "cobertura" || details.tipo === "IA")
        ) {
          return {
            id: event.id,
            occurred_at: event.occurred_at,
            details: {
              tipo: details.tipo,
            },
          };
        }
        return null;
      }),
    );

    return enriched.filter(
      (event): event is CandidateEpisode => event !== null,
    );
  }, [animalId, data.tipo]);

  const updateField = (
    field: keyof ReproductionEventData,
    value: string | number | null | undefined | ReproductionCalfDraft[],
  ) => {
    onChange({ ...data, [field]: value });
  };

  useEffect(() => {
    if (data.tipo !== "parto") return;

    const targetCount = Math.max(1, data.numeroCrias ?? 1);
    const currentCalves = data.crias ?? [];

    if (
      currentCalves.length === targetCount &&
      (data.numeroCrias ?? targetCount) === targetCount
    ) {
      return;
    }

    const nextCalves = Array.from({ length: targetCount }, (_, index) =>
      ensureCalfDraft(index, currentCalves[index]),
    );

    onChange({
      ...data,
      numeroCrias: targetCount,
      crias: nextCalves,
    });
  }, [data, onChange]);

  useEffect(() => {
    if (
      data.tipo === "cobertura" &&
      data.machoId &&
      data.machoId !== "none" &&
      data.reprodutorTag !== "cadastrado_no_rebanho"
    ) {
      const timer = setTimeout(() => {
        onChange({ ...data, reprodutorTag: "cadastrado_no_rebanho" });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [data, onChange]);

  const isMachoRequired =
    data.tipo === "cobertura" || (data.tipo === "IA" && !data.loteSemen);
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <FormSection title="Contexto do registro">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="mb-3 block">Estagio do Ciclo</Label>

            {(() => {
              const statusFemea = animalReproStatus?.status;
              const showService =
                !statusFemea ||
                (statusFemea !== "SERVIDA" && statusFemea !== "PRENHA");
              const showDiagnostico =
                statusFemea === "SERVIDA" ||
                statusFemea === "PRENHA" ||
                data.tipo === "diagnostico";
              const showParto =
                statusFemea === "PRENHA" || data.tipo === "parto";

              return (
                <div className="grid grid-cols-2 gap-2">
                  {showService && (
                    <>
                      <Button
                        type="button"
                        variant={
                          data.tipo === "cobertura" ? "default" : "outline"
                        }
                        className={cn(
                          "h-auto py-3",
                          data.tipo === "cobertura" &&
                            "bg-emerald-600 hover:bg-emerald-700",
                        )}
                        onClick={() => {
                          const dpp = new Date(
                            Date.now() + 283 * 24 * 60 * 60 * 1000,
                          )
                            .toISOString()
                            .split("T")[0];
                          onChange({
                            ...data,
                            tipo: "cobertura",
                            episodeEventoId: null,
                            episodeLinkMethod: undefined,
                            dataPrevistaParto: data.dataPrevistaParto || dpp,
                          });
                        }}
                      >
                        <div className="text-left">
                          <div className="font-semibold">Cobertura</div>
                          <div className="text-xs opacity-80">
                            (Monta natural)
                          </div>
                        </div>
                      </Button>

                      <Button
                        type="button"
                        variant={data.tipo === "IA" ? "default" : "outline"}
                        className={cn(
                          "h-auto py-3",
                          data.tipo === "IA" &&
                            "bg-emerald-600 hover:bg-emerald-700",
                        )}
                        onClick={() => {
                          const dpp = new Date(
                            Date.now() + 283 * 24 * 60 * 60 * 1000,
                          )
                            .toISOString()
                            .split("T")[0];
                          onChange({
                            ...data,
                            tipo: "IA",
                            episodeEventoId: null,
                            episodeLinkMethod: undefined,
                            dataPrevistaParto: data.dataPrevistaParto || dpp,
                          });
                        }}
                      >
                        <div className="text-left">
                          <div className="font-semibold">Inseminação</div>
                          <div className="text-xs opacity-80">(IA / IATF)</div>
                        </div>
                      </Button>
                    </>
                  )}

                  {showDiagnostico && (
                    <Button
                      type="button"
                      variant={
                        data.tipo === "diagnostico" ? "default" : "outline"
                      }
                      className="h-auto py-3"
                      onClick={() => {
                        onChange({
                          ...data,
                          tipo: "diagnostico",
                          episodeEventoId: null,
                          episodeLinkMethod: "auto_last_open_service",
                        });
                      }}
                    >
                      <div className="text-left">
                        <div className="font-semibold">Diagnóstico</div>
                        <div className="text-xs opacity-80">(Toque / US)</div>
                      </div>
                    </Button>
                  )}

                  {showParto && (
                    <Button
                      type="button"
                      variant={data.tipo === "parto" ? "default" : "outline"}
                      className="h-auto py-3"
                      onClick={() => {
                        onChange({
                          ...data,
                          tipo: "parto",
                          episodeEventoId: null,
                          episodeLinkMethod: "auto_last_open_service",
                        });
                      }}
                    >
                      <div className="text-left">
                        <div className="font-semibold">Parto</div>
                        <div className="text-xs opacity-80">(Nascimento)</div>
                      </div>
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant={data.tipo === "aborto" ? "default" : "outline"}
                    className={cn(
                      "h-auto py-3",
                      data.tipo === "aborto" &&
                        "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                    )}
                    onClick={() => {
                      onChange({
                        ...data,
                        tipo: "aborto",
                        episodeEventoId: null,
                        episodeLinkMethod: "auto_last_open_service",
                      });
                    }}
                  >
                    <div className="text-left">
                      <div className="font-semibold">Aborto</div>
                      <div className="text-xs opacity-80">(Interrupção)</div>
                    </div>
                  </Button>
                </div>
              );
            })()}

            {(data.tipo === "cobertura" || data.tipo === "IA") && (
              <div className="mt-3 rounded border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
                <strong>Data Provavel de Parto (DPP):</strong>{" "}
                {data.dataPrevistaParto
                  ? new Date(data.dataPrevistaParto).toLocaleDateString("pt-BR")
                  : "Calculando..."}{" "}
                (projetada 283 dias)
              </div>
            )}
          </div>
        </div>
      </FormSection>

      {data.tipo === "cobertura" || data.tipo === "IA" ? (
        <FormSection title="Servico e reprodutor">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="repro-macho">
                Reprodutor (macho) {isMachoRequired ? "*" : ""}
              </Label>
              <Select
                value={data.machoId || "none"}
                onValueChange={(value) =>
                  updateField("machoId", value === "none" ? null : value)
                }
              >
                <SelectTrigger id="repro-macho">
                  <SelectValue placeholder="Selecione o reprodutor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nao informado / outro</SelectItem>
                  {machos?.map((macho) => (
                    <SelectItem key={macho.id} value={macho.id}>
                      {macho.identificacao}{" "}
                      {macho.nome ? `(${macho.nome})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="repro-tecnica">Tecnica</Label>
              <Select
                value={data.tecnicaLivre || "none"}
                onValueChange={(value) =>
                  updateField(
                    "tecnicaLivre",
                    value === "none" ? undefined : value,
                  )
                }
              >
                <SelectTrigger id="repro-tecnica">
                  <SelectValue placeholder="Selecione a tecnica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nao informada</SelectItem>
                  {REPRODUCTION_TECHNIQUE_OPTIONS.filter((opt) => {
                    if (data.tipo === "cobertura")
                      return (
                        opt.value.includes("monta") ||
                        opt.value.includes("repasse")
                      );
                    if (data.tipo === "IA")
                      return (
                        opt.value.includes("ia") || opt.value.includes("semen")
                      );
                    return true;
                  }).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="repro-tag">Registro do reprodutor</Label>
              <Select
                value={data.reprodutorTag || "none"}
                disabled={!!(data.machoId && data.machoId !== "none")}
                onValueChange={(value) =>
                  updateField(
                    "reprodutorTag",
                    value === "none" ? undefined : value,
                  )
                }
              >
                <SelectTrigger id="repro-tag">
                  <SelectValue placeholder="Selecione a referencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nao informado</SelectItem>
                  {REPRODUCTION_BULL_REFERENCE_OPTIONS.filter((opt) => {
                    if (data.tipo === "cobertura")
                      return !opt.value.includes("semen_lote");
                    if (data.tipo === "IA")
                      return opt.value.includes("semen_lote");
                    return true;
                  }).map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>
      ) : null}

      {data.tipo === "diagnostico" ? (
        <FormSection title="Resultado do diagnostico">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Resultado</Label>
              <div className="grid grid-cols-3 gap-2" id="repro-resultado">
                <Button
                  type="button"
                  variant={data.resultadoDiagnostico === "positivo" ? "default" : "outline"}
                  className="h-12 text-sm rounded-xl border-2"
                  onClick={() => updateField("resultadoDiagnostico", "positivo")}
                >
                  Positivo
                </Button>
                <Button
                  type="button"
                  variant={data.resultadoDiagnostico === "negativo" ? "default" : "outline"}
                  className="h-12 text-sm rounded-xl border-2"
                  onClick={() => updateField("resultadoDiagnostico", "negativo")}
                >
                  Negativo
                </Button>
                <Button
                  type="button"
                  variant={!data.resultadoDiagnostico || data.resultadoDiagnostico === "inconclusivo" ? "default" : "outline"}
                  className="h-12 text-sm rounded-xl border-2"
                  onClick={() => updateField("resultadoDiagnostico", "inconclusivo")}
                >
                  Inconclusivo
                </Button>
              </div>
            </div>

            {data.resultadoDiagnostico === "positivo" ? (
              <div className="space-y-2">
                <Label htmlFor="repro-previsto-parto">
                  Data prevista do parto
                </Label>
                <Input
                  id="repro-previsto-parto"
                  type="date"
                  value={data.dataPrevistaParto || ""}
                  onChange={(event) =>
                    updateField("dataPrevistaParto", event.target.value)
                  }
                />
              </div>
            ) : null}
          </div>
        </FormSection>
      ) : null}

      {data.tipo === "parto" ? (
        <FormSection title="Parto e crias">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="repro-data-parto">Data real do parto</Label>
              <Input
                id="repro-data-parto"
                type="date"
                value={data.dataParto || today}
                onChange={(event) =>
                  updateField("dataParto", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="repro-numero-crias">Numero de crias</Label>
              <Input
                id="repro-numero-crias"
                type="number"
                min="1"
                value={data.numeroCrias || 1}
                onChange={(event) =>
                  updateField(
                    "numeroCrias",
                    Math.max(1, Number.parseInt(event.target.value || "1", 10)),
                  )
                }
              />
            </div>
          </div>

          <div className="space-y-3">
            {(data.crias ?? []).map((cria, index) => (
              <div
                key={cria.localId}
                className="rounded-2xl border border-border/70 bg-background/75 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    Cria {index + 1}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_140px_1fr]">
                  <div className="space-y-2">
                    <Label htmlFor={`cria-identificacao-${cria.localId}`}>
                      Identificacao
                    </Label>
                    <Input
                      id={`cria-identificacao-${cria.localId}`}
                      value={cria.identificacao}
                      onChange={(event) =>
                        updateField(
                          "crias",
                          (data.crias ?? []).map((item) =>
                            item.localId === cria.localId
                              ? { ...item, identificacao: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Pode ficar em branco"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Sexo</Label>
                    <div className="grid grid-cols-2 gap-2" id={`cria-sexo-${cria.localId}`}>
                      <Button
                        type="button"
                        variant={cria.sexo === "F" ? "default" : "outline"}
                        className="h-12 text-sm rounded-xl border-2"
                        onClick={() =>
                          updateField(
                            "crias",
                            (data.crias ?? []).map((item) =>
                              item.localId === cria.localId
                                ? { ...item, sexo: "F" }
                                : item,
                            ),
                          )
                        }
                      >
                        Fêmea
                      </Button>
                      <Button
                        type="button"
                        variant={cria.sexo === "M" ? "default" : "outline"}
                        className="h-12 text-sm rounded-xl border-2"
                        onClick={() =>
                          updateField(
                            "crias",
                            (data.crias ?? []).map((item) =>
                              item.localId === cria.localId
                                ? { ...item, sexo: "M" }
                                : item,
                            ),
                          )
                        }
                      >
                        Macho
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`cria-nome-${cria.localId}`}>Nome</Label>
                    <Input
                      id={`cria-nome-${cria.localId}`}
                      value={cria.nome || ""}
                      onChange={(event) =>
                        updateField(
                          "crias",
                          (data.crias ?? []).map((item) =>
                            item.localId === cria.localId
                              ? { ...item, nome: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Opcional"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FormSection>
      ) : null}

      <FormSection title="Observacoes">
        <div className="space-y-2">
          <Label htmlFor="repro-observacoes">Detalhes adicionais</Label>
          <Textarea
            id="repro-observacoes"
            value={data.observacoes}
            onChange={(event) => updateField("observacoes", event.target.value)}
            placeholder="Detalhes adicionais do registro"
          />
        </div>
      </FormSection>
    </div>
  );
}
