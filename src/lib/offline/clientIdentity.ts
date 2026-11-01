export const getClientId = () => {
  const key = "gestao_agro_client_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const next = `browser:${crypto.randomUUID()}`;
  localStorage.setItem(key, next);
  return next;
};
