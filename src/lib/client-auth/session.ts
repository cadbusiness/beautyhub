import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "bh_client_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 jours

export interface ClientSession {
  clientId: string;
  tenantId: string;
  email: string;
}

function secret(): string {
  const key =
    process.env.CLIENT_SESSION_SECRET ??
    process.env.CONNECTIONS_ENCRYPTION_KEY;
  if (!key) throw new Error("CLIENT_SESSION_SECRET ou CONNECTIONS_ENCRYPTION_KEY requis.");
  return key;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function setClientSession(session: ClientSession): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const body = Buffer.from(
    JSON.stringify({ ...session, exp }),
  ).toString("base64url");
  const sig = sign(body);
  const jar = await cookies();
  jar.set(COOKIE, `${body}.${sig}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function getClientSession(
  tenantId: string,
): Promise<ClientSession | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;

  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;

  const expected = sign(body);
  try {
    if (
      expected.length !== sig.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      clientId: string;
      tenantId: string;
      email: string;
      exp: number;
    };
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    if (data.tenantId !== tenantId) return null;
    return { clientId: data.clientId, tenantId: data.tenantId, email: data.email };
  } catch {
    return null;
  }
}

export async function clearClientSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
