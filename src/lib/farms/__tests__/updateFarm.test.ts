import {beforeEach,expect,it,vi} from 'vitest';
import {updateFarmFromSnapshot} from '@/lib/farms/updateFarm';
const mocks=vi.hoisted(()=>({from:vi.fn(),single:vi.fn()}));
vi.mock('@/lib/supabase',()=>({supabase:{from:mocks.from}}));
beforeEach(()=>{
  vi.clearAllMocks();
  const query={update:()=>query,eq:()=>query,select:()=>query,single:mocks.single};
  mocks.from.mockReturnValue(query);
});
it('rejects missing snapshot and farm switch before sending a write',async()=>{
  await expect(updateFarmFromSnapshot('farm-a',null,{})).rejects.toThrow(/Recarregue/);
  await expect(updateFarmFromSnapshot('farm-b',{farmId:'farm-a',updatedAt:'version'},{})).rejects.toThrow(/Recarregue/);
  expect(mocks.from).not.toHaveBeenCalled();
});
it.each([{data:null,error:null},{data:null,error:{code:'PGRST116',message:'zero rows'}}])('reports failed conditional write instead of success: %j',async(result)=>{
  mocks.single.mockResolvedValue(result);
  await expect(updateFarmFromSnapshot('farm',{farmId:'farm',updatedAt:'version'},{})).rejects.toThrow(/Recarregue/);
});
it('does not convert a backend failure into confirmation',async()=>{
  const error={code:'42501',message:'permission denied'};mocks.single.mockResolvedValue({data:null,error});
  await expect(updateFarmFromSnapshot('farm',{farmId:'farm',updatedAt:'version'},{})).rejects.toBe(error);
});
