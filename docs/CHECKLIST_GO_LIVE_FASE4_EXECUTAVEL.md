# Checklist Executavel - Go-Live Fase 4

Data: 2026-02-12  
Escopo: rollout controlado de regras estritas de eventos, com validacao objetiva de criterios de aceite.

## 1. Artefatos

1. Query pack SQL: `docs/sql/FASE4_GO_LIVE_QUERIES.sql`
2. Runbook de rollback: `docs/RUNBOOK_ROLLBACK_EVENTOS_FASE4.md`
3. Plano de implantacao: `docs/PLANO_UNIFICACAO_EVENTOS_V3_IMPLANTACAO.md`

## 2. Criterios de aceite (Fase 4)

| Gate | Criterio | Fonte de medicao | Aprovacao |
|---|---|---|---|
| `G1` | `>= 99%` de sync sem erro no piloto (janela 30 min) | Browser snippet (Dexie `queue_gestures`) | PASS |
| `G2` | Zero incidente de isolamento entre fazendas | SQL `[S05]`, `[S07]`, `[S08]` | PASS |
| `G3` | Rollout concluido com monitoracao ativa | SQL `[S01]`, `[S02]` + dashboard + evidencias registradas | PASS |
| `G4` | Hardening tecnico aplicado (constraints/FKs sem faltas) | SQL `[S03]`, `[S08]` | PASS |

## 3. Execucao operacional (ordem)

1. Executar `docs/sql/FASE4_GO_LIVE_QUERIES.sql` no SQL Editor do Supabase.
2. Ajustar `_fase4_go_live_params.pilot_farms` no bloco `[S00]` para as fazendas do piloto.
3. Rodar e salvar evidencias dos blocos:
   1. `[S01]` e `[S02]` para rollout/flags.
   2. `[S03]` e `[S04]` para baseline tecnico.
   3. `[S05]`, `[S07]` e `[S08]` para isolamento.
4. Durante 30 minutos, capturar snapshots locais com o snippet `B01` (a cada 5 minutos) em cada fazenda piloto.
5. Ao final da janela, executar `B02` para avaliar KPI local de sync e tendencia de backlog.
6. Consolidar as evidencias na secao 6 e decidir `GO` ou `NO-GO`.

## 4. Snippets executaveis no navegador (Dexie)

Uso: abrir o app com a fazenda piloto selecionada, abrir DevTools Console e executar.

### B01 - Snapshot de KPI local (30 min)

```javascript
(async () => {
  const DB_NAME = "RebanhoSync";
  const WINDOW_MIN = 30;
  const farmId = localStorage.getItem("gestao_agro_active_farm_id");

  if (!farmId) {
    throw new Error("Fazenda ativa ausente no localStorage (gestao_agro_active_farm_id).");
  }

  const openDb = (name) =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const getAll = (db, storeName) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction([storeName], "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

  const db = await openDb(DB_NAME);
  const gesturesAll = await getAll(db, "queue_gestures");
  const rejectionsAll = await getAll(db, "queue_rejections");

  const cutoff = Date.now() - WINDOW_MIN * 60 * 1000;
  const gestures = gesturesAll.filter(
    (g) =>
      g.fazenda_id === farmId &&
      g.created_at &&
      new Date(g.created_at).getTime() >= cutoff,
  );
  const rejections = rejectionsAll.filter(
    (r) =>
      r.fazenda_id === farmId &&
      r.created_at &&
      new Date(r.created_at).getTime() >= cutoff,
  );

  const byStatus = gestures.reduce((acc, g) => {
    const status = String(g.status || "UNKNOWN");
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const successful = (byStatus.DONE || 0) + (byStatus.SYNCED || 0);
  const failed = (byStatus.ERROR || 0) + (byStatus.REJECTED || 0);
  const backlog = (byStatus.PENDING || 0) + (byStatus.SYNCING || 0);
  const processed = successful + failed;
  const successRate = processed > 0 ? (successful / processed) * 100 : 100;
  const failureRate = processed > 0 ? (failed / processed) * 100 : 0;

  const rejectionByReason = rejections.reduce((acc, r) => {
    const reason = String(r.reason_code || "UNKNOWN");
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});

  const snapshot = {
    captured_at: new Date().toISOString(),
    window_min: WINDOW_MIN,
    farm_id: farmId,
    processed_30m: processed,
    successful_30m: successful,
    failed_30m: failed,
    backlog,
    success_rate_pct: Number(successRate.toFixed(2)),
    failure_rate_pct: Number(failureRate.toFixed(2)),
    by_status: byStatus,
    rejection_count_30m: rejections.length,
  };

  window.__fase4GoLiveSnapshots = window.__fase4GoLiveSnapshots || [];
  window.__fase4GoLiveSnapshots.push(snapshot);

  console.table([snapshot]);
  console.table(
    Object.entries(rejectionByReason)
      .map(([reason_code, count]) => ({ reason_code, count }))
      .sort((a, b) => b.count - a.count),
  );
  console.log("Snapshots acumulados:", window.__fase4GoLiveSnapshots.length);
})();
```

### B02 - Avaliacao final da janela de piloto

```javascript
(() => {
  const rows = window.__fase4GoLiveSnapshots || [];
  if (rows.length < 2) {
    console.warn("Colete pelo menos 2 snapshots com B01 antes de avaliar.");
    return;
  }

  const first = rows[0];
  const last = rows[rows.length - 1];

  const gates = [
    {
      gate: "G1.1 sample_size",
      pass: last.processed_30m >= 20,
      detail: `processed_30m=${last.processed_30m} (min recomendado: 20)`,
    },
    {
      gate: "G1.2 sync_success_99",
      pass: last.success_rate_pct >= 99,
      detail: `success_rate_pct=${last.success_rate_pct}`,
    },
    {
      gate: "G1.3 backlog_not_growing",
      pass: last.backlog <= first.backlog,
      detail: `backlog inicio=${first.backlog}, fim=${last.backlog}`,
    },
  ];

  console.table(gates);
  console.table(rows);

  const overall = gates.every((g) => g.pass);
  console.log("RESULTADO PILOTO (cliente):", overall ? "PASS" : "FAIL");
})();
```

### B03 - Exportar evidencia JSON dos snapshots

```javascript
copy(JSON.stringify(window.__fase4GoLiveSnapshots || [], null, 2));
```

## 5. Regras de decisao GO/NO-GO

1. `GO` somente se `G1`, `G2`, `G3` e `G4` estiverem `PASS`.
2. `NO-GO` imediato se:
   1. `S05` ou `S07` retornar qualquer inconsistencia.
   2. `S08.gate_tenant_isolation = FAIL`.
   3. `G1.2` ficar abaixo de 99% por mais de 30 minutos.
3. Em `NO-GO`, aplicar rollback conforme `docs/RUNBOOK_ROLLBACK_EVENTOS_FASE4.md`.

## 6. Registro de evidencias (preencher)

| Data/Hora (UTC) | Responsavel | Gate | Resultado | Evidencia |
|---|---|---|---|---|
|  |  | `G1` |  | Screenshot dashboard + JSON B03 |
|  |  | `G2` |  | Output SQL `[S05]`, `[S07]`, `[S08]` |
|  |  | `G3` |  | Output SQL `[S01]`, `[S02]` + screenshot dashboard |
|  |  | `G4` |  | Output SQL `[S03]`, `[S04]`, `[S08]` |

## 7. Evidencias minimas obrigatorias

1. Captura de tela do dashboard operacional por fazenda piloto (inicio, meio e fim da janela).
2. Output da query `[S08]` com gates SQL consolidados.
3. JSON exportado do `B03` para cada fazenda piloto.
4. Registro de decisao final com status `GO` ou `NO-GO`.
