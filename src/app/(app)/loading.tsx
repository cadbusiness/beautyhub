export default function AppLoading() {
  return (
    <div className="flex min-h-dvh animate-pulse flex-col bg-slate-50">
      <div className="flex h-14 items-center gap-4 border-b border-slate-200 bg-white px-4 lg:px-6">
        <div className="h-8 w-8 rounded-lg bg-slate-200" />
        <div className="h-4 w-24 rounded bg-slate-200" />
        <div className="flex-1" />
        <div className="h-9 w-28 rounded-lg bg-slate-200" />
      </div>
      <div className="flex flex-1">
        <aside className="hidden w-52 shrink-0 border-r border-slate-200 bg-white p-3 sm:block lg:w-56">
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-slate-100" />
            ))}
          </div>
        </aside>
        <main className="flex-1 px-4 py-4 lg:px-6 lg:py-5">
          <div className="mb-6 h-8 w-48 rounded-lg bg-slate-200" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-48 rounded-xl bg-white ring-1 ring-slate-200" />
            <div className="h-48 rounded-xl bg-white ring-1 ring-slate-200" />
          </div>
        </main>
      </div>
    </div>
  );
}
