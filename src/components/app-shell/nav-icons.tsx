import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type IconProps = { className?: string };

function Svg({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-[18px] w-[18px] shrink-0", className)}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function NavIconHome({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Svg>
  );
}

export function NavIconCalendar({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </Svg>
  );
}

export function NavIconScissors({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="6" cy="6" r="3" />
      <path d="M8.12 8.12 12 12" />
      <path d="M20 4 8.12 15.88" />
      <circle cx="6" cy="18" r="3" />
      <path d="M14.47 14.48 20 20" />
    </Svg>
  );
}

export function NavIconContact({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M6 21v-1a6 6 0 0 1 12 0v1" />
    </Svg>
  );
}

export function NavIconTeam({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

export function NavIconCash({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect width="20" height="12" x="2" y="6" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </Svg>
  );
}

export function NavIconChart({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </Svg>
  );
}

export function NavIconBookOpen({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </Svg>
  );
}

export function NavIconPanelLeft({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
    </Svg>
  );
}

const NAV_ICON_MAP: Record<string, ComponentType<IconProps>> = {
  home: NavIconHome,
  calendar: NavIconCalendar,
  scissors: NavIconScissors,
  contact: NavIconContact,
  team: NavIconTeam,
  cash: NavIconCash,
  chart: NavIconChart,
  "book-open": NavIconBookOpen,
};

export function NavItemIcon({
  name,
  className,
}: {
  name?: string;
  className?: string;
}) {
  const Icon = name ? NAV_ICON_MAP[name] : null;
  if (!Icon) return null;
  return <Icon className={className} />;
}
