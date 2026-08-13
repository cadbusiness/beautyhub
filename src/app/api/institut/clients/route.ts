import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  CLIENTS_LIST_PAGE_SIZE,
  fetchClientsListPage,
  type ClientsListFilter,
} from "@/lib/institut/clients";

const FILTERS: ClientsListFilter[] = [
  "all",
  "upcoming",
  "withAccount",
  "ecommerce",
  "withPurchases",
  "imported",
];

function parseFilter(value: string | null): ClientsListFilter {
  if (value && FILTERS.includes(value as ClientsListFilter)) {
    return value as ClientsListFilter;
  }
  return "all";
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(
    params.get("pageSize") ?? String(CLIENTS_LIST_PAGE_SIZE),
    10,
  );
  const query = params.get("q") ?? "";
  const filter = parseFilter(params.get("filter"));

  try {
    const session = await requireModule("institut");
    const supabase = await createClient();
    const result = await fetchClientsListPage(supabase, session.tenant.id, {
      page: Number.isFinite(page) ? page : 1,
      pageSize: Number.isFinite(pageSize) ? Math.min(pageSize, 50) : CLIENTS_LIST_PAGE_SIZE,
      query,
      filter,
    });
    return NextResponse.json(result);
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("[institut-clients-list]", error);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
