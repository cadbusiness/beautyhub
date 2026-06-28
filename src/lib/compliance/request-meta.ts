import { headers } from "next/headers";

export async function getRequestMeta(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return {
    ipAddress: forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent"),
  };
}
