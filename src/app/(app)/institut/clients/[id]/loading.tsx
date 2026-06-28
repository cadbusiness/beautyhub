import { ListPanel } from "@/components/ui/list-panel";

export default function ClientDetailLoading() {
  return (
    <ListPanel>
      <div className="animate-pulse border-b border-slate-200 px-4 py-4 lg:px-6">
        <div className="h-3 w-24 rounded bg-slate-200" />
        <div className="mt-3 h-6 w-48 rounded bg-slate-200" />
        <div className="mt-2 h-4 w-36 rounded bg-slate-100" />
      </div>
      <div className="flex gap-4 border-b border-slate-200 px-4 py-3 lg:px-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 w-20 rounded bg-slate-100" />
        ))}
      </div>
      <div className="animate-pulse space-y-4 px-4 py-5 lg:px-6">
        <div className="grid grid-cols-2 gap-px border border-slate-200 bg-slate-200 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-white" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-48 rounded bg-slate-100" />
          <div className="h-48 rounded bg-slate-100" />
        </div>
      </div>
    </ListPanel>
  );
}
