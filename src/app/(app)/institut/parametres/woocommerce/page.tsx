import { redirect } from "next/navigation";
import { COMPTE_INSTITUT_WOO } from "@/lib/auth/institut-settings";

export default function LegacyParametresWooPage() {
  redirect(COMPTE_INSTITUT_WOO);
}
