// Matches the PostgreSQL v1 normalizer for the JSON values emitted by the client.
const encoder = new TextEncoder();
function compareUtf8(a: string, b: string) {
  const left = encoder.encode(a),
    right = encoder.encode(b);
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i] !== right[i]) return left[i] - right[i];
  }
  return left.length - right.length;
}
function decimal(value: number) {
  if (!Number.isFinite(value)) throw new Error("MOVEMENT_NON_JSON_NUMBER");
  const text = JSON.stringify(value);
  if (!text.includes("e")) return text;
  const [mantissa, power] = text.split("e");
  const sign = mantissa.startsWith("-") ? "-" : "";
  const unsigned = mantissa.replace(/^-/, "");
  const dot = unsigned.indexOf(".");
  const digits = unsigned.replace(".", "");
  const position = (dot < 0 ? unsigned.length : dot) + Number(power);
  return (
    sign +
    (position <= 0
      ? "0." + "0".repeat(-position) + digits
      : position >= digits.length
        ? digits + "0".repeat(position - digits.length)
        : digits.slice(0, position) + "." + digits.slice(position))
  );
}
export function canonicalMovementJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "number") return decimal(value);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") {
    // jsonb rejects NUL and unpaired UTF-16 surrogates: never hash a lossy replacement.
    if (
      value.includes("\u0000") ||
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
        value,
      )
    ) {
      throw new Error("MOVEMENT_NON_POSTGRES_STRING");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value))
    return "[" + value.map(canonicalMovementJson).join(",") + "]";
  if (
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const record = value as Record<string, unknown>;
    return (
      "{" +
      Object.keys(record)
        .sort(compareUtf8)
        .map(
          (key) =>
            canonicalMovementJson(key) +
            ":" +
            canonicalMovementJson(record[key]),
        )
        .join(",") +
      "}"
    );
  }
  throw new Error("MOVEMENT_NON_JSON_VALUE");
}
export function normalizeMovementInput(input: Record<string, unknown>) {
  canonicalMovementJson(input);
  // The transport is JSON: normalize -0 exactly as JSON.stringify sends it.
  input = JSON.parse(JSON.stringify(input)) as Record<string, unknown>;
  const timestamp = String(input.occurred_at);
  const match = timestamp.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match) throw new Error("MOVEMENT_FACTUAL_TIME_INVALID");
  const date = new Date(match[1] + match[3]);
  if (!Number.isFinite(date.getTime()))
    throw new Error("MOVEMENT_FACTUAL_TIME_INVALID");
  const occurredAt =
    date.toISOString().slice(0, 19) +
    "." +
    (match[2] ?? "").padEnd(6, "0") +
    "Z";
  const id = (value: unknown) =>
    value == null ? null : String(value).toLowerCase();
  const base = input.movement_base as Record<string, unknown> | null;
  return {
    contract_version: 1,
    fazenda_id: id(input.fazenda_id),
    subject_type: "animal",
    subject_id: id(input.subject_id),
    event_id: id(input.event_id),
    client_op_id: id(input.client_op_id),
    client_tx_id: id(input.client_tx_id),
    movement_mode: input.movement_mode,
    from_lote_id: id(input.from_lote_id),
    to_lote_id: id(input.to_lote_id),
    occurred_at: occurredAt,
    movement_base:
      base === null
        ? null
        : base.kind === "snapshot"
          ? {
              kind: "snapshot",
              movement_version: String(base.movement_version),
              head_event_id: id(base.head_event_id),
            }
          : {
              kind: "after_movement",
              event_id: id(base.event_id),
              command_digest: base.command_digest,
            },
    source_task_id: id(input.source_task_id),
    corrige_evento_id: null,
    observacoes: input.observacoes ?? null,
    payload: input.payload ?? {},
    detail_payload: input.detail_payload ?? {},
  };
}
export async function movementCommandDigest(input: Record<string, unknown>) {
  const bytes = encoder.encode(
    canonicalMovementJson(normalizeMovementInput(input)),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
