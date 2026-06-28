export function ListToolbar({
  children,
  action,
  meta,
  trailing,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  /** Compteur ou méta discret affiché à gauche (ex. « 3 prestations »). */
  meta?: React.ReactNode;
  /** Contrôles secondaires à droite, avant l'action principale (ex. pagination). */
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        {meta ? (
          <span className="shrink-0 text-xs tabular-nums text-slate-400">{meta}</span>
        ) : null}
        {children}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        {action}
      </div>
    </div>
  );
}
