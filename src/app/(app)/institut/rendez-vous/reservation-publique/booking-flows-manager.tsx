"use client";

import { Pencil, Share2, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  deleteBookingFlow,
  saveBookingFlow,
  setDefaultBookingFlow,
  type ActionResult,
} from "./actions";
import {
  bookingFlowEmbedHtml,
  bookingFlowEmbedUrl,
  bookingFlowPublicUrl,
  DEFAULT_BOOKING_FLOW_CONFIG,
  type BookingFlowConfig,
  type BookingFlowRow,
} from "@/lib/institut/booking-flows";
import { Button } from "@/components/ui/button";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { ListPanelFooter } from "@/components/ui/list-panel";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { Field, Input, Select } from "@/components/ui/input";
import { RowActionButton, RowActions } from "@/components/ui/row-actions";

type ServiceOption = { id: string; label: string };

function CopyField({ label, value }: { label: string; value: string }) {
  const t = useTranslations("appointments.bookingPublic");
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={() => void navigator.clipboard.writeText(value)}
        >
          {t("copy")}
        </Button>
      </div>
    </div>
  );
}

function FlowForm({
  flow,
  services,
  onDone,
}: {
  flow?: BookingFlowRow;
  services: ServiceOption[];
  onDone: () => void;
}) {
  const t = useTranslations("appointments.bookingPublic");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isDefault = flow?.is_default ?? false;
  const config: BookingFlowConfig = flow?.config ?? DEFAULT_BOOKING_FLOW_CONFIG;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res: ActionResult = await saveBookingFlow(fd);
    setPending(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {flow ? <input type="hidden" name="id" value={flow.id} /> : null}
      <Field label={t("form.name")} htmlFor="flow_name">
        <Input id="flow_name" name="name" required defaultValue={flow?.name ?? ""} />
      </Field>
      {!isDefault ? (
        <Field label={t("form.slug")} htmlFor="flow_slug">
          <Input
            id="flow_slug"
            name="slug"
            placeholder={t("form.slugPlaceholder")}
            defaultValue={flow?.slug ?? ""}
            pattern="[a-z0-9-]+"
          />
          <p className="mt-1 text-xs text-slate-500">{t("form.slugHint")}</p>
        </Field>
      ) : (
        <p className="text-sm text-slate-500">{t("form.defaultSlugHint")}</p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_published" defaultChecked={flow?.is_published ?? true} />
        {t("form.published")}
      </label>
      {!flow ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_default" />
          {t("form.setDefault")}
        </label>
      ) : null}

      <div className="space-y-2 border-t border-slate-200 pt-4">
        <p className="text-sm font-medium text-slate-900">{t("form.processTitle")}</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="show_staff_picker" defaultChecked={config.showStaffPicker} />
          {t("form.showStaffPicker")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="require_staff" defaultChecked={config.requireStaff} />
          {t("form.requireStaff")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="show_extras_step" defaultChecked={config.showExtrasStep} />
          {t("form.showExtrasStep")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="require_phone" defaultChecked={config.requirePhone} />
          {t("form.requirePhone")}
        </label>
        <Field label={t("form.allowedServices")} htmlFor="allowed_service_ids">
          <Select
            id="allowed_service_ids"
            name="allowed_service_ids"
            multiple
            className="h-auto min-h-24 py-2"
            defaultValue={config.allowedServiceIds ?? []}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-slate-500">{t("form.allowedServicesHint")}</p>
        </Field>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? tCommon("saving") : tCommon("save")}
      </Button>
    </form>
  );
}

export function BookingFlowsManager({
  flows,
  services,
  publicBaseUrl,
}: {
  flows: BookingFlowRow[];
  services: ServiceOption[];
  publicBaseUrl: string;
}) {
  const t = useTranslations("appointments.bookingPublic");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editFlow, setEditFlow] = useState<BookingFlowRow | null>(null);
  const [shareFlow, setShareFlow] = useState<BookingFlowRow | null>(null);

  const sorted = useMemo(
    () => [...flows].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
    [flows],
  );

  function openCreate() {
    setEditFlow(null);
    setDialogOpen(true);
  }

  function openEdit(flow: BookingFlowRow) {
    setEditFlow(flow);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    await deleteBookingFlow(fd);
    router.refresh();
  }

  async function handleSetDefault(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    await setDefaultBookingFlow(fd);
    router.refresh();
  }

  const shareUrl = shareFlow ? bookingFlowPublicUrl(publicBaseUrl, shareFlow.slug) : "";
  const embedUrl = shareFlow ? bookingFlowEmbedUrl(publicBaseUrl, shareFlow.slug) : "";
  const embedCode = shareFlow ? bookingFlowEmbedHtml(embedUrl, shareFlow.name) : "";

  return (
    <>
      <ListToolbar
        action={
          <Button type="button" className="h-9" onClick={openCreate}>
            + {t("newFlow")}
          </Button>
        }
      >
        <Link
          href="/institut/rendez-vous"
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          ← {t("backToCalendar")}
        </Link>
      </ListToolbar>

      <p className="border-b border-slate-200 px-4 py-3 text-sm text-slate-600 lg:px-6">
        {t("intro")}
      </p>

      <DataTable empty={sorted.length === 0 ? t("empty") : undefined}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>{t("columns.name")}</th>
              <th className={`hidden md:table-cell ${dataTableHead}`}>{t("columns.slug")}</th>
              <th className={dataTableHead}>{t("columns.status")}</th>
              <th className={`text-right ${dataTableHead}`}>{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((flow) => (
              <tr key={flow.id} className={dataTableRow}>
                <td className={dataTableCell}>
                  <span className="font-medium text-slate-900">{flow.name}</span>
                  {flow.is_default ? (
                    <span className="ml-2 text-xs text-violet-600">{t("defaultBadge")}</span>
                  ) : null}
                </td>
                <td className={`hidden font-mono text-xs text-slate-600 md:table-cell ${dataTableCell}`}>
                  {flow.slug || t("defaultSlug")}
                </td>
                <td className={`text-slate-600 ${dataTableCell}`}>
                  {flow.is_published ? t("published") : t("draft")}
                </td>
                <td className={`text-right ${dataTableCell}`}>
                  <RowActions>
                    <RowActionButton
                      type="button"
                      onClick={() => setShareFlow(flow)}
                      icon={<Share2 className="h-3.5 w-3.5" />}
                    >
                      {t("share")}
                    </RowActionButton>
                    <RowActionButton
                      type="button"
                      onClick={() => openEdit(flow)}
                      icon={<Pencil className="h-3.5 w-3.5" />}
                    >
                      {tCommon("edit")}
                    </RowActionButton>
                    {!flow.is_default ? (
                      <>
                        <RowActionButton
                          type="button"
                          onClick={() => void handleSetDefault(flow.id)}
                          icon={<Star className="h-3.5 w-3.5" />}
                        >
                          {t("setDefault")}
                        </RowActionButton>
                        <RowActionButton
                          type="button"
                          tone="danger"
                          onClick={() => void handleDelete(flow.id)}
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                        >
                          {tCommon("delete")}
                        </RowActionButton>
                      </>
                    ) : null}
                  </RowActions>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>

      {sorted.length > 0 ? (
        <ListPanelFooter>{t("footer", { count: sorted.length })}</ListPanelFooter>
      ) : null}

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editFlow ? t("editTitle") : t("createTitle")}
        size="lg"
      >
        {dialogOpen ? (
          <FlowForm
            flow={editFlow ?? undefined}
            services={services}
            onDone={() => setDialogOpen(false)}
          />
        ) : null}
      </FormDialog>

      <FormDialog
        open={Boolean(shareFlow)}
        onClose={() => setShareFlow(null)}
        title={t("shareTitle", { name: shareFlow?.name ?? "" })}
        size="lg"
      >
        {shareFlow ? (
          <div className="space-y-4">
            <CopyField label={t("publicLink")} value={shareUrl} />
            <CopyField label={t("embedLink")} value={embedUrl} />
            <CopyField label={t("embedCode")} value={embedCode} />
            <Link href={shareUrl} target="_blank" className="text-sm text-slate-600 underline">
              {t("openPreview")} ↗
            </Link>
          </div>
        ) : null}
      </FormDialog>
    </>
  );
}
