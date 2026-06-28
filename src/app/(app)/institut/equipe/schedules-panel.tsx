"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { createSchedule, deleteSchedule, type ActionResult } from "../schedule-actions";
import { ScheduleBlocksEditor } from "./schedule-blocks-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{t("empty")}</p>
        <CreateScheduleForm action={createAction} pending={createPending} state={createState} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 space-y-3 lg:w-56">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {t("listTitle")}
        </p>
        <ul className="space-y-1">
          {schedules.map((s) => (
            <li key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={`flex-1 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selected?.id === s.id
                    ? "bg-slate-900 font-medium text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {s.name}
                {s.is_default ? (
                  <span className="ml-1 text-xs opacity-70">· {t("defaultShort")}</span>
                ) : null}
              </button>
              {!s.is_default ? (
                <form action={deleteSchedule}>
                  <input type="hidden" name="id" value={s.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-red-600"
                    title={t("delete")}
                  >
                    ×
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        <CreateScheduleForm action={createAction} pending={createPending} state={createState} />
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
    <form action={action} className="space-y-2 border-t border-slate-200 pt-3">
      <p className="text-xs font-medium text-slate-600">{t("createTitle")}</p>
      <Input
        name="name"
        placeholder={t("createPlaceholder")}
        className="!w-full"
        required
      />
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
      <Button type="submit" variant="outline" className="h-8 w-full text-sm" disabled={pending}>
        {pending ? t("creating") : t("create")}
      </Button>
    </form>
  );
}
