"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { runAiAction, type RunAiActionResult } from "@/app/(app)/assistant/actions";

type Action = { name: string; description: string };

type Message =
  | { role: "assistant"; text: string }
  | { role: "user"; text: string }
  | { role: "result"; result: RunAiActionResult };

const ACTION_KEYS: Record<string, "createClient" | "listClients" | "listCourses" | "createCourse"> = {
  "institut.create_client": "createClient",
  "institut.list_clients": "listClients",
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
    if (key) return tActions(key);
    return action.description.replace(/\.$/, "").slice(0, 48);
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

  function runAction(actionName: string, params: unknown = {}) {
    const action = actions.find((a) => a.name === actionName);
    const label = action ? actionLabel(action) : actionName;
    setMessages((prev) => [...prev, { role: "user", text: label }]);

    startTransition(async () => {
      const result = await runAiAction(actionName, JSON.stringify(params));
      setMessages((prev) => [...prev, { role: "result", result }]);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);

    const match = actions.find(
      (a) =>
        actionLabel(a).toLowerCase().includes(text.toLowerCase()) ||
        a.description.toLowerCase().includes(text.toLowerCase()),
    );
    if (match) {
      runAction(match.name);
    } else {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: t("notRecognized") },
      ]);
    }
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
              ) : (
                msg.text
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-slate-100 p-4">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {t("quickActions")}
            </p>
            {[...grouped.entries()].map(([module, moduleActions]) => (
              <div key={module} className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500">{module}</p>
                <div className="space-y-1">
                  {moduleActions.map((action) => (
                    <button
                      key={action.name}
                      type="button"
                      disabled={pending}
                      onClick={() => runAction(action.name)}
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
