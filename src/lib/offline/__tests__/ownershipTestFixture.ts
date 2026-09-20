import { db, LOCAL_OWNERSHIP_KEY } from "../db";

export async function seedLocalOwner(userId: string) {
  await db.local_ownership.put({
    key: LOCAL_OWNERSHIP_KEY,
    owner_user_id: userId,
    updated_at: new Date().toISOString(),
  });
}
