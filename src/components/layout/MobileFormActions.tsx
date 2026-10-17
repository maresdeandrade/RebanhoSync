import type { ReactNode } from "react";

export function MobileFormActions({ children }: { children: ReactNode }) {
  return <div className="mobile-form-actions">{children}</div>;
}
