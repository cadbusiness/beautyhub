import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <LoginForm
        setupRequired={!isSupabaseConfigured()}
        showTestAccounts={process.env.NEXT_PUBLIC_SHOW_TEST_ACCOUNTS === "true"}
      />
    </main>
  );
}
