"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { saveScheduleBlocks, type ActionResult } from "../schedule-actions";
import { weekdayMessageKey } from "@/lib/i18n/nav";
import { WEEKDAYS } from "./constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dataTableCell, dataTableHead, dataTableRow } from "@/components/ui/data-table";

const initial: ActionResult = {};
const timeInputClass = "!w-[7.25rem] shrink-0";

interface Block {
  start: string;
  end: string;
}

type DayBlocks = Record<number, Block[]>;

function groupBlocks(
  blocks: Array<{ weekday: number; start_time: string; end_time: string }>,
): DayBlocks {
  const map: DayBlocks = {};
  for (const b of blocks) {
    if (!map[b.weekday]) map[b.weekday] = [];
    map[b.weekday].push({
      start: b.start_time.slice(0, 5),
      end: b.end_time.slice(0, 5),
    });
  }
  return map;
}

function flattenBlocks(map: DayBlocks): Array<{ weekday: number; start_time: string; end_time: string }> {
  const out: Array<{ weekday: number; start_time: string; end_time: string }> = [];
  for (const day of WEEKDAYS) {
    for (const block of map[day.value] ?? []) {
      out.push({ weekday: day.value, start_time: block.start, end_time: block.end });
    }
  }
  return out;
}

function DayEditor({
  weekday,
  dayLabel,
  blocks,
  closedLabel,
  addBlockLabel,
  onChange,
}: {
  weekday: number;
  dayLabel: string;
  blocks: Block[];
  closedLabel: string;
  addBlockLabel: string;
  onChange: (weekday: number, blocks: Block[]) => void;
}) {
  const open = blocks.length > 0;

  function toggleOpen(checked: boolean) {
    if (checked) {
      onChange(weekday, [{ start: "09:00", end: "18:00" }]);
    } else {
      onChange(weekday, []);
    }
  }

  return (
    <tr className={dataTableRow}>
      <td className={`font-medium text-slate-900 ${dataTableCell}`}>{dayLabel}</td>
      <td className={`text-center ${dataTableCell}`}>
        <input
          type="checkbox"
          checked={open}
          onChange={(e) => toggleOpen(e.target.checked)}
          className="size-4 rounded border-slate-300"
          aria-label={dayLabel}
        />
      </td>
      <td className={dataTableCell}>
        {!open ? (
          <span className="text-sm text-slate-400">{closedLabel}</span>
        ) : (
          <div className="space-y-2">
            {blocks.map((block, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <Input
                  type="time"
                  value={block.start}
                  onChange={(e) => {
                    const next = [...blocks];
                    next[index] = { ...next[index], start: e.target.value };
                    onChange(weekday, next);
                  }}
                  className={timeInputClass}
                />
                <span className="text-slate-400" aria-hidden>
                  –
                </span>
                <Input
                  type="time"
                  value={block.end}
                  onChange={(e) => {
                    const next = [...blocks];
                    next[index] = { ...next[index], end: e.target.value };
                    onChange(weekday, next);
                  }}
                  className={timeInputClass}
                />
                {blocks.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-2 text-red-600"
                    onClick={() => onChange(weekday, blocks.filter((_, i) => i !== index))}
                  >
                    ×
                  </Button>
                ) : null}
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-2 text-sm text-slate-600"
              onClick={() =>
                onChange(weekday, [...blocks, { start: "14:00", end: "18:00" }])
              }
            >
              + {addBlockLabel}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

export function ScheduleBlocksEditor({
  scheduleId,
  scheduleName,
  isDefault,
  initialBlocks,
}: {
  scheduleId: string;
  scheduleName: string;
  isDefault: boolean;
  initialBlocks: Array<{ weekday: number; start_time: string; end_time: string }>;
}) {
  const t = useTranslations("institut.team.schedules");
  const tWeekdays = useTranslations("weekdays");
  const [state, action, pending] = useActionState(saveScheduleBlocks, initial);
  const [name, setName] = useState(scheduleName);
  const [dayBlocks, setDayBlocks] = useState<DayBlocks>(() => groupBlocks(initialBlocks));

  const blocksJson = useMemo(() => JSON.stringify(flattenBlocks(dayBlocks)), [dayBlocks]);

  function setBlocksForDay(weekday: number, blocks: Block[]) {
    setDayBlocks((prev) => {
      const next = { ...prev };
      if (blocks.length === 0) {
        delete next[weekday];
      } else {
        next[weekday] = blocks;
      }
      return next;
    });
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="schedule_id" value={scheduleId} />
      <input type="hidden" name="blocks" value={blocksJson} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1">
          <label htmlFor="schedule-name" className="text-sm font-medium text-slate-700">
            {t("nameLabel")}
          </label>
          <Input
            id="schedule-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="!w-full max-w-md"
            disabled={isDefault}
          />
        </div>
        {isDefault ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {t("defaultBadge")}
          </span>
        ) : null}
      </div>

      <p className="text-sm text-slate-500">{t("blocksHint")}</p>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className={`w-36 ${dataTableHead}`}>{t("columns.day")}</th>
              <th className={`w-24 text-center ${dataTableHead}`}>{t("columns.open")}</th>
              <th className={dataTableHead}>{t("columns.hours")}</th>
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS.map((day) => (
              <DayEditor
                key={day.value}
                weekday={day.value}
                dayLabel={tWeekdays(weekdayMessageKey(day.value))}
                blocks={dayBlocks[day.value] ?? []}
                closedLabel={t("closed")}
                addBlockLabel={t("addBlock")}
                onChange={setBlocksForDay}
              />
            ))}
          </tbody>
        </table>
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-600">{t("saved")}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t("submitting") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
