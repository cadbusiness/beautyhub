"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  dataTableCellCompact,
  dataTableHeadCompact,
  dataTableRow,
} from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanel } from "@/components/ui/list-panel";
import { PageTabs } from "@/components/ui/page-tabs";
import type { ClientProfile } from "@/lib/institut/clients";
import { formatDateTime, formatPrice } from "@/lib/utils";
import { ClientForm } from "../client-form";

type Tab = "overview" | "appointments" | "sales" | "access";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function ClientTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
      {children}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-3 sm:flex-row sm:items-start sm:justify-between">
      <dt className="shrink-0 text-sm text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900 sm:text-right">{value}</dd>
    </div>
  );
}

export function ClientDetail({ profile }: { profile: ClientProfile }) {
  const t = useTranslations("institut.clients.detail");
  const tAppt = useTranslations("appointments.status");
  const tCommon = useTranslations("common");
  const [tab, setTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);

  const { client, stats } = profile;
  const displayName = client.full_name ?? client.email;

  const addressParts = [
    client.address_line1,
    client.address_line2,
    [client.postal_code, client.city].filter(Boolean).join(" "),
    client.country && client.country !== "FR" ? client.country : null,
  ].filter(Boolean);

  const tabs = [
    { id: "overview" as const, label: t("tabs.overview") },
    {
      id: "appointments" as const,
      label: t("tabs.appointments"),
      count: stats.appointment_count,
    },
    {
      id: "sales" as const,
      label: t("tabs.sales"),
      count: stats.sale_count,
    },
    { id: "access" as const, label: t("tabs.access") },
  ];

  return (
    <>
      <div className="border-b border-slate-200 bg-white px-4 py-4 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/institut/clients"
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              ← {t("backToList")}
            </Link>
            <h1 className="mt-1 truncate text-lg font-semibold text-slate-900">{displayName}</h1>
            <p className="text-sm text-slate-500">{client.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {client.tags.map((tag) => (
                <ClientTag key={tag}>{tag}</ClientTag>
              ))}
              {client.has_portal_account ? <ClientTag>{t("badgeAccount")}</ClientTag> : null}
              {stats.ecommerce_order_count > 0 ? (
                <ClientTag>{t("badgeEcommerce")}</ClientTag>
              ) : null}
            </div>
          </div>
          <Button variant="outline" className="h-9" onClick={() => setEditOpen(true)}>
            {t("edit")}
          </Button>
        </div>
      </div>

      <PageTabs tabs={tabs} active={tab} onChange={setTab} />

      <ListPanel className="flex-none border-b-0">
        {tab === "overview" ? (
          <div className="space-y-6 px-4 py-5 lg:px-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={t("stats.totalSpent")}
                value={
                  stats.total_spent_cents > 0
                    ? formatPrice(stats.total_spent_cents)
                    : tCommon("dash")
                }
              />
              <StatCard
                label={t("stats.bookingRate")}
                value={
                  stats.booking_rate !== null ? `${stats.booking_rate} %` : tCommon("dash")
                }
              />
              <StatCard
                label={t("stats.upcoming")}
                value={String(stats.upcoming_count)}
              />
              <StatCard
                label={t("stats.loyaltyPoints")}
                value={String(stats.loyalty_points)}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section>
                <h2 className="mb-2 text-sm font-medium text-slate-900">{t("contactTitle")}</h2>
                <dl className="rounded-lg border border-slate-200 px-4">
                  <InfoRow label={tCommon("phone")} value={client.phone ?? tCommon("dash")} />
                  <InfoRow
                    label={t("dateOfBirth")}
                    value={
                      client.date_of_birth
                        ? new Date(client.date_of_birth).toLocaleDateString()
                        : tCommon("dash")
                    }
                  />
                  <InfoRow
                    label={t("address")}
                    value={
                      addressParts.length > 0 ? (
                        <span className="whitespace-pre-line text-right">{addressParts.join("\n")}</span>
                      ) : (
                        tCommon("dash")
                      )
                    }
                  />
                  <InfoRow
                    label={t("clientId")}
                    value={<code className="text-xs text-slate-600">{client.id}</code>}
                  />
                  <InfoRow
                    label={t("memberSince")}
                    value={formatDateTime(client.created_at)}
                  />
                </dl>
              </section>

              <section>
                <h2 className="mb-2 text-sm font-medium text-slate-900">{t("activityTitle")}</h2>
                <dl className="rounded-lg border border-slate-200 px-4">
                  <InfoRow
                    label={t("stats.appointments")}
                    value={String(stats.appointment_count)}
                  />
                  <InfoRow
                    label={t("stats.completed")}
                    value={String(stats.completed_count)}
                  />
                  <InfoRow
                    label={t("stats.cancelled")}
                    value={String(stats.cancelled_count)}
                  />
                  <InfoRow
                    label={t("stats.noShow")}
                    value={String(stats.no_show_count)}
                  />
                  <InfoRow
                    label={t("stats.posSpent")}
                    value={
                      stats.pos_spent_cents > 0
                        ? formatPrice(stats.pos_spent_cents)
                        : tCommon("dash")
                    }
                  />
                  <InfoRow
                    label={t("stats.ecommerceSpent")}
                    value={
                      stats.ecommerce_spent_cents > 0
                        ? formatPrice(stats.ecommerce_spent_cents)
                        : tCommon("dash")
                    }
                  />
                </dl>
              </section>
            </div>

            {profile.top_services.length > 0 ? (
              <section>
                <h2 className="mb-2 text-sm font-medium text-slate-900">{t("topServices")}</h2>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {profile.top_services.map((s) => (
                    <li
                      key={s.service_id}
                      className="flex items-center justify-between px-4 py-2.5 text-sm"
                    >
                      <span className="text-slate-900">{s.service_name}</span>
                      <span className="tabular-nums text-slate-500">
                        {t("serviceCount", { count: s.count })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {client.notes ? (
              <section>
                <h2 className="mb-2 text-sm font-medium text-slate-900">{t("notesTitle")}</h2>
                <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {client.notes}
                </p>
              </section>
            ) : null}

            {profile.enrollments.length > 0 ? (
              <section>
                <h2 className="mb-2 text-sm font-medium text-slate-900">{t("enrollmentsTitle")}</h2>
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {profile.enrollments.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center justify-between px-4 py-2.5 text-sm"
                    >
                      <span className="text-slate-900">{e.course_title}</span>
                      <span className="text-slate-500">{e.status}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-medium text-slate-700">{t("protocolsComingSoon")}</p>
              <p className="mt-1 text-xs text-slate-500">{t("protocolsHint")}</p>
            </section>
          </div>
        ) : null}

        {tab === "appointments" ? (
          <div className="px-4 py-5 lg:px-6">
            {profile.upcoming_appointments.length > 0 ? (
              <>
                <h2 className="mb-3 text-sm font-medium text-slate-900">{t("upcomingTitle")}</h2>
                <DataTable className="mb-6">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200">
                      <tr>
                        <th className={dataTableHeadCompact}>{t("columns.date")}</th>
                        <th className={dataTableHeadCompact}>{t("columns.service")}</th>
                        <th className={dataTableHeadCompact}>{t("columns.staff")}</th>
                        <th className={dataTableHeadCompact}>{t("columns.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.upcoming_appointments.map((a) => (
                        <tr key={a.id} className={dataTableRow}>
                          <td className={dataTableCellCompact}>{formatDateTime(a.starts_at)}</td>
                          <td className={dataTableCellCompact}>
                            {a.service_name ?? tCommon("dash")}
                          </td>
                          <td className={dataTableCellCompact}>
                            {a.staff_name ?? tCommon("dash")}
                          </td>
                          <td className={dataTableCellCompact}>
                            {tAppt(a.status as "booked")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DataTable>
              </>
            ) : (
              <p className="mb-6 text-sm text-slate-500">{t("noUpcoming")}</p>
            )}

            <h2 className="mb-3 text-sm font-medium text-slate-900">{t("historyTitle")}</h2>
            <DataTable
              empty={
                profile.past_appointments.length === 0 ? t("noAppointments") : undefined
              }
            >
              {profile.past_appointments.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className={dataTableHeadCompact}>{t("columns.date")}</th>
                      <th className={dataTableHeadCompact}>{t("columns.service")}</th>
                      <th className={dataTableHeadCompact}>{t("columns.staff")}</th>
                      <th className={dataTableHeadCompact}>{t("columns.status")}</th>
                      <th className={`text-right ${dataTableHeadCompact}`}>
                        {t("columns.price")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.past_appointments.map((a) => (
                      <tr key={a.id} className={dataTableRow}>
                        <td className={dataTableCellCompact}>{formatDateTime(a.starts_at)}</td>
                        <td className={dataTableCellCompact}>
                          {a.service_name ?? tCommon("dash")}
                        </td>
                        <td className={dataTableCellCompact}>
                          {a.staff_name ?? tCommon("dash")}
                        </td>
                        <td className={dataTableCellCompact}>
                          {tAppt(a.status as "booked")}
                        </td>
                        <td className={`text-right ${dataTableCellCompact}`}>
                          {a.price_cents ? formatPrice(a.price_cents) : tCommon("dash")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </DataTable>
          </div>
        ) : null}

        {tab === "sales" ? (
          <div className="px-4 py-5 lg:px-6">
            <DataTable empty={profile.sales.length === 0 ? t("noSales") : undefined}>
              {profile.sales.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className={dataTableHeadCompact}>{t("columns.date")}</th>
                      <th className={dataTableHeadCompact}>{t("columns.ticket")}</th>
                      <th className={dataTableHeadCompact}>{t("columns.items")}</th>
                      <th className={dataTableHeadCompact}>{t("columns.source")}</th>
                      <th className={`text-right ${dataTableHeadCompact}`}>
                        {t("columns.total")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.sales.map((s) => (
                      <tr key={s.id} className={dataTableRow}>
                        <td className={dataTableCellCompact}>{formatDateTime(s.created_at)}</td>
                        <td className={dataTableCellCompact}>
                          {s.ticket_number ? (
                            <Link
                              href={`/institut/caisse/ticket/${s.id}`}
                              className="text-slate-900 underline-offset-2 hover:underline"
                            >
                              {s.ticket_number}
                            </Link>
                          ) : (
                            tCommon("dash")
                          )}
                        </td>
                        <td className={`max-w-[12rem] truncate ${dataTableCellCompact}`}>
                          {s.items.map((i) => i.name).join(", ") || tCommon("dash")}
                        </td>
                        <td className={dataTableCellCompact}>
                          {s.woo_order_id ? t("sourceEcommerce") : t("sourcePos")}
                        </td>
                        <td className={`text-right ${dataTableCellCompact}`}>
                          {formatPrice(s.total_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </DataTable>
          </div>
        ) : null}

        {tab === "access" ? (
          <div className="space-y-6 px-4 py-5 lg:px-6">
            <section>
              <h2 className="mb-2 text-sm font-medium text-slate-900">{t("accessTitle")}</h2>
              <dl className="rounded-lg border border-slate-200 px-4">
                <InfoRow
                  label={t("portalAccount")}
                  value={
                    client.has_portal_account ? t("portalActive") : t("portalInactive")
                  }
                />
                <InfoRow label={tCommon("email")} value={client.email} />
                <InfoRow
                  label={t("marketingOptIn")}
                  value={client.marketing_opt_in ? tCommon("yes") : tCommon("no")}
                />
              </dl>
              {!client.has_portal_account ? (
                <p className="mt-3 text-xs text-slate-500">{t("portalHint")}</p>
              ) : null}
            </section>

            <section className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-medium text-slate-700">{t("emailsComingSoon")}</p>
              <p className="mt-1 text-xs text-slate-500">{t("emailsHint")}</p>
            </section>
          </div>
        ) : null}
      </ListPanel>

      <FormDialog open={editOpen} onClose={() => setEditOpen(false)} title={t("editTitle")} size="lg">
        <ClientForm client={client} onSuccess={() => setEditOpen(false)} />
      </FormDialog>
    </>
  );
}
