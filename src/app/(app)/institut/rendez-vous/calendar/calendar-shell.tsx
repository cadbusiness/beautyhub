"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  cancelAppointment,
  getCalendarAppointments,
  moveAppointment,
} from "../../actions";
import { CalendarToolbar } from "./calendar-toolbar";
import { StaffFilterRow } from "./staff-filter-row";
import { DayView, WeekView } from "./week-view";
import { MonthView } from "./month-view";
import { AppointmentPopover } from "./appointment-popover";
import { AppointmentEditDialog } from "./appointment-edit-dialog";
import { FormDialog } from "@/components/ui/form-dialog";
import { AppointmentForm } from "../appointment-form";
import type {
  CalendarAppointment,
  CalendarColumn,
  CalendarOption,
  CalendarViewMode,
  ColumnMode,
} from "./types";
import { getRangeForView, startOfDay } from "./utils";

type MovePayload = {
  id: string;
  starts_at: string;
  ends_at: string;
  staff_id?: string | null;
  resource_id?: string | null;
};

export function CalendarShell({
  initialAppointments,
  staffColumns,
  resourceColumns,
  services,
  staff,
  resources,
  clients,
  initialDate,
}: {
  initialAppointments: CalendarAppointment[];
  staffColumns: CalendarColumn[];
  resourceColumns: CalendarColumn[];
  services: CalendarOption[];
  staff: CalendarOption[];
  resources: CalendarOption[];
  clients: CalendarOption[];
  initialDate: string;
}) {
  const router = useRouter();
  const tCal = useTranslations("appointments.calendar");
  const [viewMode, setViewMode] = useState<CalendarViewMode>("day");
  const [columnMode, setColumnMode] = useState<ColumnMode>("staff");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date(initialDate)));
  const [serviceFilter, setServiceFilter] = useState("");
  const [staffDropdownFilter, setStaffDropdownFilter] = useState("");
  const [staffChipFilter, setStaffChipFilter] = useState<string | null>(null);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [popover, setPopover] = useState<{
    appt: CalendarAppointment;
    rect: DOMRect;
  } | null>(null);
  const [editAppt, setEditAppt] = useState<CalendarAppointment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchPending, startFetch] = useTransition();
  const [actionPending, startAction] = useTransition();
  const skipInitialFetch = useRef(true);

  const range = useMemo(() => getRangeForView(anchor, viewMode), [anchor, viewMode]);

  const loadAppointments = useCallback(() => {
    startFetch(async () => {
      const result = await getCalendarAppointments(
        range.start.toISOString(),
        range.end.toISOString(),
      );
      if (!result.ok) {
        setError(result.error || tCal("loadError"));
        return;
      }
      setAppointments(result.appointments as CalendarAppointment[]);
      setError(null);
    });
  }, [range.end, range.start, tCal]);

  useEffect(() => {
    setAppointments(initialAppointments);
  }, [initialAppointments]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    loadAppointments();
  }, [loadAppointments]);

  const filtered = useMemo(
    () =>
      appointments.filter((a) => {
        if (serviceFilter && a.service_id !== serviceFilter) return false;
        if (staffDropdownFilter && a.staff_id !== staffDropdownFilter) return false;
        if (staffChipFilter && a.staff_id !== staffChipFilter) return false;
        return true;
      }),
    [appointments, serviceFilter, staffDropdownFilter, staffChipFilter],
  );

  const dayColumns = useMemo(() => {
    const base = columnMode === "staff" ? staffColumns : resourceColumns;
    if (staffChipFilter && columnMode === "staff") {
      return base.filter((c) => c.id === staffChipFilter);
    }
    return base;
  }, [columnMode, staffChipFilter, staffColumns, resourceColumns]);

  function handleAnchorChange(delta: number) {
    setAnchor((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }

  function handleToday() {
    setAnchor(startOfDay(new Date()));
  }

  function handleSelectDay(day: Date) {
    setAnchor(startOfDay(day));
    setViewMode("day");
  }

  function handleSelect(appt: CalendarAppointment, el: HTMLElement) {
    setPopover({ appt, rect: el.getBoundingClientRect() });
  }

  function handleMove(payload: MovePayload) {
    startAction(async () => {
      const fd = new FormData();
      fd.set("id", payload.id);
      fd.set("starts_at", payload.starts_at);
      fd.set("ends_at", payload.ends_at);
      if (payload.staff_id !== undefined) {
        fd.set("staff_id", payload.staff_id ?? "");
      }
      if (payload.resource_id !== undefined) {
        fd.set("resource_id", payload.resource_id ?? "");
      }
      const res = await moveAppointment(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setPopover(null);
      loadAppointments();
      router.refresh();
    });
  }

  function handleCancel() {
    if (!popover) return;
    const id = popover.appt.id;
    startAction(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const res = await cancelAppointment(fd);
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setPopover(null);
      loadAppointments();
      router.refresh();
    });
  }

  function handleSaved() {
    setEditAppt(null);
    setPopover(null);
    loadAppointments();
    router.refresh();
  }

  const showStaffChips = viewMode === "day" && columnMode === "staff";

  return (
    <div className="flex flex-col">
      <CalendarToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        columnMode={columnMode}
        onColumnModeChange={setColumnMode}
        anchor={anchor}
        onAnchorChange={handleAnchorChange}
        onToday={handleToday}
        onRefresh={loadAppointments}
        serviceFilter={serviceFilter}
        onServiceFilterChange={setServiceFilter}
        staffFilter={staffDropdownFilter}
        onStaffFilterChange={setStaffDropdownFilter}
        services={services}
        staff={staff}
        refreshing={fetchPending}
        onNewAppointment={() => setCreateOpen(true)}
      />

      {showStaffChips ? (
        <StaffFilterRow
          staff={staffColumns}
          selectedStaffId={staffChipFilter}
          onSelect={setStaffChipFilter}
        />
      ) : null}

      {error ? (
        <p className="border-b border-slate-200 px-4 py-2 text-sm text-red-600 lg:px-6">
          {error}
        </p>
      ) : null}

      {viewMode === "day" ? (
        <DayView
          anchor={anchor}
          columnMode={columnMode}
          columns={dayColumns}
          appointments={filtered}
          onSelect={handleSelect}
          onMove={handleMove}
          movePending={actionPending}
        />
      ) : null}

      {viewMode === "week" ? (
        <WeekView
          anchor={anchor}
          appointments={filtered}
          onSelect={handleSelect}
          onMove={handleMove}
          movePending={actionPending}
        />
      ) : null}

      {viewMode === "month" ? (
        <MonthView anchor={anchor} appointments={filtered} onSelectDay={handleSelectDay} />
      ) : null}

      {popover ? (
        <AppointmentPopover
          appt={popover.appt}
          anchorRect={popover.rect}
          onClose={() => setPopover(null)}
          onEdit={() => {
            setEditAppt(popover.appt);
            setPopover(null);
          }}
          onCancel={handleCancel}
          pending={actionPending}
        />
      ) : null}

      <AppointmentEditDialog
        open={Boolean(editAppt)}
        appointment={editAppt}
        clients={clients}
        services={services}
        staff={staff}
        resources={resources}
        onClose={() => setEditAppt(null)}
        onSaved={handleSaved}
      />

      <FormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={tCal("dialogTitle")}
        size="lg"
      >
        <AppointmentForm
          clients={clients}
          services={services}
          staff={staff}
          resources={resources}
          onSuccess={() => {
            setCreateOpen(false);
            loadAppointments();
            router.refresh();
          }}
        />
      </FormDialog>
    </div>
  );
}
