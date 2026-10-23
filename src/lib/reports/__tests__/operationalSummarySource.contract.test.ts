import { expectTypeOf, it } from 'vitest';
import type { OperationalSummaryReport } from '../operationalSummary';
it('declares exactly the provenance values emitted by the future demand producer', () => {
 expectTypeOf<OperationalSummaryReport['inventory']['futureDemand']['source']>().toEqualTypeOf<'state_agenda_itens' | 'state_agenda_itens + ops_sanitario_agenda_v2'>();
});
