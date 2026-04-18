import type { SanitarioTipoEnum } from "@/lib/offline/types";
import { describeSanitaryCalendarSchedule } from "@/lib/sanitario/calendar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  onProtocoloChange: (value: string) => void;
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
    <div className="space-y-4 border-t pt-4">
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select
          onValueChange={(value) => props.onSanitarioTipoChange(value as SanitarioTipoEnum)}
          value={props.sanitarioTipo}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vacinacao">Vacinacao</SelectItem>
            <SelectItem value="vermifugacao">Vermifugacao</SelectItem>
            <SelectItem value="medicamento">Medicamento</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Produto</Label>
        <Input
          className={cn(
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
                  className="h-auto min-h-9 px-3 py-2 text-left"
                  onClick={() => props.onSelectVeterinaryProduct(product)}
                >
                  <span>{product.nome}</span>
                  {product.categoria ? (
                    <Badge variant="secondary" className="ml-2 whitespace-nowrap">
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

      <div className="space-y-2">
        <Label>Protocolo (opcional)</Label>
        <Select onValueChange={props.onProtocoloChange} value={props.protocoloId || "none"}>
          <SelectTrigger>
            <SelectValue placeholder="Sem protocolo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem protocolo</SelectItem>
            {props.protocolos.map((protocol) => (
              <SelectItem key={protocol.id} value={protocol.id}>
                {protocol.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {props.protocoloId && props.protocoloItensEvaluated.length > 0 ? (
        <div className="space-y-2">
          <Label>Item do Protocolo</Label>
          <Select onValueChange={props.onProtocoloItemChange} value={props.protocoloItemId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o item" />
            </SelectTrigger>
            <SelectContent>
              {props.protocoloItensEvaluated.map(({ item, eligibility }) => (
                <SelectItem key={item.id} value={item.id} disabled={!eligibility.compatibleWithAll}>
                  Dose {item.dose_num} |{" "}
                  {describeSanitaryCalendarSchedule({
                    intervalDays: item.intervalo_dias,
                    geraAgenda: item.gera_agenda,
                    payload: item.payload,
                  })}
                  {props.selectedAnimaisDetalhesCount > 0
                    ? ` | ${eligibility.eligibleCount}/${props.selectedAnimaisDetalhesCount} aptos`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
    </div>
  );
}
