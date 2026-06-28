import { SectionNav } from "@/components/app-shell/section-nav";

const TABS = [
  { label: "Terminal", href: "/institut/caisse", exact: true },
  { label: "Historique", href: "/institut/caisse/historique" },
  { label: "Produits internes", href: "/institut/caisse/produits" },
];

export default function CaisseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <SectionNav items={TABS} />
      {children}
    </div>
  );
}
