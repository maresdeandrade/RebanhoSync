/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {it,expect,vi} from 'vitest';
import CriarFazenda from '@/pages/CriarFazenda';
const rpc=vi.hoisted(()=>vi.fn(async(name:string)=>name==='can_create_farm'?{data:true,error:null}:{data:null,error:{message:'constraint fazendas_area_total_ha_check'}}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:{id:'own'},setActiveFarm:vi.fn()})}));
vi.mock('@/lib/supabase',()=>({supabase:{rpc}}));
it('identifica erro do nome obrigatório junto ao campo e não chama o RPC',async()=>{
  render(<MemoryRouter><CriarFazenda /></MemoryRouter>);
  const nome=await screen.findByLabelText(/Nome da fazenda/i);
  fireEvent.submit(nome.closest('form')!);
  const error=await screen.findByRole('alert');
  expect(error).toHaveTextContent(/Nome é obrigatório/i);
  expect(nome).toHaveAttribute('aria-invalid','true');
  expect(nome).toHaveAttribute('aria-describedby','nome-error');
  expect(rpc).not.toHaveBeenCalledWith('create_fazenda',expect.anything());
});
it.each(['-10','0'])('rejeita área %s junto ao campo antes do RPC',async(value)=>{
  render(<MemoryRouter><CriarFazenda /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText(/Nome da fazenda/i),{target:{value:'Fixture'}});
  fireEvent.change(screen.getByLabelText(/Area total/i),{target:{value}});
  fireEvent.submit(screen.getByLabelText(/Area total/i).closest('form')!);
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent(/maior que zero/i));
  expect(rpc).not.toHaveBeenCalledWith('create_fazenda',expect.anything());
});
