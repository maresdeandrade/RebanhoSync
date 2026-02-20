export const STORAGE_PREFIX = "gestao_agro_";
const KEY_ACTIVE_FAZENDA_ID = "active_fazenda_id";

export const getActiveFarmId = (): string | null => {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${KEY_ACTIVE_FAZENDA_ID}`);
  } catch (e) {
    return null;
  }
};

export const setActiveFarmId = (id: string): void => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${KEY_ACTIVE_FAZENDA_ID}`, id);
  } catch (e) {
    console.error("Error saving active farm ID:", e);
  }
};

export const removeActiveFarmId = (): void => {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${KEY_ACTIVE_FAZENDA_ID}`);
  } catch (e) {
    console.error("Error removing active farm ID:", e);
  }
};
