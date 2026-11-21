/** PostgREST errors are plain objects, not necessarily Error instances. */
export function authOperationError(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object" || !("message" in error) || typeof error.message !== "string") return fallback;
  const message = error.message;
  if (/JWT|cryptographic/i.test(message)) return "Não foi possível validar o acesso. Entre novamente ou tente mais tarde.";
  if (/Forbidden|permission denied/i.test(message)) return "Você não tem permissão para esta operação.";
  return message || fallback;
}
