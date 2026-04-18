import type { EstadoUFEnum } from "@/lib/offline/types";
import type {
  TransitChecklistDraft,
  TransitChecklistPurpose,
} from "@/lib/sanitario/transit";
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
import { StatusBadge } from "@/components/ui/status-badge";

export function RegistrarTransitChecklistSection(input: {
  transitChecklist: TransitChecklistDraft;
  onTransitChecklistChange: (next: TransitChecklistDraft) => void;
  officialTransitChecklistEnabled: boolean;
  transitChecklistIssues: string[];
  transitPurposeOptions: Array<{ value: TransitChecklistPurpose; label: string }>;
  ufOptions: EstadoUFEnum[];
}) {
  const setTransitChecklist = (updater: (prev: TransitChecklistDraft) => TransitChecklistDraft) => {
    input.onTransitChecklistChange(updater(input.transitChecklist));
  };

  return (
    <div className="space-y-4 rounded-lg border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Transito externo e checklist GTA</p>
          <p className="text-xs text-muted-foreground">
            Use apenas quando houver saida para outra localizacao. Manejo interno entre
            lotes da mesma fazenda nao exige GTA por padrao.
          </p>
        </div>
        <StatusBadge tone={input.officialTransitChecklistEnabled ? "warning" : "neutral"}>
          {input.officialTransitChecklistEnabled ? "Overlay oficial ativo" : "Checklist manual"}
        </StatusBadge>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3">
        <Checkbox
          checked={input.transitChecklist.enabled}
          onCheckedChange={(checked) =>
            setTransitChecklist((prev) => ({
              ...prev,
              enabled: checked === true,
            }))
          }
        />
        <div className="space-y-1">
          <span className="text-sm font-medium text-foreground">
            Este manejo representa transito externo
          </span>
          <p className="text-sm text-muted-foreground">
            Ao ativar, o fluxo passa a exigir GTA/e-GTA e, em reproducao interestadual,
            os atestados sanitarios do PNCEBT.
          </p>
        </div>
      </label>

      {input.transitChecklist.enabled ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Finalidade do transito</Label>
            <Select
              value={input.transitChecklist.purpose}
              onValueChange={(value) =>
                setTransitChecklist((prev) => ({
                  ...prev,
                  purpose: value as TransitChecklistPurpose,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a finalidade" />
              </SelectTrigger>
              <SelectContent>
                {input.transitPurposeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Numero/protocolo GTA</Label>
            <Input
              value={input.transitChecklist.gtaNumber}
              onChange={(event) =>
                setTransitChecklist((prev) => ({
                  ...prev,
                  gtaNumber: event.target.value,
                }))
              }
              placeholder="Ex.: eGTA-2026-000123"
            />
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3 md:col-span-2">
            <Checkbox
              checked={input.transitChecklist.gtaChecked}
              onCheckedChange={(checked) =>
                setTransitChecklist((prev) => ({
                  ...prev,
                  gtaChecked: checked === true,
                }))
              }
            />
            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground">
                Checklist de GTA/e-GTA concluido
              </span>
              <p className="text-sm text-muted-foreground">
                Confirma a revisao documental minima antes de liberar o transito.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3 md:col-span-2">
            <Checkbox
              checked={input.transitChecklist.isInterstate}
              onCheckedChange={(checked) =>
                setTransitChecklist((prev) => ({
                  ...prev,
                  isInterstate: checked === true,
                  destinationUf: checked === true ? prev.destinationUf : null,
                }))
              }
            />
            <div className="space-y-1">
              <span className="text-sm font-medium text-foreground">Transito interestadual</span>
              <p className="text-sm text-muted-foreground">
                Habilita UF de destino e, para reproducao, a validacao dos atestados
                negativos com janela de 60 dias.
              </p>
            </div>
          </label>

          {input.transitChecklist.isInterstate ? (
            <div className="space-y-2 md:col-span-2">
              <Label>UF de destino</Label>
              <Select
                value={input.transitChecklist.destinationUf ?? "__none__"}
                onValueChange={(value) =>
                  setTransitChecklist((prev) => ({
                    ...prev,
                    destinationUf: value === "__none__" ? null : (value as EstadoUFEnum),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a UF" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione</SelectItem>
                  {input.ufOptions.map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {input.transitChecklist.purpose === "reproducao" && input.transitChecklist.isInterstate ? (
            <>
              <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3 md:col-span-2">
                <Checkbox
                  checked={input.transitChecklist.reproductionDocsChecked}
                  onCheckedChange={(checked) =>
                    setTransitChecklist((prev) => ({
                      ...prev,
                      reproductionDocsChecked: checked === true,
                    }))
                  }
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium text-foreground">Atestados PNCEBT conferidos</span>
                  <p className="text-sm text-muted-foreground">
                    Confirmar brucelose e tuberculose negativas antes do transito para
                    reproducao interestadual.
                  </p>
                </div>
              </label>

              <div className="space-y-2">
                <Label>Atestado negativo de brucelose</Label>
                <Input
                  type="date"
                  value={input.transitChecklist.brucellosisExamDate}
                  onChange={(event) =>
                    setTransitChecklist((prev) => ({
                      ...prev,
                      brucellosisExamDate: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Atestado negativo de tuberculose</Label>
                <Input
                  type="date"
                  value={input.transitChecklist.tuberculosisExamDate}
                  onChange={(event) =>
                    setTransitChecklist((prev) => ({
                      ...prev,
                      tuberculosisExamDate: event.target.value,
                    }))
                  }
                />
              </div>
            </>
          ) : null}

          <div className="space-y-2 md:col-span-2">
            <Label>Observacoes do transito</Label>
            <Input
              value={input.transitChecklist.notes}
              onChange={(event) =>
                setTransitChecklist((prev) => ({
                  ...prev,
                  notes: event.target.value,
                }))
              }
              placeholder="Ex.: saida para feira, leilao, frigorifico ou cobertura interestadual"
            />
          </div>
        </div>
      ) : null}

      {input.transitChecklistIssues.length > 0 ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {input.transitChecklistIssues[0]}
        </div>
      ) : null}
    </div>
  );
}
