import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export type PlatformTeamRow = {
  membershipId: string;
  userId: string;
  email: string;
  createdAt: string;
};

export async function fetchPlatformTeamRows(): Promise<PlatformTeamRow[]> {
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("memberships")
    .select("id, user_id, created_at")
    .eq("role", "platform_admin")
    .order("created_at", { ascending: true });

  if (!memberships?.length) return [];

  const service = createServiceClient();
  const { data: usersData } = await service.auth.admin.listUsers({ perPage: 1000 });
  const emailByUserId = new Map(
    (usersData?.users ?? []).map((u) => [u.id, u.email ?? u.id]),
  );

  return memberships.map((m) => ({
    membershipId: m.id,
    userId: m.user_id,
    email: emailByUserId.get(m.user_id) ?? m.user_id,
    createdAt: m.created_at,
  }));
}
