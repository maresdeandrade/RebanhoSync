import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface InfrastructureCardProps {
  name: string;
  estado: string | undefined;
  details: Array<{ label: string; value: string | number }>;
}

export function InfrastructureCard({ name, estado, details }: InfrastructureCardProps) {
  const getEstadoBadge = (estado: string | undefined) => {
    switch (estado) {
      case "bom":
        return <Badge variant="secondary">Bom</Badge>;
      case "regular":
        return <Badge variant="warning">Regular</Badge>;
      case "ruim":
        return <Badge variant="destructive">Ruim</Badge>;
      default:
        return <Badge variant="outline">Sem info</Badge>;
    }
  };

  return (
    <Card className="border border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{name}</CardTitle>
        {estado && <Badge className="ml-2">{getEstadoBadge(estado)}</Badge>}
      </CardHeader>
      <CardContent className="space-y-2">
        {details.map((detail, index) => (
          <div key={index} className="text-sm text-muted-foreground flex justify-between">
            <span>{detail.label}:</span>
            <span>{detail.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}