import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import type { Locale } from "@/i18n/config";

export interface TeamProfile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  preferred_locale: Locale | null;
}

export const getTeamProfile = cache(async (): Promise<TeamProfile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("team_profiles")
    .select("user_id, full_name, phone, preferred_locale")
    .eq("user_id", user.id)
    .maybeSingle();

  if (data) return data as TeamProfile;

  return {
    user_id: user.id,
    full_name: null,
    phone: null,
    preferred_locale: null,
  };
});

export function profileDisplayName(
  profile: TeamProfile | null,
  email: string | null,
): string {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  if (email) return email.split("@")[0] ?? email;
  return "—";
}

export function profileInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed === "—") return "?";
  return trimmed.charAt(0).toUpperCase();
}
