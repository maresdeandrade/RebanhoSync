import { AuthProvider } from "@/hooks/useAuth";
import { ReactNode } from "react";

export const AuthProviderWrapper = ({ children }: { children: ReactNode }) => {
  return <AuthProvider>{children}</AuthProvider>;
};