"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createSchedule, deleteSchedule, type ActionResult } from "../schedule-actions";
import { ScheduleBlocksEditor } from "./schedule-blocks-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListToolbar } from "@/components/ui/list-toolbar";
import { RowActionButton } from "@/components/ui/row-actions";
import { cn } from "@/lib/utils";

const initial: ActionResult = {};

type Schedule = {
  id: string;
  name: string;
  is_default: boolean;
  blocks: Array<{ weekday: number; start_time: string; end_time: string }>;
};

export function SchedulesPanel({ schedules }: { schedules: Schedule[] }) {
  const t = useTranslations("institut.team.schedules");
  const [selectedId, setSelectedId] = useState<string>(
    schedules.find((s) => s.is_default)?.id ?? schedules[0]?.id ?? "",
  );
  const [createState, createAction, createPending] = useActionState(createSchedule, initial);

  const selected = schedules.find((s) => s.id === selectedId) ?? schedules[0];

  if (schedules.length === 0) {
    return (
      <>
        <ListToolbar>
          <p className="text-sm text-slate-600">{t("empty")}</p>
        </ListToolbar>
        <div className="max-w-md px-4 py-4 lg:px-6">
          <CreateScheduleForm action={createAction} pending={createPending} state={createState} />
        </div>
      </>
    );
  }

  return (
    <>
      <ListToolbar>
        <p className="text-sm text-slate-600">{t("description")}</p>
      </ListToolbar>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="w-full shrink-0 border-b border-slate-200 lg:w-60 lg:border-b-0 lg:border-r">
          <p className="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 lg:px-4">
            {t("listTitle")}
          </p>
          <ul className="border-t border-slate-100">
            {schedules.map((s) => {
              const active = selected?.id === s.id;
              return (
                <li
                  key={s.id}
                  className={cn(
                    "flex items-stretch border-b border-slate-100",
                    active && "bg-slate-50",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={cn(
                      "min-w-0 flex-1 px-4 py-2.5 text-left text-sm transition-colors",
                      active
                        ? "border-l-2 border-slate-900 font-medium text-slate-900"
                        : "border-l-2 border-transparent text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <span className="block truncate">{s.name}</span>
                    {s.is_default ? (
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {t("defaultShort")}
                      </span>
                    ) : null}
                  </button>
                  {!s.is_default ? (
                    <form
                      action={deleteSchedule}
                      className="flex items-center border-l border-slate-100 px-1"
                    >
                      <input type="hidden" name="id" value={s.id} />
                      <RowActionButton
                        type="submit"
                        iconOnly
                        tone="danger"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                      >
                        {t("delete")}
                      </RowActionButton>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="px-4 py-3">
            <CreateScheduleForm
              action={createAction}
              pending={createPending}
              state={createState}
            />
          </div>
        </aside>

        {selected ? (
          <div className="min-w-0 flex-1">
            <ScheduleBlocksEditor
              key={selected.id}
              scheduleId={selected.id}
              scheduleName={selected.name}
              isDefault={selected.is_default}
              initialBlocks={selected.blocks}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}

function CreateScheduleForm({
  action,
  pending,
  state,
}: {
  action: (payload: FormData) => void;
  pending: boolean;
  state: ActionResult;
}) {
  const t = useTranslations("institut.team.schedules");

  return (
    <form action={action} className="space-y-2">
      <p className="text-xs font-medium text-slate-600">{t("createTitle")}</p>
      <Input name="name" placeholder={t("createPlaceholder")} className="!w-full" required />
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
      <Button type="submit" variant="outline" className="h-8 w-full text-sm" disabled={pending}>
        {pending ? t("creating") : t("create")}
      </Button>
    </form>
  );
}
