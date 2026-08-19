import { NextResponse } from "next/server";
import { requireInstitutApi } from "@/lib/auth/guards";
import {
  disableBooklySync,
  enableBooklySync,
  getBooklySyncStatus,
  rotateBooklySync,
} from "@/lib/institut/appointment-import/bookly-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireInstitutApi(request);
    const status = await getBooklySyncStatus(session.tenant.id);
    return NextResponse.json(status);
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "load_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireInstitutApi(request);
    let body: { action?: string } = {};
    try {
      body = (await request.json()) as { action?: string };
    } catch {
      body = {};
    }
    const action = body.action ?? "enable";
    if (action === "disable") {
      return NextResponse.json(await disableBooklySync(session.tenant.id));
    }
    if (action === "rotate") {
      return NextResponse.json(await rotateBooklySync(session.tenant.id));
    }
    return NextResponse.json(await enableBooklySync(session.tenant.id));
  } catch (error) {
    const digest =
      typeof error === "object" && error !== null && "digest" in error
        ? String((error as { digest?: string }).digest ?? "")
        : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "sync_config_failed" },
      { status: 500 },
    );
  }
}
