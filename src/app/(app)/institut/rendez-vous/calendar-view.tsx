"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { updateAppointmentDetails, type ActionResult } from "../actions";

const STATUS: Record<string, string> = {
 booked: "Reserve",
 confirmed: "Confirme",
 completed: "Termine",
 cancelled: "Annule",
 no_show: "Absent",
};

const HOUR_START = 8;
const HOUR_END = 20;
const SLOT_PX = 48;

export interface CalendarAppointment {
 id: string;
 starts_at: string;
 ends_at: string;
 status: string;
 notes: string | null;
 price_cents: number | null;
 staff_id: string | null;
 resource_id: string | null;
 service: { name?: string; color?: string | null } | null;
 staff: { full_name?: string; color?: string | null } | null;
 client: { full_name?: string | null; email?: string } | null;
 resource: { name?: string } | null;
}

interface Column {
 id: string;
 label: string;
 color?: string | null;
}

function startOfWeek(d: Date): Date {
 const x = new Date(d);
 const day = x.getDay();
 const diff = day === 0 ? -6 : 1 - day;
 x.setDate(x.getDate() + diff);
 x.setHours(0, 0, 0, 0);
 return x;
}

function addDays(d: Date, n: number): Date {
 const x = new Date(d);
 x.setDate(x.getDate() + n);
 return x;
}

function minutesFromMidnight(iso: string): number {
 const d = new Date(iso);
 return d.getHours() * 60 + d.getMinutes();
}

function apptStyle(startsAt: string, endsAt: string): { top: number; height: number } {
 const start = minutesFromMidnight(startsAt);
 const end = minutesFromMidnight(endsAt);
 const gridStart = HOUR_START * 60;
 const top = ((start - gridStart) / 60) * SLOT_PX;
 const height = Math.max(((end - start) / 60) * SLOT_PX, 20);
 return { top, height };
}

export function CalendarView({
 appointments,
 staffColumns,
 resourceColumns,
 initialDate,
}: {
 appointments: CalendarAppointment[];
 staffColumns: Column[];
 resourceColumns: Column[];
 initialDate: string;
}) {
 const [mode, setMode] = useState<"week_staff" | "day_resource">("week_staff");
 const [anchor, setAnchor] = useState(() => new Date(initialDate));
 const [selected, setSelected] = useState<CalendarAppointment | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [pending, startTransition] = useTransition();

 const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
 const dayDate = useMemo(() => {
 const d = new Date(anchor);
 d.setHours(0, 0, 0, 0);
 return d;
 }, [anchor]);

 const columns = mode === "week_staff" ? staffColumns : resourceColumns;
 const rangeStart = mode === "week_staff" ? weekStart : dayDate;
 const rangeEnd = mode === "week_staff" ? addDays(weekStart, 7) : addDays(dayDate, 1);

 const filtered = useMemo(
 () =>
 appointments.filter((a) => {
 const t = new Date(a.starts_at).getTime();
 return t >= rangeStart.getTime() && t < rangeEnd.getTime();
 }),
 [appointments, rangeStart, rangeEnd],
 );

 const hours = useMemo(() => {
 const h: number[] = [];
 for (let i = HOUR_START; i < HOUR_END; i++) h.push(i);
 return h;
 }, []);

 function nav(delta: number) {
 setAnchor((prev) => {
 const n = new Date(prev);
 n.setDate(n.getDate() + (mode === "week_staff" ? delta * 7 : delta));
 return n;
 });
 }

 function apptsForColumn(colId: string) {
 return filtered.filter((a) =>
 mode === "week_staff" ? a.staff_id === colId : a.resource_id === colId,
 );
 }

 return (
 <div className="space-y-4">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div className="flex gap-2">
 <Button
 type="button"
 variant={mode === "week_staff" ? "primary" : "outline"}
 onClick={() => setMode("week_staff")}
 >
 Semaine / praticiens
 </Button>
 <Button
 type="button"
 variant={mode === "day_resource" ? "primary" : "outline"}
 onClick={() => setMode("day_resource")}
 >
 Jour / cabines
 </Button>
 </div>
 <div className="flex items-center gap-2">
 <Button type="button" variant="outline" onClick={() => nav(-1)}>
 ←
 </Button>
 <span className="min-w-40 text-center text-sm text-slate-600">
 {mode === "week_staff"
 ? `Semaine du ${weekStart.toLocaleDateString("fr-FR")}`
 : dayDate.toLocaleDateString("fr-FR", {
 weekday: "long",
 day: "numeric",
 month: "long",
 })}
 </span>
 <Button type="button" variant="outline" onClick={() => nav(1)}>
 →
 </Button>
 </div>
 </div>

 {error ? <p className="text-sm text-red-600">{error}</p> : null}
 {pending ? <p className="text-sm text-slate-500">Mise a jour...</p> : null}

 {columns.length === 0 ? (
 <Card>
 <p className="text-sm text-slate-500">
 {mode === "week_staff"
 ? "Ajoute du personnel dans Equipe pour afficher le calendrier."
 : "Ajoute des cabines dans Equipe pour afficher le calendrier."}
 </p>
 </Card>
 ) : (
 <div className="overflow-x-auto rounded-xl border border-slate-200">
 <div
 className="grid min-w-max"
 style={{
 gridTemplateColumns: `64px repeat(${columns.length}, minmax(140px, 1fr))`,
 }}
 >
 <div className="border-b border-r border-slate-200 bg-slate-50 p-2" />
 {columns.map((c) => (
 <div
 key={c.id}
 className="border-b border-r border-slate-200 bg-slate-50 p-2 text-center text-sm font-medium"
 >
 <span
 className="mr-1 inline-block h-2 w-2 rounded-full"
 style={{ backgroundColor: c.color ?? "#64748b" }}
 />
 {c.label}
 </div>
 ))}

 <div className="relative border-r border-slate-200">
 {hours.map((h) => (
 <div
 key={h}
 className="border-b border-slate-100 pr-2 text-right text-xs text-slate-400"
 style={{ height: SLOT_PX }}
 >
 {String(h).padStart(2, "0")}:00
 </div>
 ))}
 </div>

 {columns.map((col) => (
 <div
 key={col.id}
 className="relative border-r border-slate-200"
 style={{ height: (HOUR_END - HOUR_START) * SLOT_PX }}
 >
 {hours.map((h) => (
 <div
 key={h}
 className="border-b border-slate-100"
 style={{ height: SLOT_PX }}
 />
 ))}
 {apptsForColumn(col.id).map((a) => {
 const { top, height } = apptStyle(a.starts_at, a.ends_at);
 const bg = a.service?.color ?? a.staff?.color ?? "#64748b";
 return (
 <button
 key={a.id}
 type="button"
 onClick={() => setSelected(a)}
 className="absolute left-1 right-1 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-xs text-slate-900 shadow-sm"
 style={{
 top,
 height,
 backgroundColor: bg,
 opacity: a.status === "cancelled" ? 0.4 : 1,
 }}
 >
 <p className="truncate font-medium">{a.service?.name ?? "RDV"}</p>
 <p className="truncate opacity-90">
 {a.client?.full_name ?? a.client?.email ?? "—"}
 </p>
 </button>
 );
 })}
 </div>
 ))}
 </div>
 </div>
 )}

 {selected ? (
 <AppointmentDetailPanel appt={selected} onClose={() => setSelected(null)} />
 ) : null}
 </div>
 );
}

function AppointmentDetailPanel({
 appt,
 onClose,
}: {
 appt: CalendarAppointment;
 onClose: () => void;
}) {
 const [state, setState] = useState<ActionResult>({});
 const [pending, startTransition] = useTransition();

 function saveDetails(formData: FormData) {
 startTransition(async () => {
 const res = await updateAppointmentDetails(formData);
 setState(res);
 });
 }

 return (
 <Card className="fixed bottom-4 right-4 z-50 w-full max-w-md space-y-3 shadow-xl">
 <div className="flex items-start justify-between">
 <div>
 <h3 className="font-semibold text-slate-900">
 {appt.service?.name ?? "Rendez-vous"}
 </h3>
 <p className="text-sm text-slate-500">{formatDateTime(appt.starts_at)}</p>
 </div>
 <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
 ✕
 </button>
 </div>
 <p className="text-sm text-slate-600">
 {appt.client?.full_name ?? appt.client?.email ?? "Sans client"} ·{" "}
 {appt.staff?.full_name ?? "—"} · {STATUS[appt.status] ?? appt.status}
 </p>
 {appt.price_cents != null ? (
 <p className="text-sm text-slate-500">{formatPrice(appt.price_cents)}</p>
 ) : null}

 <form action={saveDetails} className="space-y-2">
 <input type="hidden" name="id" value={appt.id} />
 <label className="block text-xs text-slate-500">
 Statut
 <select
 name="status"
 defaultValue={appt.status}
 className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm"
 >
 {Object.entries(STATUS).map(([v, l]) => (
 <option key={v} value={v}>
 {l}
 </option>
 ))}
 </select>
 </label>
 <label className="block text-xs text-slate-500">
 Notes
 <textarea
 name="notes"
 defaultValue={appt.notes ?? ""}
 className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
 rows={2}
 />
 </label>
 {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
 {state.ok ? <p className="text-sm text-green-600">Enregistre.</p> : null}
 <Button type="submit" disabled={pending} className="w-full">
 Enregistrer
 </Button>
 </form>
 </Card>
 );
}
