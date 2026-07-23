"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { RowActionButton } from "@/components/ui/row-actions";
import {
  resolvePromoStatus,
  type PromoRow,
  type PromoStatus,
} from "@/lib/institut/promos-core";
import { formatPrice } from "@/lib/utils";
import { deletePromo, savePromo, type ActionResult } from "./promo-actions";

const initial: ActionResult = {};

function toDatetimeLocal(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDiscount(promo: PromoRow, fixedLabel: (cents: number) => string): string {
  if (promo.discount_type === "percent") return `−${promo.discount_percent ?? 0} %`;
  return `−${fixedLabel(promo.discount_cents ?? 0)}`;
}

function channelLabels(
  promo: PromoRow,
  labels: { woo: string; booking: string; pos: string },
): string {
  const parts: string[] = [];
  if (promo.channel_woo) parts.push(labels.woo);
  if (promo.channel_booking) parts.push(labels.booking);
  if (promo.channel_pos) parts.push(labels.pos);
  return parts.join(" · ");
}

export function PromosManager({ promos }: { promos: PromoRow[] }) {
  const t = useTranslations("institut.marketing.promos");
  const tCommon = useTranslations("common");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PromoRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return promos;
    return promos.filter(
      (p) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false),
    );
  }, [promos, query]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(promo: PromoRow) {
    setEditing(promo);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  const statusLabel = (status: PromoStatus) => t(`status.${status}`);

  return (
    <>
      <div className="border-b border-slate-200 px-4 py-3 lg:px-6">
        <p className="text-sm text-slate-600">{t("description")}</p>
      </div>

      <ListToolbar
        action={
          <Button onClick={openCreate} className="h-9 w-full sm:w-auto">
            + {t("new")}
          </Button>
        }
      >
        <Input
          type="search"
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 sm:max-w-xs"
        />
      </ListToolbar>

      <DataTable empty={filtered.length === 0 ? (promos.length === 0 ? t("empty") : t("noResults")) : undefined}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>{t("columns.code")}</th>
              <th className={`hidden sm:table-cell ${dataTableHead}`}>{t("columns.name")}</th>
              <th className={dataTableHead}>{t("columns.discount")}</th>
              <th className={`hidden md:table-cell ${dataTableHead}`}>{t("columns.channels")}</th>
              <th className={`hidden lg:table-cell ${dataTableHead}`}>{t("columns.usage")}</th>
              <th className={dataTableHead}>{t("columns.status")}</th>
              <th className={`w-28 text-right ${dataTableHead}`}>{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((promo) => {
              const status = resolvePromoStatus(promo);
              return (
                <tr key={promo.id} className={dataTableRow}>
                  <td className={`font-medium tabular-nums text-slate-900 ${dataTableCell}`}>
                    {promo.code}
                  </td>
                  <td className={`hidden text-slate-600 sm:table-cell ${dataTableCell}`}>
                    {promo.name}
                  </td>
                  <td className={`tabular-nums text-slate-700 ${dataTableCell}`}>
                    {formatDiscount(promo, formatPrice)}
                  </td>
                  <td className={`hidden text-xs text-slate-600 md:table-cell ${dataTableCell}`}>
                    {channelLabels(promo, {
                      woo: t("channels.woo"),
                      booking: t("channels.booking"),
                      pos: t("channels.pos"),
                    })}
                  </td>
                  <td className={`hidden tabular-nums text-slate-600 lg:table-cell ${dataTableCell}`}>
                    {promo.usage_limit != null
                      ? `${promo.usage_count}/${promo.usage_limit}`
                      : String(promo.usage_count)}
                  </td>
                  <td className={`text-slate-600 ${dataTableCell}`}>{statusLabel(status)}</td>
                  <td className={`text-right ${dataTableCell}`}>
                    <div className="flex items-center justify-end gap-1">
                      <RowActionButton
                        type="button"
                        icon={<Pencil className="h-3.5 w-3.5" />}
                        onClick={() => openEdit(promo)}
                      >
                        {tCommon("edit")}
                      </RowActionButton>
                      <form action={deletePromo}>
                        <input type="hidden" name="id" value={promo.id} />
                        <RowActionButton
                          type="submit"
                          tone="danger"
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                        >
                          {tCommon("delete")}
                        </RowActionButton>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTable>

      {filtered.length > 0 ? (
        <ListPanelFooter>
          {t("footer", { count: filtered.length })}
          {query
            ? ` · ${tCommon("countOfTotal", { count: filtered.length, total: promos.length })}`
            : ""}
        </ListPanelFooter>
      ) : null}

      {dialogOpen ? (
        <PromoFormDialog
          open={dialogOpen}
          promo={editing}
          onClose={closeDialog}
        />
      ) : null}
    </>
  );
}

function PromoFormDialog({
  open,
  promo,
  onClose,
}: {
  open: boolean;
  promo: PromoRow | null;
  onClose: () => void;
}) {
  const t = useTranslations("institut.marketing.promos");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(savePromo, initial);
  const [discountType, setDiscountType] = useState(promo?.discount_type ?? "percent");

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  useEffect(() => {
    setDiscountType(promo?.discount_type ?? "percent");
  }, [promo]);

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={promo ? t("dialogEditTitle") : t("dialogTitle")}
      size="lg"
    >
      <form action={action} className="space-y-4">
        {promo ? <input type="hidden" name="id" value={promo.id} /> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.code")} htmlFor="code">
            <Input
              id="code"
              name="code"
              required
              defaultValue={promo?.code ?? ""}
              placeholder={t("form.codePlaceholder")}
              className="uppercase"
            />
          </Field>
          <Field label={t("form.name")} htmlFor="name">
            <Input id="name" name="name" required defaultValue={promo?.name ?? ""} />
          </Field>
        </div>

        <Field label={t("form.description")} htmlFor="description">
          <Input id="description" name="description" defaultValue={promo?.description ?? ""} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.discountType")} htmlFor="discount_type">
            <Select
              id="discount_type"
              name="discount_type"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
            >
              <option value="percent">{t("form.percent")}</option>
              <option value="fixed">{t("form.fixed")}</option>
            </Select>
          </Field>
          {discountType === "percent" ? (
            <Field label={t("form.discountPercent")} htmlFor="discount_percent">
              <Input
                id="discount_percent"
                name="discount_percent"
                type="number"
                min={1}
                max={100}
                defaultValue={promo?.discount_percent ?? 10}
                required
              />
            </Field>
          ) : (
            <Field label={t("form.discountEuros")} htmlFor="discount_euros">
              <Input
                id="discount_euros"
                name="discount_euros"
                type="number"
                min={0.01}
                step="0.01"
                defaultValue={
                  promo?.discount_cents != null ? (promo.discount_cents / 100).toFixed(2) : "10.00"
                }
                required
              />
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("form.minOrder")} htmlFor="min_order_euros">
            <Input
              id="min_order_euros"
              name="min_order_euros"
              type="number"
              min={0}
              step="0.01"
              defaultValue={
                promo?.min_order_cents ? (promo.min_order_cents / 100).toFixed(2) : "0"
              }
            />
          </Field>
          <Field label={t("form.usageLimit")} htmlFor="usage_limit">
            <Input
              id="usage_limit"
              name="usage_limit"
              type="number"
              min={1}
              placeholder={t("form.unlimited")}
              defaultValue={promo?.usage_limit ?? ""}
            />
          </Field>
          <Field label={t("form.usageLimitPerClient")} htmlFor="usage_limit_per_client">
            <Input
              id="usage_limit_per_client"
              name="usage_limit_per_client"
              type="number"
              min={1}
              placeholder={t("form.unlimited")}
              defaultValue={promo?.usage_limit_per_client ?? ""}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.startsAt")} htmlFor="starts_at">
            <Input
              id="starts_at"
              name="starts_at"
              type="datetime-local"
              defaultValue={toDatetimeLocal(promo?.starts_at ?? null)}
            />
          </Field>
          <Field label={t("form.endsAt")} htmlFor="ends_at">
            <Input
              id="ends_at"
              name="ends_at"
              type="datetime-local"
              defaultValue={toDatetimeLocal(promo?.ends_at ?? null)}
            />
          </Field>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {t("form.channels")}
          </legend>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="channel_woo"
              value="1"
              defaultChecked={promo?.channel_woo ?? true}
            />
            {t("channels.woo")}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="channel_booking"
              value="1"
              defaultChecked={promo?.channel_booking ?? true}
            />
            {t("channels.booking")}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="channel_pos"
              value="1"
              defaultChecked={promo?.channel_pos ?? true}
            />
            {t("channels.pos")}
          </label>
        </fieldset>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="is_active"
            value="1"
            defaultChecked={promo?.is_active ?? true}
          />
          {t("form.active")}
        </label>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? t("form.saving") : t("form.save")}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
