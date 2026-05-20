import type { ReactNode } from "react";
import type { Animal, Contraparte } from "@/lib/offline/types";
import type {
  FinancialPriceMode,
  FinancialWeightMode,
} from "@/lib/finance/transactions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  isFinanceiroSaidaNatureza,
  resolveFinanceiroNaturezaOptions,
  supportsDraftAnimalsInFinanceiroNatureza,
} from "@/pages/Registrar/helpers/financialNature";
import type { AnimalBreedEnum } from "@/lib/animals/catalogs";

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
  onCompraRacaChange: (localId: string, value: AnimalBreedEnum | null) => void;
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
  const naturezaOptions = resolveFinanceiroNaturezaOptions(
    input.financeiroData.natureza,
  );
  const showCompraAnimaisSection =
    input.selectedAnimalIds.length === 0 &&
    supportsDraftAnimalsInFinanceiroNatureza(input.financeiroData.natureza) &&
    !input.isFinanceiroSociedade;

  const showVendaPesosSection =
    input.selectedAnimalIds.length > 0 &&
    isFinanceiroSaidaNatureza(input.financeiroData.natureza) &&
    input.financeiroData.modoPeso === "individual" &&
    !input.isFinanceiroSociedade;

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
      <Tabs defaultValue="operacao" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/50 p-1">
          <TabsTrigger value="operacao" className="rounded-md">Dados Operacionais</TabsTrigger>
          <TabsTrigger value="envolvidos" className="rounded-md">Envolvidos & Detalhes</TabsTrigger>
        </TabsList>

        <TabsContent value="operacao" className="space-y-5 focus-visible:outline-none">
          <div className="space-y-3">
            <Label>Natureza</Label>
            <div className="flex flex-wrap gap-2">
              {naturezaOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={input.financeiroData.natureza === option.value ? "default" : "outline"}
                  onClick={() => input.onNaturezaChange(option.value as FinanceiroNatureza)}
                  disabled={option.requiresAnimals && input.selectedAnimalIds.length === 0}
                  className="rounded-full shadow-none flex-1 sm:flex-none bg-background aria-selected:bg-primary"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {!input.isFinanceiroSociedade ? (
            <>
              <div className="grid gap-5 border-t pt-5 md:grid-cols-2">
                <div className="space-y-3">
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
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    {input.selectedAnimalIds.length > 0
                      ? "Travada pela seleção de animais."
                      : "Gera lotes sem seleção prévia."}
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Modo de precificação</Label>
                  <div className="flex gap-2">
                    {[
                      { value: "por_lote", label: "Por lote" },
                      { value: "por_animal", label: "Por animal" },
                    ].map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant={input.financeiroData.modoPreco === opt.value ? "default" : "outline"}
                        onClick={() => input.onModoPrecoChange(opt.value as FinancialPriceMode)}
                        className="rounded-full shadow-none flex-1 bg-background aria-selected:bg-primary"
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
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
                      className="bg-background"
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
                      className="bg-background"
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

              <div className="grid gap-3 border-t pt-5 md:grid-cols-2">
                <div className="space-y-3">
                  <Label>Registro de pesagem</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: "nenhum", label: "Sem peso" },
                      { value: "lote", label: "Peso do lote" },
                      { value: "individual", label: "Peso individual" },
                    ].map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant={input.financeiroData.modoPeso === opt.value ? "default" : "outline"}
                        onClick={() => input.onModoPesoChange(opt.value as FinancialWeightMode)}
                        className="rounded-full shadow-none flex-1 sm:flex-none bg-background aria-selected:bg-primary"
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
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
                      className="bg-background"
                    />
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="envolvidos" className="space-y-5 focus-visible:outline-none">
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
              onRacaChange={input.onCompraRacaChange}
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
        </TabsContent>
      </Tabs>

      {input.transitChecklistSection}
      {input.sanitaryMovementBlockSection}
      {input.movementComplianceBlockSection}
    </div>
  );
}


