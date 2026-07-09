"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  createTenantRole,
  deleteTenantRole,
  updateTenantRole,
  type ActionResult,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { FormDialog } from "@/components/ui/form-dialog";
import { RowActionButton, RowActions } from "@/components/ui/row-actions";
import {
  INSTITUT_PERMISSION_SECTIONS,
  type InstitutPermissions,
  type TenantRole,
} from "@/lib/institut/team-access";

const initial: ActionResult = {};

function PermissionCheckboxes({
  permissions,
  wildcard,
}: {
  permissions?: InstitutPermissions;
  wildcard?: boolean;
}) {
  const t = useTranslations("institut.team.roles");

  if (wildcard) {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="perm_wildcard" defaultChecked={Boolean(permissions?.["*"]?.read)} />
        {t("fullAccess")}
      </label>
    );
  }

  return (
    <div className="space-y-2">
      {INSTITUT_PERMISSION_SECTIONS.map((section) => (
        <div key={section.key} className="flex flex-wrap items-center gap-3 text-sm">
          <span className="w-28 shrink-0 text-slate-700">{t(`sections.${section.labelKey}`)}</span>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              name={`perm_${section.key}_read`}
              defaultChecked={Boolean(permissions?.[section.key]?.read)}
            />
            {t("read")}
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              name={`perm_${section.key}_write`}
              defaultChecked={Boolean(permissions?.[section.key]?.write)}
            />
            {t("write")}
          </label>
        </div>
      ))}
    </div>
  );
}

function RoleForm({
  role,
  onSuccess,
}: {
  role?: TenantRole | null;
  onSuccess: () => void;
}) {
  const t = useTranslations("institut.team.roles");
  const isEdit = Boolean(role);
  const actionFn = isEdit ? updateTenantRole : createTenantRole;
  const [state, action, pending] = useActionState(actionFn, initial);

  useEffect(() => {
    if (state.ok) onSuccess();
  }, [state.ok, onSuccess]);

  const isOwner = role?.slug === "owner";

  return (
    <form action={action} className="space-y-4">
      {role ? <input type="hidden" name="role_id" value={role.id} /> : null}
      <Field label={t("name")} htmlFor="role_name">
        <Input
          id="role_name"
          name="name"
          required
          defaultValue={role?.name ?? ""}
          disabled={isOwner}
        />
      </Field>
      <Field label={t("roleDescription")} htmlFor="role_description">
        <Input
          id="role_description"
          name="description"
          defaultValue={role?.description ?? ""}
          disabled={isOwner}
        />
      </Field>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-900">{t("permissions")}</p>
        {isOwner ? (
          <PermissionCheckboxes permissions={role?.permissions} wildcard />
        ) : (
          <PermissionCheckboxes permissions={role?.permissions} />
        )}
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {!isOwner ? (
        <Button type="submit" disabled={pending}>
          {pending ? t("submitting") : isEdit ? t("submitEdit") : t("submitCreate")}
        </Button>
      ) : null}
    </form>
  );
}

export function TeamRolesPanel({ roles }: { roles: TenantRole[] }) {
  const t = useTranslations("institut.team.roles");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TenantRole | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(role: TenantRole) {
    setEditing(role);
    setDialogOpen(true);
  }

  return (
    <>
      <div className="px-4 py-4 lg:px-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{t("description")}</p>
          <Button onClick={openCreate} className="h-9 shrink-0">
            + {t("create")}
          </Button>
        </div>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {roles.map((role) => (
            <li key={role.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  {role.name}
                  {role.is_system ? (
                    <span className="ml-2 text-xs font-normal text-slate-400">{t("systemBadge")}</span>
                  ) : null}
                </p>
                {role.description ? (
                  <p className="mt-0.5 text-sm text-slate-500">{role.description}</p>
                ) : null}
              </div>
              <RowActions className="shrink-0">
                <RowActionButton type="button" onClick={() => openEdit(role)} icon={<Pencil className="h-3.5 w-3.5" />}>
                  {t("edit")}
                </RowActionButton>
                {!role.is_system ? (
                  <form action={deleteTenantRole}>
                    <input type="hidden" name="role_id" value={role.id} />
                    <RowActionButton type="submit" tone="danger" icon={<Trash2 className="h-3.5 w-3.5" />}>
                      {t("delete")}
                    </RowActionButton>
                  </form>
                ) : null}
              </RowActions>
            </li>
          ))}
        </ul>
      </div>

      <FormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? t("editTitle") : t("createTitle")}
        size="lg"
      >
        <RoleForm role={editing} onSuccess={() => setDialogOpen(false)} />
      </FormDialog>
    </>
  );
}
