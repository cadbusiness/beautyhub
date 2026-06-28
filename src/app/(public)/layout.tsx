import { redirect } from "next/navigation";
import { getPublicSiteTenant } from "@/lib/tenant/public-site";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getPublicSiteTenant();
  if (!tenant) redirect("/");

  return <>{children}</>;
}
