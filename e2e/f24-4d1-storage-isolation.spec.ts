import { expect, test, type Page } from "@playwright/test";

const DATABASE_NAME = "RebanhoSync";
const PROBE_KEY = "f24_4d1_storage_probe";
const STORES = [
  "queue_ops",
  "queue_gestures",
  "sync_reconcile_obligations",
] as const;

type ProbeStore = (typeof STORES)[number];

async function openFrontendDatabase(page: Page) {
  return page.evaluate(async () => {
    const { db } = await import("/src/lib/offline/db.ts");
    await db.open();
    return { name: db.name, stores: db.tables.map((table) => table.name) };
  });
}

async function putMarker(
  page: Page,
  storeName: ProbeStore,
  record: Record<string, string>,
) {
  await page.evaluate(
    async ({ storeName, record, databaseName }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction(storeName, "readwrite");
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
          transaction.objectStore(storeName).put(record);
        });
      } finally {
        database.close();
      }
    },
    { storeName, record, databaseName: DATABASE_NAME },
  );
}

async function getMarker(page: Page, storeName: ProbeStore, key: string) {
  return page.evaluate(
    async ({ storeName, key, databaseName }) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        return await new Promise<Record<string, string> | undefined>(
          (resolve, reject) => {
            const transaction = database.transaction(storeName, "readonly");
            const request = transaction.objectStore(storeName).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          },
        );
      } finally {
        database.close();
      }
    },
    { storeName, key, databaseName: DATABASE_NAME },
  );
}

async function readSessionProbe(page: Page) {
  return page.evaluate((key) => ({
    local: localStorage.getItem(key),
    session: sessionStorage.getItem(key),
    cookie: document.cookie.includes(`${key}=`),
  }), PROBE_KEY);
}

test("F24.4D1: BrowserContexts isolam IndexedDB, filas e artefatos de sessão", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  try {
    expect(contextA).not.toBe(contextB);
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    expect(pageA).not.toBe(pageB);
    await Promise.all([pageA.goto("/"), pageB.goto("/")]);

    const [databaseA, databaseB] = await Promise.all([
      openFrontendDatabase(pageA),
      openFrontendDatabase(pageB),
    ]);
    for (const database of [databaseA, databaseB]) {
      expect(database.name).toBe(DATABASE_NAME);
      expect(database.stores).toEqual(expect.arrayContaining([...STORES]));
    }

    const markerA = crypto.randomUUID();
    const markerB = crypto.randomUUID();
    const markerKeys = {
      queue_ops: "client_op_id",
      queue_gestures: "client_tx_id",
      sync_reconcile_obligations: "key",
    } as const;

    for (const store of STORES) {
      const keyName = markerKeys[store];
      await putMarker(pageA, store, { [keyName]: markerA });
      expect(await getMarker(pageA, store, markerA)).toEqual({
        [keyName]: markerA,
      });
      expect(await getMarker(pageB, store, markerA)).toBeUndefined();

      await putMarker(pageB, store, { [keyName]: markerB });
      expect(await getMarker(pageB, store, markerB)).toEqual({
        [keyName]: markerB,
      });
      expect(await getMarker(pageA, store, markerB)).toBeUndefined();
    }

    await pageA.evaluate(
      ({ key, marker }) => {
        localStorage.setItem(key, marker);
        sessionStorage.setItem(key, marker);
        document.cookie = `${key}=${marker}; Path=/; SameSite=Lax`;
      },
      { key: PROBE_KEY, marker: markerA },
    );
    expect(await readSessionProbe(pageB)).toEqual({
      local: null,
      session: null,
      cookie: false,
    });

    await pageA.reload();
    expect(await getMarker(pageA, "queue_ops", markerA)).toEqual({
      client_op_id: markerA,
    });
    expect(await readSessionProbe(pageA)).toEqual({
      local: markerA,
      session: markerA,
      cookie: true,
    });

    const sameContextPage = await contextA.newPage();
    await sameContextPage.goto("/");
    expect(await getMarker(sameContextPage, "queue_ops", markerA)).toEqual({
      client_op_id: markerA,
    });
    expect((await readSessionProbe(sameContextPage)).local).toBe(markerA);
    expect((await readSessionProbe(sameContextPage)).cookie).toBe(true);

    await Promise.all([pageA.close(), sameContextPage.close()]);
    const reopenedPageA = await contextA.newPage();
    await reopenedPageA.goto("/");
    for (const store of STORES) {
      expect(await getMarker(reopenedPageA, store, markerA)).toEqual({
        [markerKeys[store]]: markerA,
      });
      expect(await getMarker(pageB, store, markerA)).toBeUndefined();
    }
  } finally {
    await Promise.all([contextA.close(), contextB.close()]);
  }
});
