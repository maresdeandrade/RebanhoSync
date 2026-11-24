import { useCallback, useRef } from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";

interface UnsavedChangesGuardOptions {
  isDirty: boolean;
  isSaving?: boolean;
}

export function useUnsavedChangesGuard({
  isDirty,
  isSaving = false,
}: UnsavedChangesGuardOptions) {
  const allowedNextPathRef = useRef<string | null>(null);
  const allowNextNavigationTo = useCallback((pathname: string) => {
    allowedNextPathRef.current = pathname;
  }, []);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => {
      const allowedPath = allowedNextPathRef.current;
      if (allowedPath) {
        allowedNextPathRef.current = null;
        if (allowedPath === nextLocation.pathname) return false;
      }

      return isDirty && currentLocation.pathname !== nextLocation.pathname;
    },
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

  return { ...blocker, allowNextNavigationTo };
}
