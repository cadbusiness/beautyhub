export default function AppLoading() {
  return (
    <div className="flex min-h-dvh animate-pulse bg-slate-50">
      <aside className="hidden w-52 shrink-0 border-r border-slate-200 bg-white px-3 py-4 sm:block lg:w-56">
        <div className="mb-4 h-9 rounded-lg bg-slate-100" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-slate-100" />
          ))}
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-4 lg:px-6 lg:py-5">
        <div className="mb-6 h-8 w-48 rounded-lg bg-slate-200" />
        <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-white shadow-sm ring-1 ring-slate-200" />
            ))}
          </div>
          <div className="h-72 rounded-xl bg-white shadow-sm ring-1 ring-slate-200" />
        </div>
      </main>
    </div>
  );
}
