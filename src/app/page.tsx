import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentUser } from "@/lib/auth/session";
import { LandingPage } from "@/components/marketing/landing-page";

export default async function Home() {
  if (isSupabaseConfigured()) {
    const user = await getCurrentUser();
    if (user) redirect("/dashboard");
  }

  return <LandingPage />;
}
