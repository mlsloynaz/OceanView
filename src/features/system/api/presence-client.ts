import { apiFetch, errorMessageFromBody, readResponseBody } from "@/shared/api/api-fetch";

export type ConnectedUser = {
  username: string;
  lastSeenAt: string;
};

export type ConnectedUsersResponse = {
  connectedCount: number;
  windowSeconds: number;
  users: ConnectedUser[];
};

export async function postPresenceHeartbeat(): Promise<void> {
  const response = await apiFetch("/system/presence", { method: "POST" });
  if (!response.ok) {
    const body = await readResponseBody(response);
    throw new Error(errorMessageFromBody(body, "Presence heartbeat failed"));
  }
}

export async function getConnectedUsers(): Promise<ConnectedUsersResponse> {
  const response = await apiFetch("/system/presence");
  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(errorMessageFromBody(body, "Could not load connected users"));
  }
  const payload = (body ?? {}) as Partial<ConnectedUsersResponse>;
  const users = Array.isArray(payload.users) ? payload.users : [];
  return {
    connectedCount: Number(payload.connectedCount ?? users.length) || 0,
    windowSeconds: Number(payload.windowSeconds ?? 180) || 180,
    users: users
      .map((user) => ({
        username: String(user.username ?? "").trim(),
        lastSeenAt: String(user.lastSeenAt ?? ""),
      }))
      .filter((user) => user.username),
  };
}
