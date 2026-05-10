import type { SanitarioTipoEnum } from "@/lib/offline/types";
import { describeRegistrarSanitaryCalendarSchedule } from "@/lib/sanitario/models/calendarDisplay";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RegistrarSanitarioSectionProps = {
  sanitarioTipo: SanitarioTipoEnum;
  onSanitarioTipoChange: (tipo: SanitarioTipoEnum) => void;
  produto: string;
  onProdutoChange: (value: string) => void;
  sanitatioProductMissing: boolean;
  selectedVeterinaryProduct: { nome: string; categoria: string | null } | null;
  hasVeterinaryProducts: boolean;
  isVeterinaryProductsEmpty: boolean;
  veterinaryProductSuggestions: Array<{ id: string; nome: string; categoria: string | null }>;
  selectedVeterinaryProductId: string;
  onSelectVeterinaryProduct: (product: {
    id: string;
    nome: string;
    categoria: string | null;
  }) => void;
  protocoloId: string;
  onProtocoloChange: (id: string) => void;
  protocolos: Array<{ id: string; nome: string }>;
  protocoloItemId: string;
  onProtocoloItemChange: (value: string) => void;
  protocoloItensEvaluated: Array<{
    item: {
      id: string;
      dose_num: number;
      intervalo_dias: number | null;
      gera_agenda: boolean;
      payload: unknown;
    };
    eligibility: {
      compatibleWithAll: boolean;
      eligibleCount: number;
    };
  }>;
  selectedAnimaisDetalhesCount: number;
  selectedProtocolRestrictionsText: string | null;
  selectedProtocolPrimaryReason: string | null;
  selectedProtocolCompatibleWithAll: boolean | null;
  allProtocolItemsIneligible: boolean;
};

export function RegistrarSanitarioSection(props: RegistrarSanitarioSectionProps) {
  return (
    <div className="space-y-5 rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="space-y-3">
        <Label>Tipo</Label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "vacinacao", label: "Vacinação" },
            { value: "vermifugacao", label: "Vermifugação" },
            { value: "medicamento", label: "Medicamento" },
          ].map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={props.sanitarioTipo === opt.value ? "default" : "outline"}
              onClick={() => props.onSanitarioTipoChange(opt.value as SanitarioTipoEnum)}
              className="flex-1 rounded-full shadow-none sm:flex-none bg-background aria-selected:bg-primary"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Label>Protocolo (opcional)</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={!props.protocoloId || props.protocoloId === "none" ? "default" : "outline"}
            onClick={() => props.onProtocoloChange("none")}
            className="rounded-full shadow-none sm:flex-none bg-background aria-selected:bg-primary"
          >
            Sem protocolo
          </Button>
          {props.protocolos.map((protocol) => (
            <Button
              key={protocol.id}
              type="button"
              variant={props.protocoloId === protocol.id ? "default" : "outline"}
              onClick={() => props.onProtocoloChange(protocol.id)}
              className="rounded-full shadow-none sm:flex-none bg-background aria-selected:bg-primary"
            >
              {protocol.nome}
            </Button>
          ))}
        </div>
      </div>

      {props.protocoloId && props.protocoloId !== "none" && props.protocoloItensEvaluated.length > 0 ? (
        <div className="space-y-3 rounded-lg border bg-background/50 p-3">
          <Label>Item do Protocolo</Label>
          <select
            className="flex h-11 w-full rounded-xl border border-border/80 bg-background px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
            onChange={(event) => props.onProtocoloItemChange(event.target.value)}
            value={props.protocoloItemId}
          >
            <option value="" disabled>
              Selecione o item
            </option>
            {props.protocoloItensEvaluated.map(({ item, eligibility }) => (
              <option
                key={item.id}
                value={item.id}
                disabled={!eligibility.compatibleWithAll && item.id !== props.protocoloItemId}
              >
                  Dose {item.dose_num} |{" "}
                  {describeRegistrarSanitaryCalendarSchedule({
                    intervalDays: item.intervalo_dias,
                    geraAgenda: item.gera_agenda,
                    payload: item.payload,
                  })}
                  {props.selectedAnimaisDetalhesCount > 0
                    ? ` | ${eligibility.eligibleCount}/${props.selectedAnimaisDetalhesCount} aptos`
                    : ""}
              </option>
            ))}
          </select>

          {props.selectedProtocolRestrictionsText || !props.selectedProtocolCompatibleWithAll ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              {props.selectedProtocolRestrictionsText ? (
                <p>Regras: {props.selectedProtocolRestrictionsText}</p>
              ) : null}
              {props.selectedProtocolCompatibleWithAll === false && props.selectedProtocolPrimaryReason ? (
                <p className="text-destructive">{props.selectedProtocolPrimaryReason}</p>
              ) : null}
            </div>
          ) : null}

          {props.allProtocolItemsIneligible ? (
            <p className="text-xs text-muted-foreground">
              Nenhum item deste protocolo atende todos os animais selecionados. Ajuste a selecao ou
              troque o protocolo.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3 pt-2 border-t border-border/50">
        <Label>Produto</Label>
        <Input
          className={cn(
            "bg-background",
            props.sanitatioProductMissing && "border-destructive focus-visible:ring-destructive/30",
          )}
          placeholder="Digite o nome ou use uma sugestao do catalogo"
          value={props.produto}
          onChange={(event) => props.onProdutoChange(event.target.value)}
        />
        {props.sanitatioProductMissing ? (
          <p className="text-xs text-destructive">
            Informe o produto ou selecione um item de protocolo antes de continuar.
          </p>
        ) : props.selectedVeterinaryProduct ? (
          <p className="text-xs text-muted-foreground">
            Catalogo vinculado: {props.selectedVeterinaryProduct.nome}
            {props.selectedVeterinaryProduct.categoria
              ? ` | ${props.selectedVeterinaryProduct.categoria}`
              : ""}
          </p>
        ) : props.produto.trim() ? (
          <p className="text-xs text-muted-foreground">
            Texto livre: o evento sera salvo sem vinculo direto ao catalogo.
          </p>
        ) : props.hasVeterinaryProducts ? (
          <p className="text-xs text-muted-foreground">
            Sugestoes do catalogo aparecem abaixo para acelerar o registro.
          </p>
        ) : null}

        {props.veterinaryProductSuggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {props.veterinaryProductSuggestions.map((product) => {
              const isSelected = product.id === props.selectedVeterinaryProductId;
              return (
                <Button
                  key={product.id}
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  className="h-auto min-h-9 px-3 py-2 text-left rounded-full"
                  onClick={() => props.onSelectVeterinaryProduct(product)}
                >
                  <span>{product.nome}</span>
                  {product.categoria ? (
                    <Badge variant="secondary" className="ml-2 whitespace-nowrap bg-muted">
                      {product.categoria}
                    </Badge>
                  ) : null}
                </Button>
              );
            })}
          </div>
        ) : props.isVeterinaryProductsEmpty ? (
          <p className="text-xs text-muted-foreground">
            Catalogo veterinario indisponivel offline neste aparelho.
          </p>
        ) : null}
      </div>
    </div>
  );
}
