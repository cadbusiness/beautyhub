"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DataTable, dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";
import { FormDialog } from "@/components/ui/form-dialog";
import { Field, Input } from "@/components/ui/input";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { RowActionButton } from "@/components/ui/row-actions";
import type { VoucherTemplateRow } from "@/lib/institut/voucher-pdf";
import {
  deleteVoucherTemplate,
  saveVoucherTemplate,
  type ActionResult,
} from "./voucher-template-actions";

const initial: ActionResult = {};

function publicBgUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!base) return null;
  return `${base}/storage/v1/object/public/voucher-assets/${path}`;
}

export function VoucherTemplatesManager({ templates }: { templates: VoucherTemplateRow[] }) {
  const t = useTranslations("pos.vouchers.templates");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherTemplateRow | null>(null);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(row: VoucherTemplateRow) {
    setEditing(row);
    setOpen(true);
  }

  return (
    <div className="border-b border-slate-200 pb-6">
      <ListToolbar
        action={
          <Button onClick={openCreate} className="h-9 w-full sm:w-auto">
            + {t("new")}
          </Button>
        }
      >
        <p className="text-sm text-slate-600">{t("description")}</p>
      </ListToolbar>

      <DataTable empty={templates.length === 0 ? t("empty") : undefined}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200">
            <tr>
              <th className={dataTableHead}>{t("columns.name")}</th>
              <th className={`hidden sm:table-cell ${dataTableHead}`}>{t("columns.title")}</th>
              <th className={dataTableHead}>{t("columns.status")}</th>
              <th className={`w-28 text-right ${dataTableHead}`}>{t("columns.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((row) => (
              <tr key={row.id} className={dataTableRow}>
                <td className={`font-medium text-slate-900 ${dataTableCell}`}>
                  {row.name}
                  {row.is_default ? (
                    <span className="ml-2 text-xs text-slate-500">{t("defaultBadge")}</span>
                  ) : null}
                </td>
                <td className={`hidden text-slate-600 sm:table-cell ${dataTableCell}`}>
                  {row.title}
                </td>
                <td className={`text-slate-600 ${dataTableCell}`}>
                  {row.is_active ? t("active") : t("inactive")}
                </td>
                <td className={`text-right ${dataTableCell}`}>
                  <div className="flex items-center justify-end gap-1">
                    <RowActionButton
                      type="button"
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      onClick={() => openEdit(row)}
                    >
                      {tCommon("edit")}
                    </RowActionButton>
                    <form action={deleteVoucherTemplate}>
                      <input type="hidden" name="id" value={row.id} />
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
            ))}
          </tbody>
        </table>
      </DataTable>

      {open ? (
        <TemplateFormDialog
          open={open}
          template={editing}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function TemplateFormDialog({
  open,
  template,
  onClose,
}: {
  open: boolean;
  template: VoucherTemplateRow | null;
  onClose: () => void;
}) {
  const t = useTranslations("pos.vouchers.templates");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(saveVoucherTemplate, initial);
  const preview = publicBgUrl(template?.background_path ?? null);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={template ? t("dialogEdit") : t("dialogNew")}
      size="lg"
    >
      <form action={action} className="space-y-4">
        {template ? <input type="hidden" name="id" value={template.id} /> : null}
        <Field label={t("form.name")} htmlFor="name">
          <Input id="name" name="name" required defaultValue={template?.name ?? ""} />
        </Field>
        <Field label={t("form.title")} htmlFor="title">
          <Input id="title" name="title" defaultValue={template?.title ?? "Carte cadeau"} />
        </Field>
        <Field label={t("form.subtitle")} htmlFor="subtitle">
          <Input id="subtitle" name="subtitle" defaultValue={template?.subtitle ?? ""} />
        </Field>
        <Field label={t("form.footer")} htmlFor="footer_text">
          <Input
            id="footer_text"
            name="footer_text"
            defaultValue={template?.footer_text ?? ""}
            placeholder={t("form.placeholdersHint")}
          />
        </Field>
        <Field label={t("form.background")} htmlFor="background">
          <Input id="background" name="background" type="file" accept="image/jpeg,image/png,image/webp" />
        </Field>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-28 w-full rounded-lg object-cover" />
        ) : null}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="is_default" value="1" defaultChecked={template?.is_default ?? false} />
          {t("form.default")}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="is_active" value="1" defaultChecked={template?.is_active ?? true} />
          {t("form.active")}
        </label>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? tCommon("saving") : tCommon("save")}
          </Button>
        </div>
      </form>
    </FormDialog>
  );
}
