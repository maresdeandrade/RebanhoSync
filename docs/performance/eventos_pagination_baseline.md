# Performance Baseline: Eventos Pagination

## Issue
The original implementation of the Eventos timeline loaded all records from 10 different tables for a given farm using `.toArray()`.

```typescript
const [
  eventos,
  sanitarios,
  pesagens,
  // ... (7 more tables)
] = await Promise.all([
  db.event_eventos.where("fazenda_id").equals(activeFarmId).toArray(),
  db.event_eventos_sanitario.where("fazenda_id").equals(activeFarmId).toArray(),
  // ...
]);
```

## Performance Rationale
As the number of events grows (e.g., >10,000 events), this approach suffers from:
1. **High Memory Usage**: Loading tens of thousands of objects into the browser's heap can lead to crashes or GC thrashing.
2. **CPU Overhead**: Filtering and sorting such large arrays in memory for every render/filter change is expensive.
3. **I/O Latency**: Fetching all records from IndexedDB via `.toArray()` is significantly slower than fetching a paginated subset.

## Baseline Analysis (Conceptual)
| Metric | Full Load (`.toArray()`) | Paginated (`.limit(50)`) |
| :--- | :--- | :--- |
| **Data Fetched** | ~N records | ~50 records |
| **Complexity** | O(N) memory & O(N log N) sort | O(Limit) memory & O(log N) indexed fetch |
| **Scalability** | Degrades linearly with N | Constant performance for initial load |

## Optimization
The implementation will use Dexie's `.limit()` on the primary `event_eventos` table and use `.anyOf()` to fetch only the necessary details for the visible events.
