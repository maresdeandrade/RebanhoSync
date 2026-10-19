const INVITE_PATH =
  /^\/invites\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// URLSearchParams decodifica uma vez; percentuais residuais não são aceitos.
export function getInviteRedirect(search: string): string | null {
  const values = new URLSearchParams(search).getAll("redirect");
  if (values.length !== 1) return null;
  const destination = values[0];
  return destination.length === "/invites/".length + 36 &&
    INVITE_PATH.test(destination)
    ? destination
    : null;
}

export function getInviteAuthPath(
  page: "login" | "signup",
  search: string,
): string {
  const destination = getInviteRedirect(search);
  return destination
    ? `/${page}?${new URLSearchParams({ redirect: destination })}`
    : `/${page}`;
}

export function getPostAuthDestination(
  search: string,
  activeFarmId: string | null,
): string {
  return (
    getInviteRedirect(search) ?? (activeFarmId ? "/home" : "/select-fazenda")
  );
}
