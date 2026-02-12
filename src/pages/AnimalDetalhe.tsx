import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import type { Evento, EventoReproducao } from "@/lib/offline/types";

type EnrichedEvent = Evento & { details?: EventoReproducao; machoIdentificacao?: string };
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Beef,
  Scale,
  Syringe,
  Move,
  History,
  Calendar,
  ChevronLeft,
  ArrowLeftRight,
} from "lucide-react";
import { MoverAnimalLote } from "@/components/manejo/MoverAnimalLote";
import { createGesture } from "@/lib/offline/ops";
import { showSuccess, showError } from "@/utils/toast";
import { classificarAnimal, getLabelCategoria } from "@/lib/domain/categorias";

const AnimalDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showMoverLote, setShowMoverLote] = useState(false);

  const animal = useLiveQuery(() => db.state_animais.get(id!), [id]);
  const lote = useLiveQuery(
    () => (animal?.lote_id ? db.state_lotes.get(animal.lote_id) : null),
    [animal],
  );

  const eventos = useLiveQuery<EnrichedEvent[]>(async () => {
    if (!id) return [];
    const evts = await db.event_eventos
      .where("animal_id")
      .equals(id)
      .reverse()
      .sortBy("occurred_at");

    return Promise.all(
      evts.map(async (evt) => {
        if (evt.dominio === "reproducao") {
          const details = await db.event_eventos_reproducao.get(evt.id);
          let machoIdentificacao = undefined;
          if (details?.macho_id) {
             const macho = await db.state_animais.get(details.macho_id);
             machoIdentificacao = macho?.identificacao;
          }
          return { ...evt, details, machoIdentificacao } as EnrichedEvent;
        }
        return evt as EnrichedEvent;
      }),
    );
  }, [id]);

  const agenda = useLiveQuery(
    () => db.state_agenda_itens.where("animal_id").equals(id!).toArray(),
    [id],
  );

  // Query latest weight from pesagem events (robust, without reverse+sortBy)
  const ultimoPeso = useLiveQuery(async () => {
    if (!id) return null;

    const eventos = await db.event_eventos
      .where("animal_id")
      .equals(id)
      .filter((e) => e.dominio === "pesagem")
      .toArray();

    if (!eventos.length) return null;

    // Find latest event manually (robust approach)
    const ultimo = eventos.reduce((best, cur) => {
      const bestT = new Date(
        best.server_received_at ?? best.occurred_at,
      ).getTime();
      const curT = new Date(
        cur.server_received_at ?? cur.occurred_at,
      ).getTime();
      return curT > bestT ? cur : best;
    }, eventos[0]);

    const det = await db.event_eventos_pesagem.get(ultimo.id);

    return det?.peso_kg
      ? {
          peso_kg: det.peso_kg,
          data: ultimo.server_received_at || ultimo.occurred_at,
        }
      : null;
  }, [id]);

  // Query next agenda item
  const proximaAgenda = useLiveQuery(async () => {
    if (!animal) return null;
    const hoje = new Date().toISOString().split("T")[0];
    const agendas = await db.state_agenda_itens
      .where("[fazenda_id+data_prevista]")
      .between(
        [animal.fazenda_id, hoje],
        [animal.fazenda_id, "9999-12-31"],
      )
      .filter(
        (a) =>
          a.animal_id === animal.id &&
          a.status === "agendado" &&
          (!a.deleted_at || a.deleted_at === null),
      )
      .toArray();
    return agendas.sort(
      (a, b) =>
        new Date(a.data_prevista).getTime() -
        new Date(b.data_prevista).getTime(),
    )[0];
  }, [animal]);

  // FASE 2.2: Query sociedade ativa
  const sociedadeAtiva = useLiveQuery(async () => {
    if (!animal?.id || animal.origem !== "sociedade") return null;
    const sociedades = await db.state_animais_sociedade
      .where("[fazenda_id+animal_id]")
      .equals([animal.fazenda_id, animal.id])
      .and((s) => s.deleted_at === null && s.fim === null)
      .toArray();
    return sociedades[0] || null;
  }, [animal]);

  // Query contraparte se existe sociedade ativa
  const contraparte = useLiveQuery(async () => {
    if (!sociedadeAtiva?.contraparte_id) return null;
    return await db.state_contrapartes.get(sociedadeAtiva.contraparte_id);
  }, [sociedadeAtiva]);

  // FASE 2.3: Query categorias zootécnicas ativas
  const categorias = useLiveQuery(
    async () => {
      if (!animal?.fazenda_id) return [];
      return await db.state_categorias_zootecnicas
        .where("fazenda_id")
        .equals(animal.fazenda_id)
        .filter((c) => !c.deleted_at && c.ativa)
        .toArray();
    },
    [animal?.fazenda_id]
  );

  const categoriaAtual = animal && categorias ? classificarAnimal(animal, categorias) : null;

  if (!animal)
    return (
      <div className="p-12 text-center text-muted-foreground">
        Carregando animal...
      </div>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/animais">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{animal.identificacao}</h1>
            <Badge variant="outline" className="text-sm">
              {animal.sexo === "M" ? "Macho" : "Fêmea"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {lote ? `Lote: ${lote.nome}` : "Sem lote definido"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              params.set("dominio", "financeiro");
              params.set("animalId", animal.id);
              if (animal.lote_id) {
                params.set("loteId", animal.lote_id);
              }
              navigate(`/registrar?${params.toString()}`);
            }}
          >
            Registrar Venda
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMoverLote(true)}
          >
            <ArrowLeftRight className="h-4 w-4 mr-2" />
            Mover Lote
          </Button>
          <Link to={`/animais/${id}/editar`}>
            <Button variant="outline" size="sm">
              Editar
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="bg-primary/5 border-none shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Peso Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ultimoPeso ? (
              <div>
                <div className="text-2xl font-bold flex items-center gap-2">
                  <Scale className="h-5 w-5 text-primary" />
                  {ultimoPeso.peso_kg} kg
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(ultimoPeso.data).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <div className="text-2xl font-bold flex items-center gap-2 text-muted-foreground">
                <Scale className="h-5 w-5" />
                Sem pesagem
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline">{animal.sexo === "M" ? "Macho" : "Fêmea"}</Badge>
            <Badge variant="default">{animal.status}</Badge>
            {animal.origem && animal.origem !== "nascimento" && (
              <Badge variant="secondary">
                📍 {animal.origem.charAt(0).toUpperCase() + animal.origem.slice(1)}
              </Badge>
            )}
            {animal.raca && (
              <Badge variant="outline">
                🐄 {animal.raca}
              </Badge>
            )}
            {/* Badge de sociedade ativa */}
            {animal.origem === "sociedade" && sociedadeAtiva && contraparte && (
              <Badge variant="default" className="bg-blue-600">
                🤝 {contraparte.nome}
                {sociedadeAtiva.percentual && ` (${sociedadeAtiva.percentual}%)`}
              </Badge>
            )}
            {/* FASE 2.3: Badge de categoria zootécnica */}
            {categoriaAtual && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                  🐂 {getLabelCategoria(categoriaAtual)}
                </Badge>
            )}
          </CardContent>
        </Card>
        <Card className="bg-primary/5 border-none shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">
              Próximo Manejo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {proximaAgenda
                ? new Date(proximaAgenda.data_prevista).toLocaleDateString()
                : "Sem agenda"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FASE 2.2: Seção detalhada de Sociedade */}
      {animal.origem === "sociedade" && sociedadeAtiva && contraparte && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-blue-900 flex items-center gap-2">
                🤝 Detalhes da Sociedade
              </CardTitle>
              <Badge variant="default" className="bg-blue-600">
                {sociedadeAtiva.fim ? "Encerrada" : "Ativa"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Contraparte</p>
                <p className="font-semibold text-blue-900">{contraparte.nome}</p>
              </div>
              
              {sociedadeAtiva.percentual && (
                <div>
                  <p className="text-xs text-muted-foreground">Participação da Fazenda</p>
                  <p className="font-semibold text-blue-900">{sociedadeAtiva.percentual}%</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Data de Início</p>
                <p className="font-medium">
                  {new Date(sociedadeAtiva.inicio).toLocaleDateString("pt-BR")}
                </p>
              </div>
              
              {sociedadeAtiva.fim && (
                <div>
                  <p className="text-xs text-muted-foreground">Data de Encerramento</p>
                  <p className="font-medium">
                    {new Date(sociedadeAtiva.fim).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              )}
            </div>

            {!sociedadeAtiva.fim && (
              <div className="flex gap-2 pt-2 border-t border-blue-200">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={async () => {
                    if (!confirm("Deseja realmente encerrar esta sociedade?")) return;
                    const now = new Date().toISOString();
                    const hoje = new Date().toISOString().split("T")[0];
                    
                    try {
                      await createGesture(animal.fazenda_id, [{
                        table: "animais_sociedade",
                        action: "UPDATE",
                        record: {
                          id: sociedadeAtiva.id,
                          fim: hoje,
                          updated_at: now,
                        }
                      }]);
                      showSuccess("Sociedade encerrada!");
                    } catch (e) {
                      showError("Erro ao encerrar sociedade.");
                    }
                  }}
                >
                  Encerrar Sociedade
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] bg-muted/50 p-1">
          <TabsTrigger value="timeline" className="gap-2 rounded-md">
            <History className="h-4 w-4" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-2 rounded-md">
            <Calendar className="h-4 w-4" /> Agenda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-6">
          <div className="space-y-6 pl-4 border-l-2 border-muted ml-4">
            {eventos?.length === 0 ? (
              <p className="text-muted-foreground py-4">
                Nenhum evento registrado.
              </p>
            ) : (
              eventos?.map((evt) => (
                <div key={evt.id} className="relative">
                  <div
                    className={`absolute -left-[25px] h-4 w-4 rounded-full border-2 border-background ${
                      evt.dominio === "sanitario"
                        ? "bg-blue-500"
                        : evt.dominio === "pesagem"
                          ? "bg-emerald-500"
                          : evt.dominio === "reproducao"
                            ? "bg-rose-500"
                            : "bg-slate-500"
                    }`}
                  />
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold capitalize text-sm">
                      {evt.dominio === "reproducao" && evt.details
                        ? `Reprodução: ${evt.details.tipo}`
                        : evt.dominio}
                    </h4>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {new Date(evt.occurred_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {evt.observacoes || "Manejo realizado no campo."}
                  </p>
                  {evt.dominio === "reproducao" && evt.details && (
                     <div className="mt-1 text-xs bg-rose-50/50 p-2 rounded border border-rose-100">
                        {evt.details.macho_id && <p>Reprodutor: {evt.machoIdentificacao || evt.details.macho_id}</p>}
                        {evt.details.payload?.diagnostico_resultado && (
                           <p>Diagnóstico: {String(evt.details.payload.diagnostico_resultado)}</p>
                        )}
                        {evt.details.payload?.numero_crias && (
                           <p>Crias: {Number(evt.details.payload.numero_crias)}</p>
                        )}
                     </div>
                  )}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="agenda" className="mt-6">
          <div className="grid gap-3">
            {agenda?.map((item) => (
              <Card
                key={item.id}
                className={
                  item.status === "agendado"
                    ? "border-amber-200 bg-amber-50/30"
                    : ""
                }
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{item.tipo}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Previsto:{" "}
                        {new Date(item.data_prevista).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      item.status === "agendado" ? "default" : "secondary"
                    }
                    className="text-[10px]"
                  >
                    {item.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
            {agenda?.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Sem tarefas agendadas.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Mover Animal */}
      {animal && (
        <MoverAnimalLote
          animal={animal}
          open={showMoverLote}
          onOpenChange={setShowMoverLote}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
};

export default AnimalDetalhe;
