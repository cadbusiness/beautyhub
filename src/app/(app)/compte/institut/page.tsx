import { redirect } from "next/navigation";
import { COMPTE_INSTITUT_WOO } from "@/lib/auth/institut-settings";

export default function CompteInstitutPage() {
  redirect(COMPTE_INSTITUT_WOO);
}
