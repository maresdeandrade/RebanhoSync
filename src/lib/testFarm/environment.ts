const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalTestFarmHost(hostname: string) {
  return LOCAL_HOSTS.has(hostname);
}

/** The sync transport must target the same local backend as Auth and data. */
export function isLocalTestFarmBackend(backendUrl: string, functionsUrl: string) {
  try {
    const backend = new URL(backendUrl);
    const functions = new URL(functionsUrl);
    return isLocalTestFarmHost(backend.hostname) && /^https?:$/.test(backend.protocol) &&
      functions.origin === backend.origin &&
      functions.pathname.replace(/\/$/, "") === "/functions/v1";
  } catch {
    return false;
  }
}
