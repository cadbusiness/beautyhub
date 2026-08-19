import { NextResponse } from "next/server";
import { requireInstitutApi } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import {
  CLIENTS_LIST_PAGE_SIZE,
  fetchClientsListPage,
  type ClientsListFilter,
} from "@/lib/institut/clients";

export const runtime = "nodejs";

const FILTERS: ClientsListFilter[] = [
  "all",
  "upcoming",
  "withAccount",
  "ecommerce",
  "withPurchases",
  "imported",
  "source_rovercash",
  "source_woo",
  "source_manual",
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
    const session = await requireInstitutApi(request);
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
    return NextResponse.json(
      {
        items: [],
        page: 1,
        pageSize: CLIENTS_LIST_PAGE_SIZE,
        total: 0,
        totalPages: 1,
        error: error instanceof Error ? error.message : "load_failed",
      },
      { status: 200 },
    );
  }
}
