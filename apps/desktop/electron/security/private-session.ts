import type { Session } from "electron";

// Destroy web contents before clearing their ephemeral partition.
export async function clearPrivateSession(session: Session): Promise<void> {
  await session.clearData();
  await session.clearCache();
  await session.clearAuthCache();
  await session.clearHostResolverCache();
}
