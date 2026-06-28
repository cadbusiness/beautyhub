import { requireModule } from "@/lib/auth/guards";

/** Aperçu site web : auth requise, sans shell back-office (sidebar, header, assistant). */
export default async function SitePreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireModule("institut");
  return <div className="min-h-dvh bg-white">{children}</div>;
}
