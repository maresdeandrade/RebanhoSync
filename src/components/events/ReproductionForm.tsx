import { useEffect, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { db } from "@/lib/offline/db";
import type { ReproTipoEnum } from "@/lib/offline/types";
import {
  REPRODUCTION_BULL_REFERENCE_OPTIONS,
  REPRODUCTION_TECHNIQUE_OPTIONS,
} from "@/lib/animals/catalogs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="app-surface-muted p-4 sm:p-5">
      <div className="mb-4 space-y-1">
        <h3 className="text-base font-semibold tracking-[-0.01em] text-foreground">
          {title}
        </h3>
        {description ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
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
  const machos = useLiveQuery(() => {
    return db.state_animais
      .where("fazenda_id")
      .equals(fazendaId)
      .filter(
        (animal) =>
          animal.sexo === "M" &&
          animal.status === "ativo" &&
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
        if (details && (details.tipo === "cobertura" || details.tipo === "IA")) {
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

    return enriched.filter((event): event is CandidateEpisode => event !== null);
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

  const isMachoRequired =
    data.tipo === "cobertura" || (data.tipo === "IA" && !data.loteSemen);
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      <FormSection
        title="Contexto do registro"
        description="Defina o momento do ciclo e, quando necessario, vincule o diagnostico ou parto ao servico de origem."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="repro-tipo">Tipo de evento</Label>
            <Select
              value={data.tipo}
              onValueChange={(value) => {
                onChange({
                  ...data,
                  tipo: value as ReproTipoEnum,
                  episodeEventoId: null,
                  episodeLinkMethod: undefined,
                });
              }}
            >
              <SelectTrigger id="repro-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cobertura">Cobertura (monta)</SelectItem>
                <SelectItem value="IA">Inseminacao artificial (IA)</SelectItem>
                <SelectItem value="diagnostico">
                  Diagnostico de gestacao
                </SelectItem>
                <SelectItem value="parto">Parto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {data.tipo === "diagnostico" || data.tipo === "parto" ? (
          <div className="rounded-2xl border border-border/70 bg-background/75 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Vinculo com servico
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                O sistema pode localizar automaticamente o ultimo servico aberto
                ou permitir um vinculo manual para manter o episodio coerente.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              <Label htmlFor="repro-episode">Servico relacionado</Label>
              <Select
                value={data.episodeEventoId || "auto"}
                onValueChange={(value) => {
                  if (value === "auto") {
                    onChange({
                      ...data,
                      episodeEventoId: null,
                      episodeLinkMethod: "auto_last_open_service",
                    });
                    return;
                  }

                  if (value === "unlinked") {
                    onChange({
                      ...data,
                      episodeEventoId: null,
                      episodeLinkMethod: "unlinked",
                    });
                    return;
                  }

                  onChange({
                    ...data,
                    episodeEventoId: value,
                    episodeLinkMethod: "manual",
                  });
                }}
              >
                <SelectTrigger id="repro-episode" className="w-full">
                  <SelectValue placeholder="Automatico (ultimo servico aberto)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">
                    Automatico (ultimo servico aberto)
                  </SelectItem>
                  {candidateEpisodes?.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {new Date(event.occurred_at).toLocaleDateString("pt-BR")} -{" "}
                      {event.details.tipo.toUpperCase()}
                    </SelectItem>
                  ))}
                  <SelectItem value="unlinked">Sem vinculo</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs leading-5 text-muted-foreground">
                Em partos, esse vinculo ajuda a reaproveitar o reprodutor para
                gerar a cria ja ligada ao pai correto.
              </p>
            </div>
          </div>
        ) : null}
      </FormSection>

      {data.tipo === "cobertura" || data.tipo === "IA" ? (
        <FormSection
          title="Servico e reprodutor"
          description="Registre a tecnica usada e a referencia do reprodutor para manter a rastreabilidade do ciclo."
        >
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
                      {macho.identificacao} {macho.nome ? `(${macho.nome})` : ""}
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
                  updateField("tecnicaLivre", value === "none" ? undefined : value)
                }
              >
                <SelectTrigger id="repro-tecnica">
                  <SelectValue placeholder="Selecione a tecnica" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nao informada</SelectItem>
                  {REPRODUCTION_TECHNIQUE_OPTIONS.map((option) => (
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
                onValueChange={(value) =>
                  updateField("reprodutorTag", value === "none" ? undefined : value)
                }
              >
                <SelectTrigger id="repro-tag">
                  <SelectValue placeholder="Selecione a referencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nao informado</SelectItem>
                  {REPRODUCTION_BULL_REFERENCE_OPTIONS.map((option) => (
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
        <FormSection
          title="Resultado do diagnostico"
          description="Quando o diagnostico for positivo, registre a previsao do parto para alimentar a leitura operacional."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="repro-resultado">Resultado</Label>
              <Select
                value={data.resultadoDiagnostico || "inconclusivo"}
                onValueChange={(value) => updateField("resultadoDiagnostico", value)}
              >
                <SelectTrigger id="repro-resultado">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="positivo">Positivo (prenha)</SelectItem>
                  <SelectItem value="negativo">Negativo (vazia)</SelectItem>
                  <SelectItem value="inconclusivo">Inconclusivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {data.resultadoDiagnostico === "positivo" ? (
              <div className="space-y-2">
                <Label htmlFor="repro-previsto-parto">Data prevista do parto</Label>
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
        <FormSection
          title="Parto e crias"
          description="Confirme a data real do parto e as crias geradas. A identificacao pode ficar vazia para geracao automatica."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="repro-data-parto">Data real do parto</Label>
              <Input
                id="repro-data-parto"
                type="date"
                value={data.dataParto || today}
                onChange={(event) => updateField("dataParto", event.target.value)}
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
                  <p className="text-xs text-muted-foreground">
                    Registro individual do parto
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
                    <Label htmlFor={`cria-sexo-${cria.localId}`}>Sexo</Label>
                    <Select
                      value={cria.sexo}
                      onValueChange={(value) =>
                        updateField(
                          "crias",
                          (data.crias ?? []).map((item) =>
                            item.localId === cria.localId
                              ? { ...item, sexo: value as "M" | "F" }
                              : item,
                          ),
                        )
                      }
                    >
                      <SelectTrigger id={`cria-sexo-${cria.localId}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="F">Femea</SelectItem>
                        <SelectItem value="M">Macho</SelectItem>
                      </SelectContent>
                    </Select>
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

      <FormSection
        title="Observacoes"
        description="Use este campo apenas para contexto adicional que nao cabe nos campos estruturados."
      >
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
