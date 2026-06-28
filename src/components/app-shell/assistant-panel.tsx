"use client";

import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { runAiAction, type RunAiActionResult } from "@/app/(app)/assistant/actions";

type Action = { name: string; description: string };

type Message =
  | { role: "assistant"; text: string }
  | { role: "user"; text: string }
  | { role: "result"; result: RunAiActionResult };

const ACTION_LABELS: Record<string, string> = {
  "institut.create_client": "Créer un client",
  "institut.list_clients": "Lister les clients",
  "academie.list_courses": "Voir les formations",
  "academie.create_course": "Nouvelle formation",
};

const MODULE_LABELS: Record<string, string> = {
  institut: "Institut",
  academie: "Académie",
};

function actionLabel(action: Action) {
  return (
    ACTION_LABELS[action.name] ??
    action.description.replace(/\.$/, "").slice(0, 48)
  );
}

function groupActions(actions: Action[]) {
  const groups = new Map<string, Action[]>();
  for (const action of actions) {
    const mod = action.name.split(".")[0] ?? "autre";
    const label = MODULE_LABELS[mod] ?? mod;
    const list = groups.get(label) ?? [];
    list.push(action);
    groups.set(label, list);
  }
  return groups;
}

export function AssistantPanel({ actions }: { actions: Action[] }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Bonjour ! Utilise une action rapide ci-dessous ou décris ce que tu veux faire.",
    },
  ]);
  const [pending, startTransition] = useTransition();

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
        {
          role: "assistant",
          text: "Je n'ai pas reconnu cette demande. Choisis une action rapide ci-dessous.",
        },
      ]);
    }
  }

  if (actions.length === 0) return null;

  const grouped = groupActions(actions);

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-violet-600 px-4 text-sm font-medium text-white shadow-lg transition hover:bg-violet-700"
          aria-label="Ouvrir l'assistant IA"
        >
          <span className="text-base">✦</span>
          <span className="hidden sm:inline">Assistant</span>
        </button>
      ) : null}

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/20 lg:bg-black/10"
          onClick={() => setOpen(false)}
          aria-label="Fermer l'assistant"
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
            <p className="text-sm font-semibold text-slate-900">Assistant IA</p>
            <p className="text-xs text-slate-500">Pilotage de l&apos;institut</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Fermer le chat"
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
                  ? "ml-auto bg-violet-600 text-white"
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
              Actions rapides
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
                      className="flex w-full flex-col rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50"
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
              placeholder="Votre message..."
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
            />
            <Button type="submit" disabled={pending} className="shrink-0">
              {pending ? "..." : "Envoyer"}
            </Button>
          </form>
        </div>
      </aside>
    </>
  );
}
