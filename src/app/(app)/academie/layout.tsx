import { SectionNav } from "@/components/app-shell/section-nav";

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
  return (
    <div>
      <SectionNav items={TABS} />
      {children}
    </div>
  );
}
