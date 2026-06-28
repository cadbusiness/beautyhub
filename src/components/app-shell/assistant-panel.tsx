"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  interpretMessage,
  runAiAction,
  submitSupportTicket,
  type InterpretMessageResult,
  type RunAiActionResult,
} from "@/app/(app)/assistant/actions";
import type { SupportCategory } from "@/lib/platform/support";

type Action = { name: string; description: string };

type Message =
  | { role: "assistant"; text: string }
  | { role: "user"; text: string }
  | { role: "help"; text: string; links: { label: string; href: string }[] }
  | {
      role: "support";
      summary: string;
      category: SupportCategory;
      subject: string;
      body: string;
      conversationExcerpt: string;
    }
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

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function AssistantPanel({ actions }: { actions: Action[] }) {
  const t = useTranslations("assistant.panel");
  const tActions = useTranslations("assistant.panel.actions");
  const tModules = useTranslations("assistant.panel.modules");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionSearch, setActionSearch] = useState("");
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

  const filteredGroups = useMemo(() => {
    const q = actionSearch.trim().toLowerCase();
    if (!q) return grouped;

    const filtered = new Map<string, Action[]>();
    for (const [module, moduleActions] of grouped) {
      const matches = moduleActions.filter((action) => {
        const label = actionLabel(action).toLowerCase();
        return (
          label.includes(q) ||
          action.description.toLowerCase().includes(q) ||
          action.name.toLowerCase().includes(q)
        );
      });
      if (matches.length > 0) filtered.set(module, matches);
    }
    return filtered;
  }, [grouped, actionSearch, tActions]);

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
    setActionsOpen(false);
    setActionSearch("");
    executeAction(actionName, params, false);
  }

  function handleInterpretResult(result: InterpretMessageResult) {
    if (result.type === "clarify" || result.type === "unknown") {
      setMessages((prev) => [...prev, { role: "assistant", text: result.message }]);
      return;
    }

    if (result.type === "help") {
      setMessages((prev) => [
        ...prev,
        { role: "help", text: result.message, links: result.links },
      ]);
      return;
    }

    if (result.type === "support_offer") {
      setMessages((prev) => {
        const conversationExcerpt = prev
          .slice(-6)
          .map((m) => {
            if (m.role === "user") return `Utilisateur: ${m.text}`;
            if (m.role === "assistant") return `Assistant: ${m.text}`;
            if (m.role === "help") return `Guide: ${m.text}`;
            return "";
          })
          .filter(Boolean)
          .join("\n");

        return [
          ...prev,
          {
            role: "support" as const,
            summary: result.summary,
            category: result.category,
            subject: result.subject,
            body: result.body,
            conversationExcerpt,
          },
        ];
      });
      return;
    }

    if (result.type === "action" && result.needsConfirm) {
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

    if (result.type === "action") {
      executeAction(result.actionName, result.params, true);
    }
  }

  function submitSupport(msg: Extract<Message, { role: "support" }>) {
    startTransition(async () => {
      const result = await submitSupportTicket({
        subject: msg.subject,
        body: msg.body,
        category: msg.category,
        aiSummary: msg.summary,
        conversationExcerpt: msg.conversationExcerpt,
        pageUrl: typeof window !== "undefined" ? window.location.pathname : undefined,
      });

      setMessages((prev) => prev.filter((m) => m !== msg));

      if (result.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: t("support.submitted") },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: result.error ?? t("support.submitError") },
        ]);
      }
    });
  }

  function submitMessage() {
    const text = input.trim();
    if (!text || pending) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);

    startTransition(async () => {
      const result = await interpretMessage(text);
      handleInterpretResult(result);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitMessage();
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
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-slate-200 bg-white shadow-xl transition-transform duration-200",
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
                      : msg.role === "support"
                        ? "border border-sky-200 bg-sky-50 text-slate-800"
                        : msg.role === "help"
                          ? "border border-emerald-200 bg-emerald-50 text-slate-800"
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
              ) : msg.role === "help" ? (
                <div className="space-y-2">
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  {msg.links.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {msg.links.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          className="inline-flex rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                        >
                          {link.label} →
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : msg.role === "support" ? (
                <div className="space-y-2">
                  <p>{msg.summary}</p>
                  <p className="text-xs text-slate-600">{t("support.prompt")}</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="h-8"
                      disabled={pending}
                      onClick={() => submitSupport(msg)}
                    >
                      {t("support.confirm")}
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
                      {t("support.cancel")}
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
          <div className="space-y-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setActionsOpen((value) => !value)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <span className="font-medium text-slate-700">{t("browseAllActions")}</span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span>{actions.length}</span>
                <ChevronIcon open={actionsOpen} />
              </span>
            </button>

            {actionsOpen ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <div className="border-b border-slate-200 p-2">
                  <input
                    type="search"
                    value={actionSearch}
                    onChange={(e) => setActionSearch(e.target.value)}
                    placeholder={t("searchActions")}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </div>
                <div className="max-h-52 space-y-3 overflow-y-auto p-2">
                  {[...filteredGroups.entries()].length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-slate-500">
                      {t("noActionResults")}
                    </p>
                  ) : (
                    [...filteredGroups.entries()].map(([module, moduleActions]) => (
                      <div key={module} className="space-y-1">
                        <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          {module}
                        </p>
                        <div className="space-y-0.5">
                          {moduleActions.map((action) => (
                            <button
                              key={action.name}
                              type="button"
                              disabled={pending}
                              onClick={() => runQuickAction(action.name)}
                              title={action.description}
                              className="flex w-full items-center rounded-lg px-2 py-1.5 text-left text-sm text-slate-800 transition hover:bg-white disabled:opacity-50"
                            >
                              <span className="truncate font-medium">{actionLabel(action)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitMessage();
                }
              }}
              placeholder={t("messagePlaceholder")}
              rows={3}
              disabled={pending}
              className="min-h-[96px] w-full resize-none rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-12 text-base text-slate-900 outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label={pending ? t("sendPending") : t("send")}
              className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? (
                <span className="text-sm">{t("sendPending")}</span>
              ) : (
                <SendIcon className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
