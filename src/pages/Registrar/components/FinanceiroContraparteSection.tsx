import { Handshake, PlusCircle } from "lucide-react";
import type { Contraparte } from "@/lib/offline/types";
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
import { cn } from "@/lib/utils";
import type { RegistrarNovaContraparteDraft } from "@/pages/Registrar/effects/contraparteCreate";

type NovaContraparteField = keyof RegistrarNovaContraparteDraft;

export function FinanceiroContraparteSection(input: {
  isFinanceiroSociedade: boolean;
  financeiroContraparteId: string;
  contrapartes: Contraparte[] | undefined;
  onFinanceiroContraparteChange: (id: string) => void;
  showNovaContraparte: boolean;
  onToggleNovaContraparte: () => void;
  canManageContraparte: boolean;
  onNavigateContrapartes: () => void;
  novaContraparte: RegistrarNovaContraparteDraft;
  onNovaContraparteFieldChange: (
    field: NovaContraparteField,
    value: string,
  ) => void;
  onCreateContraparte: () => void;
  isSavingContraparte: boolean;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label>
          Contraparte{" "}
          {input.isFinanceiroSociedade ? "(obrigatoria em sociedade)" : "(opcional)"}
        </Label>
        <Select
          onValueChange={input.onFinanceiroContraparteChange}
          value={input.financeiroContraparteId}
        >
          <SelectTrigger
            className={cn(
              input.isFinanceiroSociedade &&
                input.financeiroContraparteId === "none" &&
                "border-destructive focus:ring-destructive/30",
            )}
          >
            <SelectValue placeholder="Sem contraparte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem contraparte</SelectItem>
            {input.contrapartes?.map((contraparte) => (
              <SelectItem key={contraparte.id} value={contraparte.id}>
                {contraparte.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {input.isFinanceiroSociedade &&
        input.financeiroContraparteId === "none" ? (
          <p className="text-xs text-destructive">
            Eventos de sociedade exigem uma contraparte vinculada.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={input.onToggleNovaContraparte}
          disabled={!input.canManageContraparte}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {input.showNovaContraparte ? "Fechar cadastro" : "Nova contraparte"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={input.onNavigateContrapartes}
        >
          <Handshake className="mr-2 h-4 w-4" />
          Gerenciar parceiros
        </Button>
      </div>

      {!input.canManageContraparte && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Sua role pode registrar o evento, mas nao pode criar nova contraparte.
          Use uma contraparte existente ou encaminhe o cadastro para owner/manager.
        </div>
      )}

      {input.showNovaContraparte && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo da contraparte</Label>
              <Select
                value={input.novaContraparte.tipo}
                onValueChange={(value) =>
                  input.onNovaContraparteFieldChange("tipo", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pessoa">Pessoa</SelectItem>
                  <SelectItem value="empresa">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={input.novaContraparte.nome}
                onChange={(event) =>
                  input.onNovaContraparteFieldChange("nome", event.target.value)
                }
                placeholder="Nome da contraparte"
              />
            </div>
            <div className="space-y-2">
              <Label>Documento</Label>
              <Input
                value={input.novaContraparte.documento}
                onChange={(event) =>
                  input.onNovaContraparteFieldChange("documento", event.target.value)
                }
                placeholder="CPF/CNPJ"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={input.novaContraparte.telefone}
                onChange={(event) =>
                  input.onNovaContraparteFieldChange("telefone", event.target.value)
                }
                placeholder="Telefone"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={input.novaContraparte.email}
                onChange={(event) =>
                  input.onNovaContraparteFieldChange("email", event.target.value)
                }
                placeholder="Email"
              />
            </div>
            <div className="space-y-2">
              <Label>Endereco</Label>
              <Input
                value={input.novaContraparte.endereco}
                onChange={(event) =>
                  input.onNovaContraparteFieldChange("endereco", event.target.value)
                }
                placeholder="Cidade/UF"
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={input.onCreateContraparte}
            disabled={input.isSavingContraparte || !input.canManageContraparte}
          >
            {input.isSavingContraparte ? "Salvando..." : "Salvar contraparte"}
          </Button>
        </div>
      )}
    </>
  );
}
