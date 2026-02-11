import { Skeleton } from "@/components/ui/skeleton";

/**
 * P1.5 FIX: Loading screen with skeleton UI for better UX
 * Used in AuthGate during authentication check
 */
export function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-md space-y-6">
        {/* App title skeleton */}
        <Skeleton className="h-12 w-48 mx-auto" />

        {/* Content cards skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>

        {/* Footer skeleton */}
        <Skeleton className="h-10 w-32 mx-auto" />
      </div>
    </div>
  );
}
