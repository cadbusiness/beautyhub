export function ListToolbar({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <div className="flex flex-1 flex-col gap-2 sm:flex-row">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
