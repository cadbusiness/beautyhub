export type CalendarViewMode = "day" | "week" | "month";
export type ColumnMode = "staff" | "resource";

export interface CalendarAppointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  price_cents: number | null;
  staff_id: string | null;
  resource_id: string | null;
  service_id: string | null;
  client_id: string | null;
  service: {
    name?: string;
    color?: string | null;
    duration_min?: number;
  } | null;
  staff: { full_name?: string; color?: string | null } | null;
  client: { full_name?: string | null; email?: string; phone?: string | null } | null;
  resource: { name?: string } | null;
  extras?: {
    service_id: string;
    quantity: number;
    name: string;
    price_cents: number;
    duration_min: number;
  }[];
}

export interface CalendarColumn {
  id: string;
  label: string;
  color?: string | null;
}

export interface CalendarOption {
  id: string;
  label: string;
}

export interface WorkingHourRow {
  weekday: number;
  start_time: string;
  end_time: string;
  staff_id: string | null;
}

export const SLOT_MINUTES = 10;
export const SLOT_PX = 18;
export const HOUR_START = 8;
export const HOUR_END = 20;

export type AppointmentStatus =
  | "booked"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";
