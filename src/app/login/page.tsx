import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <LoginForm setupRequired={!isSupabaseConfigured()} />
    </main>
  );
}
