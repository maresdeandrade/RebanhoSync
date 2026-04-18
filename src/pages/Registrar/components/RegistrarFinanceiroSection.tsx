import type { ReactNode } from "react";
import type { Animal, Contraparte } from "@/lib/offline/types";
import type {
  FinancialPriceMode,
  FinancialWeightMode,
} from "@/lib/finance/transactions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FinanceiroCompraAnimaisSection } from "@/pages/Registrar/components/FinanceiroCompraAnimaisSection";
import { FinanceiroContraparteSection } from "@/pages/Registrar/components/FinanceiroContraparteSection";
import { FinanceiroVendaPesosSection } from "@/pages/Registrar/components/FinanceiroVendaPesosSection";
import type {
  CompraNovoAnimalDraft,
  FinanceiroFormData,
  FinanceiroNatureza,
  RegistrarSexo,
} from "@/pages/Registrar/types";
import type { RegistrarNovaContraparteDraft } from "@/pages/Registrar/effects/contraparteCreate";

export function RegistrarFinanceiroSection(input: {
  financeiroData: FinanceiroFormData;
  onNaturezaChange: (natureza: FinanceiroNatureza) => void;
  onQuantidadeAnimaisChange: (value: string) => void;
  onModoPrecoChange: (modo: FinancialPriceMode) => void;
  onValorUnitarioChange: (value: string) => void;
  onValorTotalChange: (value: string) => void;
  onModoPesoChange: (modo: FinancialWeightMode) => void;
  onPesoLoteChange: (value: string) => void;
  onContraparteChange: (id: string) => void;
  financeiroValorTotalCalculado: number;
  isFinanceiroSociedade: boolean;
  selectedAnimalIds: string[];
  contrapartes: Contraparte[] | undefined;
  canManageContraparte: boolean;
  showNovaContraparte: boolean;
  onToggleNovaContraparte: () => void;
  onNavigateContrapartes: () => void;
  novaContraparte: RegistrarNovaContraparteDraft;
  onNovaContraparteFieldChange: (
    field: keyof RegistrarNovaContraparteDraft,
    value: string,
  ) => void;
  onCreateContraparte: () => void;
  isSavingContraparte: boolean;
  compraNovosAnimais: CompraNovoAnimalDraft[];
  onCompraIdentificacaoChange: (localId: string, value: string) => void;
  onCompraSexoChange: (localId: string, value: RegistrarSexo) => void;
  onCompraDataNascimentoChange: (localId: string, value: string) => void;
  onCompraPesoChange: (localId: string, value: string) => void;
  onVendaPesoAtIndexChange: (index: number, value: string) => void;
  animaisNoLote: Animal[] | undefined;
  weightInputStep: number;
  weightUnitLabel: string;
  transitChecklistSection: ReactNode;
  sanitaryMovementBlockSection: ReactNode;
  movementComplianceBlockSection: ReactNode;
}) {
  const showCompraAnimaisSection =
    input.selectedAnimalIds.length === 0 &&
    input.financeiroData.natureza === "compra" &&
    !input.isFinanceiroSociedade;

  const showVendaPesosSection =
    input.selectedAnimalIds.length > 0 &&
    input.financeiroData.natureza === "venda" &&
    input.financeiroData.modoPeso === "individual" &&
    !input.isFinanceiroSociedade;

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="space-y-2">
        <Label>Natureza</Label>
        <Select
          onValueChange={(value) => input.onNaturezaChange(value as FinanceiroNatureza)}
          value={input.financeiroData.natureza}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="compra">Compra</SelectItem>
            <SelectItem value="venda" disabled={input.selectedAnimalIds.length === 0}>
              Venda
            </SelectItem>
            <SelectItem value="sociedade_entrada">Sociedade (Entrada)</SelectItem>
            <SelectItem value="sociedade_saida">Sociedade (Saida)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!input.isFinanceiroSociedade ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Quantidade de animais</Label>
              <Input
                type="number"
                min="1"
                value={
                  input.selectedAnimalIds.length > 0
                    ? String(input.selectedAnimalIds.length)
                    : input.financeiroData.quantidadeAnimais
                }
                disabled={input.selectedAnimalIds.length > 0}
                onChange={(event) => input.onQuantidadeAnimaisChange(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {input.selectedAnimalIds.length > 0
                  ? "Quantidade travada pela selecao atual de animais."
                  : "Para compra sem animais previamente selecionados, o sistema gera esse lote de animais no mesmo gesto."}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Modo de preco</Label>
              <Select
                value={input.financeiroData.modoPreco}
                onValueChange={(value) => input.onModoPrecoChange(value as FinancialPriceMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="por_lote">Preco por lote</SelectItem>
                  <SelectItem value="por_animal">Preco por animal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {input.financeiroData.modoPreco === "por_animal" ? (
              <div className="space-y-2">
                <Label>Valor por animal</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={input.financeiroData.valorUnitario}
                  onChange={(event) => input.onValorUnitarioChange(event.target.value)}
                  placeholder="0.00"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Valor total do lote</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={input.financeiroData.valorTotal}
                  onChange={(event) => input.onValorTotalChange(event.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Total calculado</Label>
              <Input
                value={
                  Number.isFinite(input.financeiroValorTotalCalculado)
                    ? input.financeiroValorTotalCalculado.toFixed(2)
                    : ""
                }
                disabled
              />
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Modo de peso</Label>
              <Select
                value={input.financeiroData.modoPeso}
                onValueChange={(value) => input.onModoPesoChange(value as FinancialWeightMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem peso</SelectItem>
                  <SelectItem value="lote">Peso do lote</SelectItem>
                  <SelectItem value="individual">Peso individual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {input.financeiroData.modoPeso === "lote" ? (
              <div className="space-y-2">
                <Label>Peso do lote ({input.weightUnitLabel})</Label>
                <Input
                  type="number"
                  step={input.weightInputStep}
                  value={input.financeiroData.pesoLoteKg}
                  onChange={(event) => input.onPesoLoteChange(event.target.value)}
                  placeholder="0.00"
                />
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <FinanceiroContraparteSection
        isFinanceiroSociedade={input.isFinanceiroSociedade}
        financeiroContraparteId={input.financeiroData.contraparteId}
        contrapartes={input.contrapartes}
        onFinanceiroContraparteChange={input.onContraparteChange}
        showNovaContraparte={input.showNovaContraparte}
        onToggleNovaContraparte={input.onToggleNovaContraparte}
        canManageContraparte={input.canManageContraparte}
        onNavigateContrapartes={input.onNavigateContrapartes}
        novaContraparte={input.novaContraparte}
        onNovaContraparteFieldChange={input.onNovaContraparteFieldChange}
        onCreateContraparte={input.onCreateContraparte}
        isSavingContraparte={input.isSavingContraparte}
      />

      {showCompraAnimaisSection ? (
        <FinanceiroCompraAnimaisSection
          drafts={input.compraNovosAnimais}
          isIndividualWeightMode={input.financeiroData.modoPeso === "individual"}
          weightInputStep={input.weightInputStep}
          weightUnitLabel={input.weightUnitLabel}
          onIdentificacaoChange={input.onCompraIdentificacaoChange}
          onSexoChange={input.onCompraSexoChange}
          onDataNascimentoChange={input.onCompraDataNascimentoChange}
          onPesoChange={input.onCompraPesoChange}
        />
      ) : null}

      {showVendaPesosSection ? (
        <FinanceiroVendaPesosSection
          selectedAnimalIds={input.selectedAnimalIds}
          animaisNoLote={input.animaisNoLote}
          drafts={input.compraNovosAnimais}
          weightInputStep={input.weightInputStep}
          weightUnitLabel={input.weightUnitLabel}
          onPesoAtIndexChange={input.onVendaPesoAtIndexChange}
        />
      ) : null}

      {input.transitChecklistSection}
      {input.sanitaryMovementBlockSection}
      {input.movementComplianceBlockSection}
    </div>
  );
}
