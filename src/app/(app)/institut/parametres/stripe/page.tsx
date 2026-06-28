import { redirect } from "next/navigation";
import { COMPTE_INSTITUT_STRIPE } from "@/lib/auth/institut-settings";

export default async function LegacyParametresStripePage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>;
}) {
  const params = await searchParams;
  const query = params.stripe ? `?stripe=${encodeURIComponent(params.stripe)}` : "";
  redirect(`${COMPTE_INSTITUT_STRIPE}${query}`);
}
