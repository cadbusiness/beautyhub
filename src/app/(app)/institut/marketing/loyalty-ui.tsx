"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function LoyaltyPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 lg:px-8 lg:py-8">
      {children}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4l1.4-1.4M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function QrIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75" />
      <path d="M14 14h2v2h-2v-2Zm4 0h3v3h-3v-3Zm-4 4h2v3h-2v-3Zm4 2h3v3h-3v-3Z" fill="currentColor" />
    </svg>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 0 0 1 2 2v10.5A1.5 1.5 0 0 1 18.5 19H5.5A2.5 2.5 0 0 1 3 16.5V7.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M18 8h2.5A1.5 1.5 0 0 1 22 9.5v3A1.5 1.5 0 0 1 20.5 14H18" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="18.5" cy="11.5" r="1" fill="currentColor" />
    </svg>
  );
}

type ProgramStatus = "draft" | "ready" | "live";

export function LoyaltyHero({
  title,
  description,
  status,
  statusLabel,
}: {
  title: string;
  description: string;
  status: ProgramStatus;
  statusLabel: string;
}) {
  const statusTone =
    status === "live"
      ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
      : status === "ready"
        ? "bg-amber-100 text-amber-900 ring-amber-200"
        : "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-amber-50/80 p-6 lg:p-8">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-200/30 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-amber-200/25 blur-2xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
              <SparklesIcon className="h-5 w-5" />
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
                statusTone,
              )}
            >
              {statusLabel}
            </span>
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function LoyaltySetupSteps({
  title,
  steps,
}: {
  title: string;
  steps: { label: string; hint: string; done: boolean; current: boolean }[];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={cn(
              "relative rounded-xl border p-4 transition-colors",
              step.done
                ? "border-emerald-200 bg-emerald-50/60"
                : step.current
                  ? "border-violet-200 bg-violet-50/50 ring-1 ring-violet-100"
                  : "border-slate-200 bg-slate-50/50",
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  step.done
                    ? "bg-emerald-600 text-white"
                    : step.current
                      ? "bg-violet-600 text-white"
                      : "bg-white text-slate-500 ring-1 ring-slate-200",
                )}
              >
                {step.done ? <CheckIcon className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{step.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{step.hint}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function LoyaltyStatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: "users" | "points";
}) {
  const Icon = icon === "users" ? UsersIcon : SparklesIcon;
  const iconBg = icon === "users" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
            {value.toLocaleString()}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{hint}</p>
        </div>
        <span
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            iconBg,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

export function LoyaltySectionCard({
  title,
  description,
  action,
  children,
  footer,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
      {footer ? (
        <div className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-400 lg:px-6">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

export function LoyaltyEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-10 text-center lg:px-6">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <SparklesIcon className="h-6 w-6" />
      </span>
      <p className="mt-4 text-sm font-medium text-slate-900">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoyaltyShareTools({
  title,
  description,
  qrTitle,
  qrDescription,
  walletTitle,
  walletDescription,
  comingSoon,
}: {
  title: string;
  description: string;
  qrTitle: string;
  qrDescription: string;
  walletTitle: string;
  walletDescription: string;
  comingSoon: string;
}) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 lg:p-6">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ShareToolCard
          icon={<QrIcon className="h-5 w-5" />}
          title={qrTitle}
          description={qrDescription}
          comingSoon={comingSoon}
          preview="qr"
        />
        <ShareToolCard
          icon={<WalletIcon className="h-5 w-5" />}
          title={walletTitle}
          description={walletDescription}
          comingSoon={comingSoon}
          preview="wallet"
        />
      </div>
    </section>
  );
}

function ShareToolCard({
  icon,
  title,
  description,
  comingSoon,
  preview,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  comingSoon: string;
  preview: "qr" | "wallet";
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 opacity-90">
      <span className="absolute right-3 top-3 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {comingSoon}
      </span>
      <div className="flex gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
          {preview === "qr" ? (
            <svg viewBox="0 0 64 64" className="h-12 w-12 opacity-60" aria-hidden>
              <rect x="8" y="8" width="20" height="20" rx="2" fill="currentColor" />
              <rect x="36" y="8" width="20" height="20" rx="2" fill="currentColor" />
              <rect x="8" y="36" width="20" height="20" rx="2" fill="currentColor" />
              <rect x="36" y="36" width="8" height="8" fill="currentColor" />
              <rect x="48" y="36" width="8" height="8" fill="currentColor" />
              <rect x="36" y="48" width="8" height="8" fill="currentColor" />
              <rect x="48" y="48" width="8" height="8" fill="currentColor" />
            </svg>
          ) : (
            <WalletIcon className="h-8 w-8" />
          )}
        </div>
        <div className="min-w-0 pt-1">
          <div className="flex items-center gap-2 text-slate-700">{icon}</div>
          <p className="mt-1 text-sm font-medium text-slate-900">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function deriveProgramStatus(
  hasRules: boolean,
  hasRewards: boolean,
  isActive: boolean,
): ProgramStatus {
  if (isActive && hasRules) return "live";
  if (hasRules && hasRewards) return "ready";
  return "draft";
}
