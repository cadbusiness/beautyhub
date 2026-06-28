import { SectionPanel } from "@/components/ui/section-panel";

const TABS = [
  { label: "Vue d'ensemble", href: "/academie", exact: true },
  { label: "Formations", href: "/academie/formations" },
  { label: "Eleves", href: "/academie/eleves" },
];

export default function AcademieLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SectionPanel tabs={TABS}>{children}</SectionPanel>;
}
