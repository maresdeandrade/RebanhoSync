import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Baby, HeartPulse, MapPinned, Scale, Sparkles } from "lucide-react";
import { AnimalCategoryBadge } from "@/components/animals/AnimalCategoryBadge";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FarmWeightUnit } from "@/lib/farms/measurementConfig";
import { getWeightInputStep, getWeightUnitLabel } from "@/lib/format/weight";
import type { Animal, Lote, Pasto } from "@/lib/offline/types";
import { getNeonatalSetup } from "@/lib/reproduction/neonatal";

export const SEM_LOTE = "__sem_lote__";

export interface CalfInitialDraft {
  calfId: string;
  identificacao: string;
  nome: string;
  loteId: string | null;
  pesoKg: string;
  curaUmbigo: boolean;
}

interface CalfInitialEditorProps {
  calf: Animal;
  draft: CalfInitialDraft;
  mother: Animal;
  father?: Animal | null;
  categoriaLabel?: string | null;
  lotes: Lote[];
  pastoById: Map<string, Pasto>;
  weightUnit: FarmWeightUnit;
  onChange: (patch: Partial<CalfInitialDraft>) => void;
  action?: ReactNode;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sem data";
  return new Date(value).toLocaleDateString("pt-BR");
}

export function CalfInitialEditor({
  calf,
  draft,
  mother,
  father = null,
  categoriaLabel,
  lotes,
  pastoById,
  weightUnit,
  onChange,
  action,
}: CalfInitialEditorProps) {
  const neonatalSetup = getNeonatalSetup(calf.payload);
  const selectedLote =
    draft.loteId && lotes.find((lote) => lote.id === draft.loteId);
  const selectedPasto =
    selectedLote?.pasto_id && pastoById.has(selectedLote.pasto_id)
      ? pastoById.get(selectedLote.pasto_id)
      : null;
  const umbigoAlreadyRecorded = Boolean(neonatalSetup?.umbigo_curado_at);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Baby className="h-3.5 w-3.5" />
              Cria recem-gerada
            </Badge>
            <AnimalCategoryBadge animal={calf} categoriaLabel={categoriaLabel} />
            <Badge
              variant="outline"
              className={
                calf.sexo === "F"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-sky-200 bg-sky-50 text-sky-700"
              }
            >
              {calf.sexo === "F" ? "Femea" : "Macho"}
            </Badge>
            {neonatalSetup?.completed_at ? (
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-800"
              >
                Ficha inicial concluida
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-200 bg-amber-50 text-amber-800"
              >
                Pendente de fechamento inicial
              </Badge>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-semibold">
              {draft.identificacao || calf.identificacao}
            </h2>
            <p className="text-sm text-muted-foreground">
              Nascimento em {formatDate(calf.data_nascimento)}
            </p>
          </div>
        </div>

        {action}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Vinculo materno
          </p>
          <Link to={`/animais/${mother.id}`} className="mt-1 block font-semibold">
            {mother.identificacao}
          </Link>
          <p className="text-xs text-muted-foreground">Matriz de origem</p>
        </div>
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Vinculo paterno
          </p>
          {father ? (
            <>
              <Link to={`/animais/${father.id}`} className="mt-1 block font-semibold">
                {father.identificacao}
              </Link>
              <p className="text-xs text-muted-foreground">Pai vinculado ao parto</p>
            </>
          ) : (
            <>
              <p className="mt-1 font-semibold">Nao informado</p>
              <p className="text-xs text-muted-foreground">
                O parto nao trouxe pai vinculado
              </p>
            </>
          )}
        </div>
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Lote e pasto inicial
          </p>
          <p className="mt-1 font-semibold">
            {selectedLote?.nome ?? "Sem lote"}
          </p>
          <p className="text-xs text-muted-foreground">
            {selectedPasto ? `Pasto ${selectedPasto.nome}` : "Sem pasto vinculado"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`identificacao-${calf.id}`}>Identificacao final</Label>
          <Input
            id={`identificacao-${calf.id}`}
            value={draft.identificacao}
            onChange={(event) => onChange({ identificacao: event.target.value })}
            placeholder="Ex: BZ-2026-014"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`nome-${calf.id}`}>Nome opcional</Label>
          <Input
            id={`nome-${calf.id}`}
            value={draft.nome}
            onChange={(event) => onChange({ nome: event.target.value })}
            placeholder="Nome de manejo"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2 md:col-span-2">
          <Label>Lote inicial</Label>
          <Select
            value={draft.loteId ?? SEM_LOTE}
            onValueChange={(value) =>
              onChange({ loteId: value === SEM_LOTE ? null : value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o lote inicial" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_LOTE}>Sem lote</SelectItem>
              {lotes.map((lote) => (
                <SelectItem key={lote.id} value={lote.id}>
                  {lote.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Pasto derivado</Label>
          <div className="flex h-10 items-center rounded-md border bg-muted/20 px-3 text-sm text-muted-foreground">
            {selectedPasto ? selectedPasto.nome : "Sem pasto vinculado"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`peso-${calf.id}`}>
            Primeira pesagem ({getWeightUnitLabel(weightUnit)})
          </Label>
          <Input
            id={`peso-${calf.id}`}
            type="number"
            min="0"
            step={getWeightInputStep(weightUnit)}
            inputMode="decimal"
            value={draft.pesoKg}
            onChange={(event) => onChange({ pesoKg: event.target.value })}
            placeholder={
              weightUnit === "arroba" ? "Ex: 2,10" : "Ex: 31,5"
            }
          />
        </div>

        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <HeartPulse className="h-4 w-4 text-primary" />
            Cuidado neonatal
          </div>
          <div className="mt-3 flex items-start gap-3">
            <Checkbox
              id={`umbigo-${calf.id}`}
              checked={draft.curaUmbigo || umbigoAlreadyRecorded}
              disabled={umbigoAlreadyRecorded}
              onCheckedChange={(checked) =>
                onChange({ curaUmbigo: checked === true })
              }
            />
            <div className="space-y-1">
              <Label htmlFor={`umbigo-${calf.id}`} className="cursor-pointer">
                Registrar cura do umbigo
              </Label>
              <p className="text-xs text-muted-foreground">
                {umbigoAlreadyRecorded
                  ? `Ja registrada em ${formatDate(neonatalSetup?.umbigo_curado_at ?? null)}.`
                  : "Cria um evento sanitario proprio sem depender do Registrar."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            Identificacao
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Confirme o codigo final antes de liberar a cria para o rebanho.
          </p>
        </div>
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <MapPinned className="h-4 w-4 text-primary" />
            Lote inicial
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            O lote pode seguir a matriz ou ser ajustado para bezerreiro.
          </p>
        </div>
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Scale className="h-4 w-4 text-primary" />
            Crescimento inicial
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            A primeira pesagem alimenta a curva inicial de ganho da cria.
          </p>
        </div>
      </div>
    </div>
  );
}
