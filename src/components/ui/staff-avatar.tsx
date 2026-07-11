"use client";

import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_STAFF_COLOR = "#64748b";

type StaffAvatarSize = "sm" | "md" | "lg";

const sizeClassByVariant: Record<StaffAvatarSize, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-[11px]",
  lg: "h-16 w-16 text-lg",
};

const iconClassByVariant: Record<StaffAvatarSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-7 w-7",
};

export function getStaffInitials(name: string | null | undefined): string {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function StaffAvatar({
  name,
  color,
  imageUrl,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  color?: string | null;
  imageUrl?: string | null;
  size?: StaffAvatarSize;
  className?: string;
}) {
  const initials = getStaffInitials(name);

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className={cn(
          "inline-block rounded-full border border-slate-200 object-cover",
          sizeClassByVariant[size],
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded-full border border-slate-200 font-semibold tracking-wide text-white",
        sizeClassByVariant[size],
        className,
      )}
      style={{ backgroundColor: color ?? DEFAULT_STAFF_COLOR }}
      aria-hidden
    >
      {initials ? <span>{initials}</span> : <UserRound className={cn(iconClassByVariant[size], "text-white/90")} />}
    </span>
  );
}
