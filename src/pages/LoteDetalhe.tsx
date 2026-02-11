import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  MapPin,
  Beef,
  PawPrint,
  UserPlus,
  ArrowRightLeft,
  Repeat,
} from "lucide-react";
import { AdicionarAnimaisLote } from "@/components/manejo/AdicionarAnimaisLote";
import { MudarPastoLote } from "@/components/manejo/MudarPastoLote";
import { TrocarTouroLote } from "@/components/manejo/TrocarTouroLote";

const LoteDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // States para controlar modais
  const [showAdicionarAnimais, setShowAdicionarAnimais] = useState(false);
  const [showMudarPasto, setShowMudarPasto] = useState(false);
  const [showTrocarTouro, setShowTrocarTouro] = useState(false);

  const lote = useLiveQuery(
    () => (id ? db.state_lotes.get(id) : undefined),
    [id],
  );

  const pasto = useLiveQuery(
    () => (lote?.pasto_id ? db.state_pastos.get(lote.pasto_id) : undefined),
    [lote?.pasto_id],
  );

  const touro = useLiveQuery(
    () => (lote?.touro_id ? db.state_animais.get(lote.touro_id) : undefined),
    [lote?.touro_id],
  );

  const animais = useLiveQuery(
    () => (id ? db.state_animais.where("lote_id").equals(id).toArray() : []),
    [id],
  );

  const handleSuccess = () => {
    // Modais já fecham automaticamente, apenas precisamos refrescar queries
    // (Dexie useLiveQuery já faz isso automaticamente)
  };

  if (!id || !lote) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/lotes")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Lote não encontrado</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/lotes")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{lote.nome}</h1>
              {lote.status && (
                <Badge
                  variant={lote.status === "ativo" ? "default" : "secondary"}
                >
                  {lote.status}
                </Badge>
              )}
            </div>
            {pasto && (
              <p className="text-muted-foreground">Pasto: {pasto.nome}</p>
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-2 flex-wrap">
          <Link to={`/lotes/${id}/editar`}>
            <Button variant="outline" size="sm">
              Editar
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdicionarAnimais(true)}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Adicionar Animais
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMudarPasto(true)}
          >
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Mudar Pasto
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTrocarTouro(true)}
          >
            <Repeat className="h-4 w-4 mr-2" />
            Trocar Touro
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {pasto && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Localização
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Pasto</p>
              <Link
                to={`/pastos/${pasto.id}`}
                className="text-lg font-semibold hover:underline"
              >
                {pasto.nome}
              </Link>
              {pasto.area_ha && (
                <p className="text-sm text-muted-foreground mt-1">
                  {pasto.area_ha} ha
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {touro && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Beef className="h-4 w-4" />
                Reprodutor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Touro</p>
              <Link
                to={`/animais/${touro.id}`}
                className="text-lg font-semibold hover:underline text-emerald-600"
              >
                {touro.identificacao}
              </Link>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PawPrint className="h-4 w-4" />
              Animais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{animais?.length || 0}</p>
            <p className="text-sm text-muted-foreground">animais neste lote</p>
          </CardContent>
        </Card>
      </div>

      {animais && animais.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Animais do Lote</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {animais.map((animal) => (
                <Link
                  key={animal.id}
                  to={`/animais/${animal.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-semibold">{animal.identificacao}</p>
                    <p className="text-xs text-muted-foreground">
                      {animal.sexo === "M" ? "Macho" : "Fêmea"} •{" "}
                      {animal.status}
                    </p>
                  </div>
                  <Badge variant="outline">{animal.sexo}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modais */}
      {lote && (
        <>
          <AdicionarAnimaisLote
            lote={lote}
            open={showAdicionarAnimais}
            onOpenChange={setShowAdicionarAnimais}
            onSuccess={handleSuccess}
          />
          <MudarPastoLote
            lote={lote}
            open={showMudarPasto}
            onOpenChange={setShowMudarPasto}
            onSuccess={handleSuccess}
          />
          <TrocarTouroLote
            lote={lote}
            open={showTrocarTouro}
            onOpenChange={setShowTrocarTouro}
            onSuccess={handleSuccess}
          />
        </>
      )}
    </div>
  );
};

export default LoteDetalhe;
