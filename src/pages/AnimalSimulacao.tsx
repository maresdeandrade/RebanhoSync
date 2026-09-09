import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { useAuth } from "@/hooks/useAuth";
import { ProductiveCommercialSimulator } from "@/features/productiveSimulation/ProductiveCommercialSimulator";
import { PageHeader } from "@/components/ui/page-header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function AnimalSimulacao() {
  const { id } = useParams<{ id: string }>();
  const { currentFazenda } = useAuth();
  const fazendaId = currentFazenda?.id;

  const animal = useLiveQuery(
    async () => {
      if (!id || !fazendaId) return null;
      const record = await db.state_animais.get(id);
      return record && record.fazenda_id === fazendaId && !record.deleted_at ? record : null;
    },
    [id, fazendaId],
  );

  if (!fazendaId || !animal) {
    return (
      <PageContainer>
        <div className="py-12 text-center text-muted-foreground">
          Carregando dados do animal...
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/animais/${animal.id}`}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Voltar para o detalhe do animal
          </Link>
        </Button>
      </div>

      <PageHeader
        title={`Simulação de Cenários — ${animal.brinco || animal.nome || "Animal"}`}
        description="Simulador de cenários prospectivos baseado em dados observados e premissas explícitas."
      />

      <div className="mt-6">
        <ProductiveCommercialSimulator
          animal={animal}
          fazendaId={fazendaId}
        />
      </div>
    </PageContainer>
  );
}
