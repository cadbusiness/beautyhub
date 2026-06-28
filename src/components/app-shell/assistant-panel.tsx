"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  interpretMessage,
  runAiAction,
  type InterpretMessageResult,
  type RunAiActionResult,
} from "@/app/(app)/assistant/actions";

type Action = { name: string; description: string };

type Message =
  | { role: "assistant"; text: string }
  | { role: "user"; text: string }
  | { role: "result"; result: RunAiActionResult }
  | {
      role: "confirm";
      actionName: string;
      params: Record<string, unknown>;
      summary: string;
    };

const ACTION_KEYS: Record<string, string> = {
  "institut.create_client": "createClient",
  "institut.list_clients": "listClients",
  "institut.list_services": "listServices",
  "institut.list_staff": "listStaff",
  "institut.list_resources": "listResources",
  "institut.list_appointments": "listAppointments",
  "institut.create_appointment": "createAppointment",
  "institut.cancel_appointment": "cancelAppointment",
  "institut.list_schedules": "listSchedules",
  "institut.create_schedule": "createSchedule",
  "institut.update_schedule_blocks": "updateScheduleBlocks",
  "institut.assign_staff_schedule": "assignStaffSchedule",
  "institut.assign_resource_schedule": "assignResourceSchedule",
  "institut.create_time_off": "createTimeOff",
  "institut.list_time_off": "listTimeOff",
  "institut.delete_time_off": "deleteTimeOff",
  "institut.pos_session_status": "posSessionStatus",
  "institut.pos_open_session": "posOpenSession",
  "institut.pos_close_session": "posCloseSession",
  "institut.pos_generate_x_report": "posGenerateXReport",
  "institut.pos_add_movement": "posAddMovement",
  "institut.pos_list_sales": "posListSales",
  "institut.pos_checkout": "posCheckout",
  "institut.pos_pay_balance": "posPayBalance",
  "institut.pos_issue_gift_card": "posIssueGiftCard",
  "institut.pos_list_gift_cards": "posListGiftCards",
  "institut.pos_create_credit_note": "posCreateCreditNote",
  "institut.pos_list_credit_notes": "posListCreditNotes",
  "institut.pos_list_products": "posListProducts",
  "institut.pos_create_product": "posCreateProduct",
  "institut.pos_get_settings": "posGetSettings",
  "academie.list_courses": "listCourses",
  "academie.create_course": "createCourse",
};

const MODULE_KEYS: Record<string, "institut" | "academie"> = {
  institut: "institut",
  academie: "academie",
};

export function AssistantPanel({ actions }: { actions: Action[] }) {
  const t = useTranslations("assistant.panel");
  const tActions = useTranslations("assistant.panel.actions");
  const tModules = useTranslations("assistant.panel.modules");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: t("greeting") },
  ]);
  const [pending, startTransition] = useTransition();

  function actionLabel(action: Action) {
    const key = ACTION_KEYS[action.name];
    if (key) return (tActions as (k: string) => string)(key);
    return action.description.replace(/\.$/, "").slice(0, 56);
  }

  const grouped = useMemo(() => {
    const groups = new Map<string, Action[]>();
    for (const action of actions) {
      const mod = action.name.split(".")[0] ?? "other";
      const labelKey = MODULE_KEYS[mod];
      const label = labelKey ? tModules(labelKey) : mod;
      const list = groups.get(label) ?? [];
      list.push(action);
      groups.set(label, list);
    }
    return groups;
  }, [actions, tModules]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function appendResult(result: RunAiActionResult) {
    setMessages((prev) => [...prev, { role: "result", result }]);
  }

  function executeAction(actionName: string, params: Record<string, unknown>, confirmed = false) {
    startTransition(async () => {
      const result = await runAiAction(actionName, JSON.stringify(params), { confirmed });
      if (!result.ok && result.needsConfirm) {
        setMessages((prev) => [
          ...prev,
          {
            role: "confirm",
            actionName,
            params,
            summary: t("confirmFallback"),
          },
        ]);
        return;
      }
      appendResult(result);
    });
  }

  function runQuickAction(actionName: string, params: Record<string, unknown> = {}) {
    const action = actions.find((a) => a.name === actionName);
    const label = action ? actionLabel(action) : actionName;
    setMessages((prev) => [...prev, { role: "user", text: label }]);
    executeAction(actionName, params, false);
  }

  function handleInterpretResult(result: InterpretMessageResult) {
    if (result.type === "clarify" || result.type === "unknown") {
      setMessages((prev) => [...prev, { role: "assistant", text: result.message }]);
      return;
    }

    if (result.needsConfirm) {
      setMessages((prev) => [
        ...prev,
        {
          role: "confirm",
          actionName: result.actionName,
          params: result.params,
          summary: result.summary,
        },
      ]);
      return;
    }

    executeAction(result.actionName, result.params, true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);

    startTransition(async () => {
      const result = await interpretMessage(text);
      handleInterpretResult(result);
    });
  }

  function confirmPending(msg: Extract<Message, { role: "confirm" }>) {
    setMessages((prev) => [
      ...prev.filter((m) => m !== msg),
      { role: "assistant", text: t("confirming", { summary: msg.summary }) },
    ]);
    executeAction(msg.actionName, msg.params, true);
  }

  if (actions.length === 0) return null;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg transition hover:bg-primary-hover"
          aria-label={t("open")}
        >
          <span className="text-base">✦</span>
          <span className="hidden sm:inline">{t("fabLabel")}</span>
        </button>
      ) : null}

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/20 lg:bg-black/10"
          onClick={() => setOpen(false)}
          aria-label={t("closeOverlay")}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[380px] flex-col border-l border-slate-200 bg-white shadow-xl transition-transform duration-200",
          open ? "translate-x-0" : "pointer-events-none translate-x-full",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{t("title")}</p>
            <p className="text-xs text-slate-500">{t("subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label={t("closeChat")}
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[92%] rounded-xl px-3 py-2 text-sm",
                msg.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : msg.role === "result"
                    ? "border border-slate-200 bg-slate-50 text-slate-700"
                    : msg.role === "confirm"
                      ? "border border-amber-200 bg-amber-50 text-slate-800"
                      : "bg-slate-100 text-slate-700",
              )}
            >
              {msg.role === "result" ? (
                msg.result.ok ? (
                  <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-emerald-700">
                    {JSON.stringify(msg.result.data, null, 2)}
                  </pre>
                ) : (
                  <p className="text-red-600">{msg.result.error}</p>
                )
              ) : msg.role === "confirm" ? (
                <div className="space-y-2">
                  <p>{msg.summary}</p>
                  <p className="text-xs text-slate-600">{t("confirmPrompt")}</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="h-8"
                      disabled={pending}
                      onClick={() => confirmPending(msg)}
                    >
                      {t("confirmYes")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8"
                      disabled={pending}
                      onClick={() =>
                        setMessages((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      {t("confirmNo")}
                    </Button>
                  </div>
                </div>
              ) : (
                msg.text
              )}
            </div>
          ))}
          {pending ? (
            <p className="text-xs text-slate-400">{t("thinking")}</p>
          ) : null}
        </div>

        <div className="space-y-3 border-t border-slate-100 p-4">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("quickActions")}
            </p>
            {[...grouped.entries()].map(([module, moduleActions]) => (
              <div key={module} className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500">{module}</p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {moduleActions.map((action) => (
                    <button
                      key={action.name}
                      type="button"
                      disabled={pending}
                      onClick={() => runQuickAction(action.name)}
                      className="flex w-full flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <span className="text-sm font-medium text-slate-900">
                        {actionLabel(action)}
                      </span>
                      <span className="text-xs text-slate-500 line-clamp-1">
                        {action.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("messagePlaceholder")}
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            <Button type="submit" disabled={pending} className="shrink-0">
              {pending ? t("sendPending") : t("send")}
            </Button>
          </form>
        </div>
      </aside>
    </>
  );
}
