import { cn } from "@/lib/utils";

/** Pleine largeur du contenu principal — bord à bord, sans carte inset. */
export function ListPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "-mx-4 flex min-h-0 flex-1 flex-col bg-white lg:-mx-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ListPanelFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-auto border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400 lg:px-6">
      {children}
    </div>
  );
}
