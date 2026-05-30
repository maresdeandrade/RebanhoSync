import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { useAuth } from "@/components/auth/AuthProvider";
import { v4 as uuidv4 } from "uuid";
import type { SociedadePecuaria } from "@/lib/offline/types";
import { Check, Plus, ShieldAlert, X } from "lucide-react";
import { buildEventGesture } from "@/lib/events/buildEventGesture";

export function RegistrarSociedadeSection(props: {
  selectedAnimalIds: string[];
  contrapartes: { id: string; nome: string }[] | undefined;
  fazendaId: string;
}) {
  const { user } = useAuth();
  const [view, setView] = useState<"list" | "create">("list");

  // Formulário de Nova Sociedade
  const [nome, setNome] = useState("");
  const [contraparteId, setContraparteId] = useState("");
  const [percFazenda, setPercFazenda] = useState("50");
  const [percParceiro, setPercParceiro] = useState("50");

  // Formulário de Encerramento de Vínculo
  const [dataSaida, setDataSaida] = useState(() => new Date().toISOString().slice(0, 10));
  const [motivoSaida, setMotivoSaida] = useState("");

  const activeSocieties = useLiveQuery(
    () => db.state_sociedades_pecuarias.where({ fazenda_id: props.fazendaId, status: "ativa" }).toArray(),
    [props.fazendaId],
    []
  );

  const activeLinks = useLiveQuery(
    () => db.state_sociedade_animais.where({ fazenda_id: props.fazendaId, status: "ativo" }).toArray(),
    [props.fazendaId],
    []
  );

  const selectedAnimalsWithActiveLink = props.selectedAnimalIds.filter(id => activeLinks.some(link => link.animal_id === id));
  const selectedAnimalsWithoutLink = props.selectedAnimalIds.filter(id => !activeLinks.some(link => link.animal_id === id));

  const handleCreateSociety = async () => {
    if (!nome || !contraparteId || !percFazenda || !percParceiro) return;
    
    const fz = parseFloat(percFazenda);
    const pa = parseFloat(percParceiro);
    if (Math.abs((fz + pa) - 100) > 0.0001) {
      alert("A soma dos percentuais deve ser 100%.");
      return;
    }

    const newSocietyId = uuidv4();
    const ops = [
      {
        table: "sociedades_pecuarias",
        action: "INSERT" as const,
        record: {
          id: newSocietyId,
          nome,
          contraparte_id: contraparteId,
          percentual_fazenda: fz,
          percentual_parceiro: pa,
          data_inicio: new Date().toISOString().slice(0, 10),
          status: "ativa",
          regra_custos: "proporcional",
          regra_perdas: "proporcional",
          regra_receita: "proporcional",
          payload: {}
        }
      }
    ];

    const gesture = buildEventGesture({
      fazendaId: props.fazendaId,
      tipoManejo: "financeiro",
      occurredAt: new Date().toISOString(),
      sourceTaskId: null,
      ops,
      skipDbPut: true
    });

    await db.transaction("rw", [db.state_sociedades_pecuarias, db.queue_ops, db.queue_gestures], async () => {
      await db.state_sociedades_pecuarias.put({
        ...ops[0].record,
        fazenda_id: props.fazendaId,
        client_id: user?.id || "",
        client_op_id: gesture.ops[0].client_op_id,
        client_tx_id: gesture.client_tx_id,
        client_recorded_at: new Date().toISOString()
      } as unknown as SociedadePecuaria);

      await db.queue_gestures.put({
        client_tx_id: gesture.client_tx_id,
        fazenda_id: props.fazendaId,
        status: "PENDING",
        created_at: new Date().toISOString()
      });

      await db.queue_ops.bulkPut(gesture.ops);
    });

    setView("list");
    setNome("");
    setPercFazenda("50");
    setPercParceiro("50");
  };

  const handleLinkAnimals = async (sociedadeId: string) => {
    if (selectedAnimalsWithoutLink.length === 0) return;

    const ops = selectedAnimalsWithoutLink.map(animalId => ({
      table: "sociedade_animais",
      action: "INSERT" as const,
      record: {
        id: uuidv4(),
        sociedade_id: sociedadeId,
        animal_id: animalId,
        data_entrada: new Date().toISOString().slice(0, 10),
        status: "ativo",
        payload: {}
      }
    }));

    const gesture = buildEventGesture({
      fazendaId: props.fazendaId,
      tipoManejo: "financeiro",
      occurredAt: new Date().toISOString(),
      sourceTaskId: null,
      ops,
      skipDbPut: true
    });

    await db.transaction("rw", [db.state_sociedade_animais, db.queue_ops, db.queue_gestures], async () => {
      for (let i = 0; i < ops.length; i++) {
        await db.state_sociedade_animais.put({
          ...ops[i].record,
          fazenda_id: props.fazendaId,
          client_id: user?.id || "",
          client_op_id: gesture.ops[i].client_op_id,
          client_tx_id: gesture.client_tx_id,
          client_recorded_at: new Date().toISOString()
        } as unknown as typeof db.state_sociedade_animais.schema.instanceTemplate);
      }

      await db.queue_gestures.put({
        client_tx_id: gesture.client_tx_id,
        fazenda_id: props.fazendaId,
        status: "PENDING",
        created_at: new Date().toISOString()
      });

      await db.queue_ops.bulkPut(gesture.ops);
    });
    alert(`Animais vinculados com sucesso!`);
  };

  const handleUnlinkAnimals = async () => {
    if (selectedAnimalsWithActiveLink.length === 0) return;
    if (!dataSaida || !motivoSaida) {
      alert("Data de saída e motivo de saída são obrigatórios para encerrar o vínculo.");
      return;
    }
    if (!confirm("Deseja realmente encerrar o vínculo atual destes animais?")) return;

    const activeLinksToClose = activeLinks.filter(l => selectedAnimalsWithActiveLink.includes(l.animal_id));
    
    const ops = activeLinksToClose.map(link => ({
      table: "sociedade_animais",
      action: "UPDATE" as const,
      record: {
        id: link.id,
        status: "encerrado",
        data_saida: dataSaida,
        motivo_saida: motivoSaida,
        payload: { encerradoPor: "manual" }
      }
    }));

    const gesture = buildEventGesture({
      fazendaId: props.fazendaId,
      tipoManejo: "financeiro",
      occurredAt: new Date().toISOString(),
      sourceTaskId: null,
      ops,
      skipDbPut: true
    });

    await db.transaction("rw", [db.state_sociedade_animais, db.queue_ops, db.queue_gestures], async () => {
      for (let i = 0; i < ops.length; i++) {
        const existing = activeLinksToClose[i];
        await db.state_sociedade_animais.put({
          ...existing,
          ...ops[i].record,
          client_id: user?.id || "",
          client_op_id: gesture.ops[i].client_op_id,
          client_tx_id: gesture.client_tx_id,
          client_recorded_at: new Date().toISOString()
        } as unknown as typeof db.state_sociedade_animais.schema.instanceTemplate);
      }

      await db.queue_gestures.put({
        client_tx_id: gesture.client_tx_id,
        fazenda_id: props.fazendaId,
        status: "PENDING",
        created_at: new Date().toISOString()
      });

      await db.queue_ops.bulkPut(gesture.ops);
    });
    alert(`Vínculos encerrados com sucesso!`);
  };

  const handleEndSociety = async (sociedadeId: string) => {
    if (!confirm("Deseja realmente encerrar essa sociedade? Todos os vínculos ativos serão encerrados.")) return;

    const linksToClose = activeLinks.filter(l => l.sociedade_id === sociedadeId);
    
    const ops = [
      {
        table: "sociedades_pecuarias",
        action: "UPDATE" as const,
        record: {
          id: sociedadeId,
          status: "encerrada",
          data_fim: new Date().toISOString().slice(0, 10),
        }
      },
      ...linksToClose.map(link => ({
        table: "sociedade_animais",
        action: "UPDATE" as const,
        record: {
          id: link.id,
          status: "encerrado",
          data_saida: new Date().toISOString().slice(0, 10),
          motivo_saida: "encerramento_sociedade",
        }
      }))
    ];

    const gesture = buildEventGesture({
      fazendaId: props.fazendaId,
      tipoManejo: "financeiro",
      occurredAt: new Date().toISOString(),
      sourceTaskId: null,
      ops,
      skipDbPut: true
    });

    await db.transaction("rw", [db.state_sociedades_pecuarias, db.state_sociedade_animais, db.queue_ops, db.queue_gestures], async () => {
      const society = activeSocieties.find(s => s.id === sociedadeId)!;
      await db.state_sociedades_pecuarias.put({
        ...society,
        ...ops[0].record,
        client_id: user?.id || "",
        client_op_id: gesture.ops[0].client_op_id,
        client_tx_id: gesture.client_tx_id,
        client_recorded_at: new Date().toISOString()
      } as unknown as SociedadePecuaria);

      for (let i = 1; i < ops.length; i++) {
        const link = linksToClose[i - 1];
        await db.state_sociedade_animais.put({
          ...link,
          ...ops[i].record,
          client_id: user?.id || "",
          client_op_id: gesture.ops[i].client_op_id,
          client_tx_id: gesture.client_tx_id,
          client_recorded_at: new Date().toISOString()
        } as unknown as typeof db.state_sociedade_animais.schema.instanceTemplate);
      }

      await db.queue_gestures.put({
        client_tx_id: gesture.client_tx_id,
        fazenda_id: props.fazendaId,
        status: "PENDING",
        created_at: new Date().toISOString()
      });

      await db.queue_ops.bulkPut(gesture.ops);
    });
    alert("Sociedade encerrada!");
  };

  return (
    <div className="space-y-6 mt-4 p-4 border rounded-xl bg-card">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Sociedade Pecuária</h3>
        {view === "list" ? (
          <Button size="sm" onClick={() => setView("create")}>
            <Plus className="mr-2 h-4 w-4" /> Nova Sociedade
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setView("list")}>
            Voltar
          </Button>
        )}
      </div>

      {view === "create" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome da Sociedade</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Sociedade Nelore" />
            </div>
            <div>
              <Label>Contraparte</Label>
              <Select value={contraparteId} onValueChange={setContraparteId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {props.contrapartes?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>% Fazenda</Label>
              <Input type="number" step="0.0001" value={percFazenda} onChange={e => setPercFazenda(e.target.value)} />
            </div>
            <div>
              <Label>% Parceiro</Label>
              <Input type="number" step="0.0001" value={percParceiro} onChange={e => setPercParceiro(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleCreateSociety} className="w-full">
            Criar e Salvar
          </Button>
        </div>
      )}

      {view === "list" && (
        <div className="space-y-4">
          {activeSocieties.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma sociedade ativa.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeSocieties.map(s => (
                <div key={s.id} className="border p-4 rounded-lg flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold">{s.nome}</h4>
                    <span className="text-xs bg-muted px-2 py-1 rounded-full">{s.percentual_fazenda}% / {s.percentual_parceiro}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Contraparte: {props.contrapartes?.find(c => c.id === s.contraparte_id)?.nome || s.contraparte_id}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      disabled={selectedAnimalsWithoutLink.length === 0}
                      onClick={() => handleLinkAnimals(s.id)}
                    >
                      Vincular {selectedAnimalsWithoutLink.length} selecionados
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => handleEndSociety(s.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedAnimalsWithActiveLink.length > 0 && (
            <div className="p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200 font-semibold mb-2">
                <ShieldAlert className="h-5 w-5" />
                <span>Animais já vinculados ({selectedAnimalsWithActiveLink.length})</span>
              </div>
              <p className="text-sm text-orange-700 dark:text-orange-300 mb-4">
                Estes animais já estão em uma sociedade. Para encerrar o vínculo atual, informe a data e o motivo.
              </p>
              <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label className="text-orange-900 dark:text-orange-100">Data de Saída</Label>
                  <Input type="date" value={dataSaida} onChange={e => setDataSaida(e.target.value)} className="bg-orange-100/50 dark:bg-orange-900/50 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-100" />
                </div>
                <div className="flex-[2]">
                  <Label className="text-orange-900 dark:text-orange-100">Motivo</Label>
                  <Input value={motivoSaida} onChange={e => setMotivoSaida(e.target.value)} placeholder="Ex: Substituição de parceria" className="bg-orange-100/50 dark:bg-orange-900/50 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-100" />
                </div>
              </div>
              <Button size="sm" variant="outline" className="border-orange-300 text-orange-800 bg-orange-100/50" onClick={handleUnlinkAnimals}>
                Confirmar e Encerrar Vínculos
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
