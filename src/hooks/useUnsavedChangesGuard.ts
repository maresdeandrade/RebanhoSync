import { useCallback, useEffect } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";

interface UnsavedChangesGuardOptions {
  isDirty: boolean;
  isSaving?: boolean;
}

export function useUnsavedChangesGuard({
  isDirty,
  isSaving = false,
}: UnsavedChangesGuardOptions) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty &&
      !isSaving &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    // Uma navegação iniciada durante o salvamento não deve criar uma segunda
    // intenção de descarte; o beforeunload continua protegendo a saída brusca.
    if (isSaving && blocker.state === "blocked") blocker.reset();
  }, [blocker, isSaving]);

  useBeforeUnload(
    useCallback(
      (event) => {
        if (isDirty || isSaving) {
          event.preventDefault();
          event.returnValue = "";
        }
      },
      [isDirty, isSaving],
    ),
  );

  return blocker;
}
