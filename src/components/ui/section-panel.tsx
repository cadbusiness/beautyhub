import { Suspense, type ReactNode } from "react";
import { ListPanel } from "@/components/ui/list-panel";
import { PageTabLinks, type PageTabLinkItem } from "@/components/ui/page-tabs";

function TabLinksFallback() {
  return <div className="h-[45px] border-b border-slate-200" aria-hidden />;
}

export function SectionPanel({
  tabs,
  children,
}: {
  tabs: PageTabLinkItem[];
  children: ReactNode;
}) {
  return (
    <ListPanel>
      <Suspense fallback={<TabLinksFallback />}>
        <PageTabLinks items={tabs} />
      </Suspense>
      {children}
    </ListPanel>
  );
}
