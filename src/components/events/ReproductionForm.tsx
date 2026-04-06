import { useEffect } from "react";
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

function ensureCalfDraft(index: number, current?: ReproductionCalfDraft) {
  if (current) return current;

  return {
    localId: crypto.randomUUID(),
    identificacao: "",
    sexo: index === 0 ? "F" : "M",
    nome: "",
  };
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

    const enriched = await Promise.all(
      services.map(async (event) => {
        const details = await db.event_eventos_reproducao.get(event.id);
        if (details && (details.tipo === "cobertura" || details.tipo === "IA")) {
          return { ...event, details };
        }
        return null;
      }),
    );

    return enriched.filter(
      (event): event is { id: string; occurred_at: string; details: { tipo: string } } =>
        event !== null,
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

    if (currentCalves.length === targetCount) return;

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

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de evento</Label>
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
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cobertura">Cobertura (monta)</SelectItem>
            <SelectItem value="IA">Inseminacao artificial (IA)</SelectItem>
            <SelectItem value="diagnostico">Diagnostico de gestacao</SelectItem>
            <SelectItem value="parto">Parto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(data.tipo === "diagnostico" || data.tipo === "parto") && (
        <div className="rounded-md border border-muted bg-muted/30 p-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Vinculo com servico
          </Label>
          <div className="mt-2">
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
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Automatico (ultimo servico aberto)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automatico (ultimo servico aberto)</SelectItem>
                {candidateEpisodes?.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {new Date(event.occurred_at).toLocaleDateString("pt-BR")} -{" "}
                    {event.details.tipo.toUpperCase()}
                  </SelectItem>
                ))}
                <SelectItem value="unlinked">Sem vinculo</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Para parto, o sistema pode aproveitar o macho do servico vinculado
              para gerar a cria ja ligada ao touro.
            </p>
          </div>
        </div>
      )}

      {(data.tipo === "cobertura" || data.tipo === "IA") && (
        <div className="space-y-4 border-l-2 border-primary/20 pl-3">
          <div className="space-y-2">
            <Label className={isMachoRequired ? "text-primary" : ""}>
              Reprodutor (macho) {isMachoRequired && "*"}
            </Label>
            <Select
              value={data.machoId || "none"}
              onValueChange={(value) =>
                updateField("machoId", value === "none" ? null : value)
              }
            >
              <SelectTrigger>
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
            <Label>Tecnica</Label>
            <Select
              value={data.tecnicaLivre || "none"}
              onValueChange={(value) =>
                updateField("tecnicaLivre", value === "none" ? undefined : value)
              }
            >
              <SelectTrigger>
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

          <div className="space-y-2">
            <Label>Registro do reprodutor</Label>
            <Select
              value={data.reprodutorTag || "none"}
              onValueChange={(value) =>
                updateField("reprodutorTag", value === "none" ? undefined : value)
              }
            >
              <SelectTrigger>
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
      )}

      {data.tipo === "diagnostico" && (
        <div className="space-y-4 border-l-2 border-primary/20 pl-3">
          <div className="space-y-2">
            <Label>Resultado</Label>
            <Select
              value={data.resultadoDiagnostico || "inconclusivo"}
              onValueChange={(value) => updateField("resultadoDiagnostico", value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="positivo">Positivo (prenha)</SelectItem>
                <SelectItem value="negativo">Negativo (vazia)</SelectItem>
                <SelectItem value="inconclusivo">Inconclusivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {data.resultadoDiagnostico === "positivo" && (
            <div className="space-y-2">
              <Label>Data prevista do parto</Label>
              <Input
                type="date"
                value={data.dataPrevistaParto || ""}
                onChange={(event) =>
                  updateField("dataPrevistaParto", event.target.value)
                }
              />
            </div>
          )}
        </div>
      )}

      {data.tipo === "parto" && (
        <div className="space-y-4 border-l-2 border-primary/20 pl-3">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Data real do parto</Label>
              <Input
                type="date"
                value={data.dataParto || new Date().toISOString().split("T")[0]}
                onChange={(event) => updateField("dataParto", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Numero de crias</Label>
              <Input
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
            <div>
              <Label>Crias geradas</Label>
              <p className="text-xs text-muted-foreground">
                Se a identificacao ficar vazia, o sistema gera automaticamente
                ao confirmar o parto.
              </p>
            </div>

            {(data.crias ?? []).map((cria, index) => (
              <div
                key={cria.localId}
                className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/20 p-3 md:grid-cols-[1fr_140px_1fr]"
              >
                <Input
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
                  placeholder={`Cria ${index + 1} - identificacao`}
                />

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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">Femea</SelectItem>
                    <SelectItem value="M">Macho</SelectItem>
                  </SelectContent>
                </Select>

                <Input
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
                  placeholder="Nome opcional"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 border-t pt-2">
        <Label>Observacoes</Label>
        <Textarea
          value={data.observacoes}
          onChange={(event) => updateField("observacoes", event.target.value)}
          placeholder="Detalhes adicionais..."
        />
      </div>
    </div>
  );
}
