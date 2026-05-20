function buildQueryPath(pathname: string, key: string, value: string) {
  return `${pathname}?${key}=${encodeURIComponent(value)}`;
}

export function buildAgendaCalendarModePath(mode: string) {
  return buildQueryPath("/agenda", "calendarMode", mode);
}

export function buildAgendaCalendarAnchorPath(anchor: string) {
  return buildQueryPath("/agenda", "calendarAnchor", anchor);
}

export function buildAgendaOperationalClassPath(operationalClass: string) {
  return buildQueryPath("/agenda", "operationalClass", operationalClass);
}

export function buildAnimalsCalendarModePath(mode: string) {
  return buildQueryPath("/animais", "calendarMode", mode);
}

export function buildAnimalsCalendarAnchorPath(anchor: string) {
  return buildQueryPath("/animais", "calendarAnchor", anchor);
}
