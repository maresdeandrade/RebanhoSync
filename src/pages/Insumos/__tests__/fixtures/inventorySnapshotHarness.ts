import { readInventorySnapshot } from "../../adapters/readInventorySnapshot";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { useLiveQuery } from "dexie-react-hooks";
import { OfflineDB } from "@/lib/offline/db";
import type { InventorySnapshot } from "../../types";

export const collections = {
  insumos: "state_insumos",
  apresentacoes: "state_insumo_apresentacoes",
  lotes: "state_insumo_lotes",
  movimentacoes: "state_insumo_movimentacoes",
  eventos: "event_eventos",
  sanitario: "event_eventos_sanitario",
  nutricao: "event_eventos_nutricao",
  pasto: "event_eventos_pasto_avaliacao",
  produtos: "catalog_produtos_veterinarios",
} as const;
export type Collection = keyof typeof collections;
export const snapshotKeys = [
  ...Object.keys(collections),
  "pendingTxIds",
].sort();
export const retainedTombstones = new Set<Collection>(["eventos", "produtos"]);
export const statuses = [
  "PENDING",
  "SYNCING",
  "ERROR",
  "REJECTED",
  "DONE",
  "SYNCED",
] as const;
export function row(farm: string, name: string, deleted = false) {
  return {
    id: `${farm}-${name}${deleted ? "-deleted" : ""}`,
    evento_id: `${farm}-${name}${deleted ? "-deleted" : ""}`,
    fazenda_id: farm,
    deleted_at: deleted ? "2026-10-24T00:00:00Z" : null,
    payload: { preserved: [name, farm] },
  };
}
export async function seed(database: OfflineDB) {
  for (const [key, table] of Object.entries(collections)) {
    const farms = key === "produtos" ? ["global"] : ["A", "B"];
    await database
      .table(table)
      .bulkPut(farms.flatMap((farm) => [row(farm, key), row(farm, key, true)]));
  }
  await database.queue_gestures.bulkPut(
    ["A", "B"].flatMap((farm) =>
      statuses.map((status) => ({
        client_tx_id: `${farm}-${status}`,
        fazenda_id: farm,
        status,
        created_at: "2026-10-24T00:00:00Z",
        client_id: "test",
        updated_at: "2026-10-24T00:00:00Z",
      })),
    ),
  );
}
export function createDatabase() {
  return new OfflineDB(`inventory-snapshot-${crypto.randomUUID()}`);
}

export type SnapshotRead = (
  farm: string | null,
  database: OfflineDB,
) => Promise<InventorySnapshot | null>;
export function snapshotSource(source: string) {
  const file = ts.createSourceFile(
    "Insumos.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let declaration: ts.VariableDeclaration | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(file) === "snapshot"
    )
      declaration = node;
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (!declaration) throw new Error("Snapshot declaration missing");
  return { file, declaration };
}
export function queryFromSource(source: string): SnapshotRead {
  const { file, declaration } = snapshotSource(source);
  const expression = declaration.initializer as ts.BinaryExpression;
  const call = expression.left as ts.CallExpression;
  const query = call.arguments[0].getText(file);
  const js = ts.transpile(`const query = ${query};`, {
    target: ts.ScriptTarget.ES2020,
  });
  const run = new Function(
    "db",
    "activeFarmId",
    "readInventorySnapshot",
    js + " return query();",
  );
  return (farm, database) =>
    run(database, farm, (id: string | null) =>
      readInventorySnapshot(id, database),
    );
}
export function hookFromSource(source: string) {
  const { file, declaration } = snapshotSource(source);
  const js = ts.transpile("const " + declaration.getText(file) + ";", {
    target: ts.ScriptTarget.ES2020,
  });
  const run = new Function(
    "db",
    "activeFarmId",
    "useLiveQuery",
    "readInventorySnapshot",
    js + " return snapshot;",
  );
  return (farm: string | null, database: OfflineDB): InventorySnapshot | null =>
    run(database, farm, useLiveQuery, (id: string | null) =>
      readInventorySnapshot(id, database),
    );
}
export const baselineSource = readFileSync(
  resolve(
    process.cwd(),
    "src/pages/Insumos/__tests__/fixtures/inventorySnapshot.baseline.txt",
  ),
  "utf8",
);
export const pageSource = readFileSync(
  resolve(process.cwd(), "src/pages/Insumos.tsx"),
  "utf8",
);
export const readers = {
  baseline: queryFromSource(baselineSource),
  current: queryFromSource(pageSource),
};
export const hooks = {
  baseline: hookFromSource(baselineSource),
  current: hookFromSource(pageSource),
};
export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
