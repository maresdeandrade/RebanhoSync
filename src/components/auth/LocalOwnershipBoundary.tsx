import { useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import {
  resetUnknownLocalDatabase,
  UNKNOWN_LOCAL_RESET_CONFIRMATION,
} from "@/lib/offline/unknownOwnershipRecovery";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function UnknownLocalDatabaseRecovery() {
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async () => {
    setIsResetting(true);
    setError(null);

    try {
      await resetUnknownLocalDatabase({
        confirmation: UNKNOWN_LOCAL_RESET_CONFIRMATION,
      });
    } catch {
      setError(
        "Não foi possível limpar os dados locais. Recarregue a página e tente novamente.",
      );
      setIsResetting(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger/10 text-danger">
            <AlertTriangle aria-hidden="true" />
          </div>
          <CardTitle>Dados locais não podem ser verificados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Existem dados locais de uma versão anterior cuja conta proprietária
              não pode ser verificada.
            </p>
            <p>
              Por segurança, esses dados não podem ser abertos nem sincronizados.
              Para continuar neste dispositivo, é necessário limpar os dados locais.
            </p>
            <p className="font-semibold text-danger">
              Dados ainda não sincronizados serão descartados e poderão ser perdidos.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                disabled={isResetting}
              >
                {isResetting
                  ? "Limpando dados locais..."
                  : "Limpar dados locais e continuar"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar limpeza destrutiva?</AlertDialogTitle>
                <AlertDialogDescription>
                  A base local deste dispositivo será removida por completo. Cache,
                  operações pendentes, erros de sincronização e obrigações de
                  reconciliação não poderão ser recuperados pelo aplicativo.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-danger text-danger-foreground hover:bg-danger/90"
                  onClick={() => void handleReset()}
                >
                  Limpar definitivamente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </main>
  );
}

export function LocalOwnershipBoundary({ children }: { children: ReactNode }) {
  const { localOwnership } = useAuth();

  if (
    localOwnership?.status === "UNKNOWN" &&
    localOwnership.currentUserId !== null
  ) {
    return <UnknownLocalDatabaseRecovery />;
  }

  return <>{children}</>;
}
