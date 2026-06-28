"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { runAiAction, type RunAiActionResult } from "@/app/(app)/assistant/actions";

type Action = { name: string; description: string };

type Message =
  | { role: "assistant"; text: string }
  | { role: "user"; text: string }
  | { role: "result"; result: RunAiActionResult };

export function AssistantPanel({ actions }: { actions: Action[] }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Bonjour ! Choisis une action rapide ou decrivez ce que vous voulez faire.",
    },
  ]);
  const [pending, startTransition] = useTransition();

  function runAction(actionName: string, params: unknown = {}) {
    const json = JSON.stringify(params);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: actionName },
    ]);

    startTransition(async () => {
      const result = await runAiAction(actionName, json);
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
        a.name.toLowerCase().includes(text.toLowerCase()) ||
        a.description.toLowerCase().includes(text.toLowerCase()),
    );
    if (match) {
      runAction(match.name);
    } else {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Utilisez un bouton d'action ci-dessous ou choisissez dans la liste.",
        },
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
          className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg transition hover:bg-violet-700"
          aria-label="Ouvrir l'assistant IA"
        >
          <span className="text-lg">✦</span>
        </button>
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[380px] flex-col border-l border-slate-200 bg-white shadow-xl transition-transform duration-200 lg:static lg:max-w-[340px] lg:shrink-0 lg:shadow-none",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0 lg:hidden",
        )}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Assistant IA</p>
            <p className="text-xs text-slate-500">Pilotage de l&apos;institut</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            Fermer
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[90%] rounded-xl px-3 py-2 text-sm",
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
          <div className="flex flex-wrap gap-1.5">
            {actions.slice(0, 4).map((action) => (
              <button
                key={action.name}
                type="button"
                disabled={pending}
                onClick={() => runAction(action.name)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:border-violet-300 hover:bg-violet-50 disabled:opacity-50"
                title={action.description}
              >
                {action.name.split(".").pop()}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Votre message..."
              className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-violet-500"
            />
            <Button type="submit" disabled={pending} className="shrink-0">
              {pending ? "..." : "Envoyer"}
            </Button>
          </form>
        </div>
      </aside>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Fermer l'assistant"
        />
      ) : null}
    </>
  );
}
