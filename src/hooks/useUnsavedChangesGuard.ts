import { useCallback } from "react";
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
      currentLocation.pathname !== nextLocation.pathname,
  );

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
