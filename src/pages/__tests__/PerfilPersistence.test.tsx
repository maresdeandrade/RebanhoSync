/** @vitest-environment jsdom */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { Perfil } from '@/pages/Perfil';

const state = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  error: null as unknown, loadError: null as unknown, zero: false,
  writes: [] as Record<string, unknown>[], toast: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ refreshSettings: vi.fn(), farmExperienceMode: 'completo' }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: state.toast }) }));
vi.mock('@/lib/supabase', () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'own-id', email: 'auth@example.test' } }, error: null }) },
  from: (table: string) => {
    let payload: Record<string, unknown> | undefined;
    let operation = 'read';
    const resolve = () => {
      if (operation === 'read') return { data: table === 'user_profiles' ? state.profile : {theme:'system',notifications:{}}, error: state.loadError };
      state.writes.push(payload!);
      if (state.error || state.zero) return { data: null, error: state.error };
      if (table === 'user_profiles' && operation === 'upsert') state.profile = { user_id:'own-id', ...payload };
      return { data: operation === 'upsert' ? state.profile : null, error: null };
    };
    const query = {
      select: () => query, eq: () => query,
      single: async () => resolve(), maybeSingle: async () => resolve(),
      update: (value: Record<string,unknown>) => {operation='update';payload=value;return query;},
      upsert: (value: Record<string,unknown>) => {operation='upsert';payload=value;return query;},
      then: (fn: (v: unknown)=>unknown) => Promise.resolve(resolve()).then(fn),
    };
    return query;
  },
} }));
beforeEach(() => {state.profile=null;state.error=null;state.loadError=null;state.zero=false;state.writes=[];state.toast.mockClear();});
const open = () => {
  const router = createMemoryRouter(
    [{ path: '*', element: <Perfil /> }],
    { initialEntries: ['/perfil'], future: { v7_startTransition: true } },
  );
  return render(<RouterProvider router={router} />);
};
async function save() {
  fireEvent.change(await screen.findByLabelText('Nome de exibicao'),{target:{value:'Nome persistido'}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar perfil'}));
}
it('creates absent complementary profile, then loads it on a new mount',async()=>{
  const view=open();await save();
  await waitFor(()=>expect(state.profile?.display_name).toBe('Nome persistido'));
  expect(state.writes[0].user_id).toBe('own-id');
  view.unmount();open();expect(await screen.findByLabelText('Nome de exibicao')).toHaveValue('Nome persistido');
  expect(screen.getByLabelText('E-mail')).toHaveValue('auth@example.test');
});
it('updates an existing profile preserving other profile fields',async()=>{
  state.profile={user_id:'own-id',display_name:'Antes',locale:'pt-BR'};open();await save();
  await waitFor(()=>expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({title:'Sucesso'})));
  expect(state.writes[0]).not.toHaveProperty('locale');
});
it.each([{message:'Falha de rede estruturada'},new Error('Rede indisponível')])('preserves draft and reports save failure %j',async(error)=>{
  open();state.error=error;await save();
  await waitFor(()=>expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({variant:'destructive',description:error.message})));
  expect(screen.getByLabelText('Nome de exibicao')).toHaveValue('Nome persistido');
  expect(state.toast).not.toHaveBeenCalledWith(expect.objectContaining({title:'Sucesso'}));
});
it('does not report success for a write without a returned row',async()=>{
  open();state.zero=true;await save();
  await waitFor(()=>expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({variant:'destructive'})));
  expect(state.toast).not.toHaveBeenCalledWith(expect.objectContaining({title:'Sucesso'}));
});
it('distinguishes failed loading from an absent profile',async()=>{
  state.loadError={message:'Consulta indisponível'};open();
  await waitFor(()=>expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({title:'Erro ao carregar perfil'})));
  expect(screen.getByRole('button',{name:'Salvar perfil'})).toBeDisabled();
});
it.each([['','06:00'],['22:00',''],['06:00','06:00']])('rejects invalid enabled quiet hours %s–%s before writing',async(start,end)=>{
  open();await screen.findByLabelText('Nome de exibicao');
  fireEvent.mouseDown(screen.getByRole('tab',{name:/Preferencias/}));
  fireEvent.click(screen.getByRole('tab',{name:/Preferencias/}));
  const startInput=await screen.findByLabelText('Inicio');
  // Switch labelled by its surrounding section in the existing UI.
  const quietSwitch=screen.getByText('Horario de silencio').parentElement!.parentElement!.querySelector('[role="switch"]')!;
  fireEvent.click(quietSwitch);
  fireEvent.change(startInput,{target:{value:start}});fireEvent.change(screen.getByLabelText('Fim'),{target:{value:end}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar preferencias'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent(/hor.rio|in.cio|fim/i));
  expect(state.writes).toHaveLength(0);
});
