export * from "../admin/adminTypes";
export * from "../admin/adminApi";

/**
 * Avalia autorização de superadmin com base no estado do banco de dados (mock / evaluator).
 */
export function evaluateSuperAdminAccess(params: {
  userId: string | null;
  superAdminUserIds: Set<string>;
  farmRoles?: { farmId: string; role: "owner" | "manager" | "cowboy" }[];
}): boolean {
  if (!params.userId) {
    return false;
  }

  // Apenas a presença na tabela app_superadmins concede acesso.
  // Nenhum papel de fazenda (mesmo owner) concede acesso global.
  return params.superAdminUserIds.has(params.userId);
}
