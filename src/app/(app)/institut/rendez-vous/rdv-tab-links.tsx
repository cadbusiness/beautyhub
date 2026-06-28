import { getTranslations } from "next-intl/server";
import { PageTabLinks } from "@/components/ui/page-tabs";

export async function RdvTabLinks() {
  const t = await getTranslations("appointments.tabs");
  return (
    <PageTabLinks
      items={[
        { label: t("calendar"), href: "/institut/rendez-vous", exact: true },
        { label: t("list"), href: "/institut/rendez-vous?view=liste" },
        {
          label: t("bookingPublic"),
          href: "/institut/rendez-vous/reservation-publique",
        },
      ]}
    />
  );
}
