import { BookOpenCheck, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/useAuth";

const readOnlyGuards = [
  "Leitura local/offline via Dexie.",
  "Sem criacao de agenda.",
  "Sem registro de evento.",
  "Sem movimentacao de estoque.",
  "Sem carencia ativa.",
  "Sem liberacao operacional.",
];

const ProtocolosSanitarios = () => {
  const navigate = useNavigate();
  const { activeFarmId } = useAuth();

  if (!activeFarmId) {
    return (
      <div className="container mx-auto space-y-5 pb-10">
        <EmptyState
          icon={ShieldCheck}
          title="Fazenda nao selecionada"
          action={{
            label: "Selecionar fazenda",
            onClick: () => navigate("/select-fazenda"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-5 pb-10">
      <PageIntro
        eyebrow="Sanitario"
        title="Protocolos sanitarios"
        description="Superficie somente leitura do catalogo sanitario v2. As interfaces legadas de pack, conformidade e protocolos editaveis foram ocultadas para evitar uso de dados nao canonicos."
        meta={
          <>
            <StatusBadge tone="neutral">Somente leitura</StatusBadge>
            <StatusBadge tone="info">Catalogo v2</StatusBadge>
          </>
        }
        actions={
          <Button onClick={() => navigate("/protocolos-sanitarios/catalogo-v2")}>
            Abrir catalogo sanitario v2
          </Button>
        }
      />

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {readOnlyGuards.map((guard) => (
          <div
            key={guard}
            className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-muted-foreground"
          >
            {guard}
          </div>
        ))}
      </section>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <BookOpenCheck className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Catalogo Sanitario v2</CardTitle>
              <CardDescription>
                Protocolos, itens e grupos técnicos locais, sem automacao
                operacional.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => navigate("/protocolos-sanitarios/catalogo-v2")}
          >
            Consultar catalogo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProtocolosSanitarios;
