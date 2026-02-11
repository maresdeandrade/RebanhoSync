import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { OperationInput } from "@/lib/offline/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate } from "react-router-dom";
import {
  Beef,
  Scale,
  Move,
  Syringe,
  ChevronRight,
  ChevronLeft,
  Check,
} from "lucide-react";
import { useLotes } from "@/hooks/useLotes";

// P2.2 FIX: Magic numbers to enum for better readability
enum RegistrationStep {
  SELECT_ANIMALS = 1,
  CHOOSE_ACTION = 2,
  CONFIRM = 3,
}

const Registrar = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<RegistrationStep>(
    RegistrationStep.SELECT_ANIMALS,
  );
  const [tipoManejo, setTipoManejo] = useState<
    "sanitario" | "pesagem" | "movimentacao" | null
  >(null);
  const [selectedLoteId, setSelectedLoteId] = useState<string>("");
  const [selectedAnimais, setSelectedAnimais] = useState<string[]>([]);

  // Form states
  const [sanitarioData, setSanitarioData] = useState({
    tipo: "vacinacao",
    produto: "",
  });
  const [protocoloId, setProtocoloId] = useState<string>("");
  const [protocoloItemId, setProtocoloItemId] = useState<string>("");
  const [pesagemData, setPesagemData] = useState<Record<string, string>>({});
  const [movimentacaoData, setMovimentacaoData] = useState({ toLoteId: "" });

  // P2.4 FIX: Use centralized useLotes hook
  const lotes = useLotes();
  const animaisNoLote = useLiveQuery(
    () =>
      selectedLoteId
        ? db.state_animais.where("lote_id").equals(selectedLoteId).toArray()
        : [],
    [selectedLoteId],
  );

  const protocolos = useLiveQuery(() => {
    const fazenda_id = lotes?.[0]?.fazenda_id;
    return fazenda_id
      ? db.state_protocolos_sanitarios
          .where("fazenda_id")
          .equals(fazenda_id)
          .toArray()
      : [];
  }, [lotes]);

  const protocoloItens = useLiveQuery(() => {
    return protocoloId
      ? db.state_protocolos_sanitarios_itens
          .where("protocolo_id")
          .equals(protocoloId)
          .filter((i) => i.tipo === sanitarioData.tipo)
          .toArray()
      : [];
  }, [protocoloId, sanitarioData.tipo]);

  const handleFinalize = async () => {
    if (!tipoManejo || selectedAnimais.length === 0) return;

    const fazenda_id = lotes?.[0]?.fazenda_id; // Simplificado para MVP
    if (!fazenda_id) return;

    // TYPE FIX: Use OperationInput[] (fields auto-added by createGesture)
    const ops: OperationInput[] = [];
    const now = new Date().toISOString();

    for (const animalId of selectedAnimais) {
      const animal = await db.state_animais.get(animalId);
      const evento_id = crypto.randomUUID();

      // 1. Evento Base
      ops.push({
        table: "eventos",
        action: "INSERT",
        record: {
          id: evento_id,
          fazenda_id,
          dominio: tipoManejo,
          occurred_at: now,
          animal_id: animalId,
          lote_id: animal.lote_id,
        },
      });

      // 2. Detalhes específicos
      if (tipoManejo === "sanitario") {
        ops.push({
          table: "eventos_sanitario",
          action: "INSERT",
          record: {
            evento_id,
            fazenda_id,
            tipo: sanitarioData.tipo,
            produto: sanitarioData.produto,
            payload: {},
          },
        });

        // 3. Agenda automática (se protocolo selecionado)
        if (protocoloItemId) {
          const protocoloItem =
            await db.state_protocolos_sanitarios_itens.get(protocoloItemId);

          if (protocoloItem?.gera_agenda) {
            const versionId = protocoloItem.id;
            const doseNum = protocoloItem.dose_num ?? 1;
            const reforcoDate = new Date(now);
            reforcoDate.setDate(
              reforcoDate.getDate() + protocoloItem.intervalo_dias,
            );

            const dedupKey = `${fazenda_id}|animal:${animalId}|piv:${versionId}|dose:${doseNum}`;

            ops.push({
              table: "agenda_itens",
              action: "INSERT",
              record: {
                id: crypto.randomUUID(),
                fazenda_id,
                dominio: "sanitario",
                tipo: "reforco",
                status: "agendado",
                data_prevista: reforcoDate.toISOString().split("T")[0],
                animal_id: animalId,
                lote_id: animal?.lote_id ?? null,
                source_kind: "automatico",
                source_evento_id: evento_id,
                protocol_item_version_id: versionId,
                interval_days_applied: protocoloItem.intervalo_dias,
                dedup_key: dedupKey,
              },
            });
          }
        }
      } else if (tipoManejo === "pesagem") {
        ops.push({
          table: "eventos_pesagem",
          action: "INSERT",
          record: {
            evento_id,
            fazenda_id,
            peso_kg: parseFloat(pesagemData[animalId] || "0"),
          },
        });
      } else if (tipoManejo === "movimentacao") {
        ops.push({
          table: "eventos_movimentacao",
          action: "INSERT",
          record: {
            evento_id,
            fazenda_id,
            from_lote_id: animal.lote_id,
            to_lote_id: movimentacaoData.toLoteId,
          },
        });
        // Regra Anti-Teleporte: Update no estado do animal no mesmo batch
        ops.push({
          table: "animais",
          action: "UPDATE",
          record: {
            id: animalId,
            lote_id: movimentacaoData.toLoteId,
          },
        });
      }
    }

    try {
      const txId = await createGesture(fazenda_id, ops);
      showSuccess(`Manejo registrado! TX: ${txId.slice(0, 8)}`);
      navigate("/home", { state: { syncPending: true } });
    } catch (e) {
      showError("Erro ao registrar manejo.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Registrar Manejo</h1>
        <div className="flex gap-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-8 rounded-full ${step >= s ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
      </div>

      {step === RegistrationStep.SELECT_ANIMALS && (
        <Card>
          <CardHeader>
            <CardTitle>1. Selecionar Alvo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Lote</Label>
              <Select onValueChange={setSelectedLoteId} value={selectedLoteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o lote" />
                </SelectTrigger>
                <SelectContent>
                  {lotes?.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedLoteId && (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {animaisNoLote?.map((a) => (
                  <div key={a.id} className="flex items-center p-3 gap-3">
                    <Checkbox
                      checked={selectedAnimais.includes(a.id)}
                      onCheckedChange={(checked) => {
                        setSelectedAnimais((prev) =>
                          checked
                            ? [...prev, a.id]
                            : prev.filter((id) => id !== a.id),
                        );
                      }}
                    />
                    <span className="font-medium">{a.identificacao}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.sexo === "M" ? "Macho" : "Fêmea"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <Button
              className="w-full"
              disabled={selectedAnimais.length === 0}
              onClick={() => setStep(RegistrationStep.CHOOSE_ACTION)}
            >
              Próximo <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === RegistrationStep.CHOOSE_ACTION && (
        <Card>
          <CardHeader>
            <CardTitle>2. Escolher Ação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <Button
                variant={tipoManejo === "sanitario" ? "default" : "outline"}
                className="flex-col h-24 gap-2"
                onClick={() => setTipoManejo("sanitario")}
              >
                <Syringe className="h-6 w-6" /> Sanitário
              </Button>
              <Button
                variant={tipoManejo === "pesagem" ? "default" : "outline"}
                className="flex-col h-24 gap-2"
                onClick={() => setTipoManejo("pesagem")}
              >
                <Scale className="h-6 w-6" /> Pesagem
              </Button>
              <Button
                variant={tipoManejo === "movimentacao" ? "default" : "outline"}
                className="flex-col h-24 gap-2"
                onClick={() => setTipoManejo("movimentacao")}
              >
                <Move className="h-6 w-6" /> Mover
              </Button>
            </div>

            {tipoManejo === "sanitario" && (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    onValueChange={(v) =>
                      setSanitarioData((d) => ({ ...d, tipo: v }))
                    }
                    value={sanitarioData.tipo}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacinacao">Vacinação</SelectItem>
                      <SelectItem value="vermifugacao">Vermifugação</SelectItem>
                      <SelectItem value="medicamento">Medicamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Input
                    value={sanitarioData.produto}
                    onChange={(e) =>
                      setSanitarioData((d) => ({
                        ...d,
                        produto: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Protocolo (opcional)</Label>
                  <Select onValueChange={setProtocoloId} value={protocoloId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sem protocolo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Sem protocolo</SelectItem>
                      {protocolos?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {protocoloId && protocoloItens && protocoloItens.length > 0 && (
                  <div className="space-y-2">
                    <Label>Item do Protocolo</Label>
                    <Select
                      onValueChange={setProtocoloItemId}
                      value={protocoloItemId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o item" />
                      </SelectTrigger>
                      <SelectContent>
                        {protocoloItens.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            Dose {item.dose_num}{" "}
                            {item.gera_agenda && `(+${item.intervalo_dias}d)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {tipoManejo === "pesagem" && (
              <div className="space-y-4 border-t pt-4 max-h-64 overflow-y-auto">
                {selectedAnimais.map((id) => {
                  const animal = animaisNoLote?.find((a) => a.id === id);
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-4"
                    >
                      <Label className="w-24">{animal?.identificacao}</Label>
                      <Input
                        type="number"
                        placeholder="Peso (kg)"
                        value={pesagemData[id] || ""}
                        onChange={(e) =>
                          setPesagemData((prev) => ({
                            ...prev,
                            [id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {tipoManejo === "movimentacao" && (
              <div className="space-y-4 border-t pt-4">
                <Label>Lote Destino</Label>
                <Select
                  onValueChange={(v) => setMovimentacaoData({ toLoteId: v })}
                  value={movimentacaoData.toLoteId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotes
                      ?.filter((l) => l.id !== selectedLoteId)
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(RegistrationStep.SELECT_ANIMALS)}
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button
                className="flex-1"
                disabled={!tipoManejo}
                onClick={() => setStep(RegistrationStep.CONFIRM)}
              >
                Próximo <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === RegistrationStep.CONFIRM && (
        <Card>
          <CardHeader>
            <CardTitle>3. Confirmar Registro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Manejo:</span>
                <span className="font-bold capitalize">{tipoManejo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Animais:</span>
                <span className="font-bold">{selectedAnimais.length}</span>
              </div>
              {tipoManejo === "movimentacao" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destino:</span>
                  <span className="font-bold">
                    {
                      lotes?.find((l) => l.id === movimentacaoData.toLoteId)
                        ?.nome
                    }
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(RegistrationStep.CHOOSE_ACTION)}
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleFinalize}
              >
                <Check className="mr-2 h-4 w-4" /> Confirmar e Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Registrar;
