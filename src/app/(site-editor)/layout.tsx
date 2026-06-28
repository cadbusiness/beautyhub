import { requireModule } from "@/lib/auth/guards";

/** Builder / aperçu site web : auth requise, sans shell back-office. */
export default async function SiteEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("institut");
  return <div className="min-h-dvh bg-white">{children}</div>;
}
