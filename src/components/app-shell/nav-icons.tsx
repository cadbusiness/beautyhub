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
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4 shrink-0", className)}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function NavIconHome({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </Svg>
  );
}

export function NavIconCalendar({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  );
}

export function NavIconSparkles({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <path d="m5.6 5.6 2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <circle cx="12" cy="12" r="2.5" />
    </Svg>
  );
}

export function NavIconUsers({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M16 19a4 4 0 0 0-8 0" />
      <circle cx="12" cy="9" r="3" />
      <path d="M20 19a3 3 0 0 0-2.5-2.9M4 19a3 3 0 0 1 2.5-2.9" />
    </Svg>
  );
}

export function NavIconUserCog({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="10" cy="8" r="3" />
      <path d="M10 14a5 5 0 0 0-5 5M19 8v6M22 11h-6" />
    </Svg>
  );
}

export function NavIconShoppingCart({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="9" cy="20" r="1" />
      <circle cx="17" cy="20" r="1" />
      <path d="M2 3h2l2.4 12.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L22 6H6" />
    </Svg>
  );
}

export function NavIconMegaphone({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m3 11 8-4v10l-8-4z" />
      <path d="M11 7v10l8 3V4l-8 3z" />
      <path d="M19 10v4" />
    </Svg>
  );
}

export function NavIconGraduationCap({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3 2 8l10 5 10-5-10-5z" />
      <path d="M6 10v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
      <path d="M22 8v6" />
    </Svg>
  );
}

export function NavIconPanelLeft({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </Svg>
  );
}

const NAV_ICON_MAP: Record<string, ComponentType<IconProps>> = {
  home: NavIconHome,
  calendar: NavIconCalendar,
  sparkles: NavIconSparkles,
  users: NavIconUsers,
  "user-cog": NavIconUserCog,
  "shopping-cart": NavIconShoppingCart,
  megaphone: NavIconMegaphone,
  "graduation-cap": NavIconGraduationCap,
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
