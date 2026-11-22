import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Blocker } from "react-router-dom";

interface UnsavedChangesDialogProps {
  blocker: Blocker;
  description: string;
}

export function UnsavedChangesDialog({
  blocker,
  description,
}: UnsavedChangesDialogProps) {
  const isBlocked = blocker.state === "blocked";

  return (
    <AlertDialog open={isBlocked}>
      <AlertDialogContent
        onEscapeKeyDown={() => {
          if (blocker.state === "blocked") blocker.reset();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Descartar alterações não salvas?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              if (blocker.state === "blocked") blocker.reset();
            }}
          >
            Continuar editando
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (blocker.state === "blocked") blocker.proceed();
            }}
          >
            Descartar alterações
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
