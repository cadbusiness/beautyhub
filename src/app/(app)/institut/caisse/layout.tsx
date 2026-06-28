import { SectionPanel } from "@/components/ui/section-panel";

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
  return <SectionPanel tabs={TABS}>{children}</SectionPanel>;
}
