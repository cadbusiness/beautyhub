"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { updateSupportTicket, type SupportStatus } from "@/lib/platform/support";

export interface SupportActionResult {
  error?: string;
  ok?: boolean;
}

export async function updateTicketStatus(
  _prev: SupportActionResult,
  formData: FormData,
): Promise<SupportActionResult> {
  await requirePlatformAdmin();

  const id = String(formData.get("ticket_id") ?? "");
  const status = String(formData.get("status") ?? "") as SupportStatus;
  const adminNotes = String(formData.get("admin_notes") ?? "").trim() || null;

  if (!id) return { error: "Ticket manquant." };

  const result = await updateSupportTicket({ id, status, adminNotes });
  if (result.error) return { error: result.error };

  revalidatePath("/admin/support");
  return { ok: true };
}
