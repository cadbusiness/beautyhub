export function ListToolbar({
  children,
  action,
  trailing,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  /** Contrôles secondaires à droite, avant l'action principale (ex. pagination). */
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">{children}</div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        {action}
      </div>
    </div>
  );
}
