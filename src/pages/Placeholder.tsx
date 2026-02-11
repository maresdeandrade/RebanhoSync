import { useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Placeholder = () => {
  const location = useLocation();
  const pageName = location.pathname.split("/").pop() || "Página";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold capitalize">
        {pageName.replace("-", " ")}
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Em Desenvolvimento</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            A tela de <strong>{location.pathname}</strong> está sendo preparada
            para a próxima fase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Placeholder;
