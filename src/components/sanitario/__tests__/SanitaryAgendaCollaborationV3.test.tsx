// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { db, LOCAL_OWNERSHIP_KEY } from "@/lib/offline/db";
import { SanitaryAgendaCollaborationV3 } from "../SanitaryAgendaCollaborationV3";
import { setSanitarioV2PushEnabled } from "@/lib/offline/sanitarioV2Cutover";
const state = vi.hoisted(() => ({
  farm: "11111111-1111-4111-8111-111111111111",
  user: "22222222-2222-4222-8222-222222222222",
  role: "owner",
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    activeFarmId: state.farm,
    user: { id: state.user },
    role: state.role,
  }),
}));
vi.mock("@/lib/offline/localReadBoundary", () => ({
  getCurrentLocalReadOwnership: async () => ({
    status: "OWNED",
    currentUserId: state.user,
  }),
}));
vi.mock("@/lib/sanitario/agenda/sanitaryPlanningSyncV2", () => ({
  readSanitaryPlanningSyncContextV2: () => ({
    clientId: "device",
    projectRef: "local",
  }),
}));
const agenda = "33333333-3333-4333-8333-333333333333";
const tables = [
  db.ops_sanitario_agenda_v2,
  db.ops_sanitario_agenda_animais_v2,
  db.ops_sanitario_participacoes,
  db.ops_sanitario_participacao_operacoes,
  db.ops_sanitario_agenda_resultados,
  db.ops_sanitario_continuidade_solicitacoes,
  db.event_eventos,
  db.queue_ops,
  db.queue_gestures,
  db.local_sanitario_participacoes,
  db.local_ownership,
  db.sync_sanitario_v2_cutovers,
];
beforeEach(async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:56421");
  vi.stubEnv("VITE_BACKEND_ENV", "development");
  state.role = "owner";
  await db.open();
  for (const table of tables) await table.clear();
  await db.local_ownership.put({
    key: LOCAL_OWNERSHIP_KEY,
    owner_user_id: state.user,
  });
  await db.ops_sanitario_agenda_v2.put({
    id: agenda,
    fazenda_id: state.farm,
    status: "programada",
  } as never);
  await db.sync_sanitario_v2_cutovers.put({
    key: `${state.farm}:3`,
    fazenda_id: state.farm,
    contract_version: 3,
    status: "APPLIED",
  } as never);
  setSanitarioV2PushEnabled(true, "local");
});
afterEach(async () => {
  cleanup();
  for (const table of tables) await table.clear();
  setSanitarioV2PushEnabled(false, "local");
  vi.unstubAllEnvs();
});
it("consultation does not enroll; explicit start queues a stable participation without claiming remote success", async () => {
  render(
    <SanitaryAgendaCollaborationV3 agendaId={agenda} fazendaId={state.farm} />,
  );
  const button = await screen.findByRole("button", {
    name: "Iniciar participação",
  });
  expect(await db.local_sanitario_participacoes.count()).toBe(0);
  fireEvent.click(button);
  await waitFor(async () => expect(await db.queue_ops.count()).toBe(1));
  expect(
    await screen.findByText(
      "Salvo localmente · pendente de confirmação do servidor.",
    ),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Concluir minha atuação" }),
  ).toBeTruthy();
});
it("cowboy can conclude but cannot prepare closure or resolve evidence", async () => {
  state.role = "cowboy";
  render(
    <SanitaryAgendaCollaborationV3 agendaId={agenda} fazendaId={state.farm} />,
  );
  await screen.findByRole("button", { name: "Iniciar participação" });
  expect(
    screen.queryByRole("button", { name: "Preparar fechamento gerencial" }),
  ).toBeNull();
  expect(screen.queryByLabelText("Justificativa da decisão")).toBeNull();
});
it("pull exposes reconciled per-animal result; late evidence offers legitimate additional application", async () => {
  await db.ops_sanitario_participacao_operacoes.put({
    id: crypto.randomUUID(),
    fazenda_id: state.farm,
    agenda_id: agenda,
    participation_id: crypto.randomUUID(),
    sequence: 1,
    outcome: "late",
    evento_id: null,
    declaration: {},
    resolution: null,
  });
  render(
    <SanitaryAgendaCollaborationV3 agendaId={agenda} fazendaId={state.farm} />,
  );
  expect(
    await screen.findByRole("button", {
      name: "Reconhecer aplicação adicional",
    }),
  ).toBeTruthy();
  await db.ops_sanitario_agenda_resultados.put({
    id: crypto.randomUUID(),
    fazenda_id: state.farm,
    agenda_id: agenda,
    revision: 2,
    previous_result_id: null,
    snapshot: { animals: [], events: [] },
  });
  expect(
    await screen.findByText(/Resultado confirmado · revisão 2/),
  ).toBeTruthy();
});
it("preserves access to explicit completion of an original received segment on the same device", async () => {
  const segment = crypto.randomUUID();
  await db.ops_sanitario_participacoes.put({
    id: segment,
    fazenda_id: state.farm,
    agenda_id: agenda,
    actor_user_id: state.user,
    client_id: "device",
    final_sequence: null,
    created_at: "2026-10-30",
    updated_at: "2026-10-30",
  });
  render(
    <SanitaryAgendaCollaborationV3 agendaId={agenda} fazendaId={state.farm} />,
  );
  const sequence = await screen.findByLabelText(`Sequência final ${segment}`);
  fireEvent.change(sequence, { target: { value: "1" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Concluir participação anterior" }),
  );
  await waitFor(async () =>
    expect((await db.queue_ops.toArray())[0]?.record.payload).toMatchObject({
      participation_id: segment,
      final_sequence: 1,
    }),
  );
});
