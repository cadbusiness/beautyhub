import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { processAllBirthdayBonuses } from "@/lib/institut/loyalty-birthday";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV === "development";
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** POST — crédite les bonus anniversaire (cron quotidien). */
export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const results = await processAllBirthdayBonuses(supabase);
  const credited = results.reduce((s, r) => s + r.credited, 0);
  const skipped = results.reduce((s, r) => s + r.skipped, 0);

  return NextResponse.json({ ok: true, tenants: results.length, credited, skipped });
}
